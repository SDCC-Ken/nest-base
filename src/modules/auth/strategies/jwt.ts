import { Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { Request } from 'classes/request'
import { CacheService } from 'modules/cache/service'
import { ApiTableService } from 'modules/sequelize/services/table/api'
import { AuthenticationTableService } from 'modules/sequelize/services/table/authentication'
import { PartyGroupTableService } from 'modules/sequelize/services/table/partyGroup'
import { PartyGroupSystemTableService } from 'modules/sequelize/services/table/partyGroupSystem'
import { PersonSystemTableService } from 'modules/sequelize/services/table/personSystem'
import { SwivelConfigService } from 'modules/swivel-config/service'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { getExtraInformationFromRequest, IPayloadLoader, resolvePayload } from '../helper'
import { AuthService } from '../services'
import { RefreshAuthService } from '../services/refresh'
import { parse, JwtSimplifiedPayload } from '@swivel-admin/swivel-auth-parser'
import { JwtPayload } from '../interface'
import { callAuth } from 'utils/axios'
import { CustomBackendService } from 'modules/custom-backend/services'
import { MergeFunc } from 'modules/custom-backend/mergeFunc'
import { BackwardFunc } from 'modules/custom-backend/backwardFunc'

export const VERSION = 2

function getRefreshToken(req: Request) {
  if (typeof req['cookies'] !== 'undefined') {
    return null
  }
  const value = req.header('x-refresh-token')
  return value
}

const getAuthJwtPayload = async(
  payload: any,
  request: Request,
  swivelConfigService: SwivelConfigService
): Promise<any> => {
  // get user profile
  const response = await callAuth(swivelConfigService, {
    method: 'GET',
    url: 'api/person/default'
  }, { system: request.headers['x-system'], user: payload, reused: true })
  return response.data
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') implements IPayloadLoader {
  urlMapping: any = {}

  constructor(
    readonly swivelConfigService: SwivelConfigService,
    private readonly cacheService: CacheService,
    private readonly authService: AuthService,
    private readonly refreshAuthService: RefreshAuthService,
    private readonly authenticationTableService: AuthenticationTableService,
    readonly partyGroupTableService: PartyGroupTableService,
    readonly partyGroupSystemTableService: PartyGroupSystemTableService,
    readonly personSystemTableService: PersonSystemTableService,
    readonly apiTableService: ApiTableService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([ExtractJwt.fromAuthHeaderAsBearerToken()]),
      passReqToCallback: true,
      secretOrKeyProvider: async(request, rawJwtToken, done) => {
        const { authModule } = await swivelConfigService.get()
        done(null, authModule.jwtKey)
      }
    })
    this.swivelConfigService.get()
      .then(({ urlMapping }) => this.urlMapping = urlMapping || {})
  }

  getBaseURL(system: string, req: Request, user: JwtPayload, ...urlKeys: string[]): string {
    const api = user['api']
    switch (system) {
      case '360': {
        if ('uat' in req && (req.system === '360uat' || req.uat)) system += 'uat'
        break
      }
    }
    if (!urlKeys.length) urlKeys = ['url']
    let baseURL: string = urlKeys.reduce((r, k) => r || (api[system] || {})[k], '')
    if (!baseURL) {
      if (!system.startsWith('360')) throw new UnprocessableEntityException(`System ${system} not setup for ${user.customer}`)
      baseURL = `https://${system}-api.swivelsoftware.asia`
    }
    if (baseURL.endsWith('/')) baseURL = baseURL.substring(0, baseURL.length - 1) // no slash end

    // remap url
    baseURL = this.urlMapping[baseURL] || baseURL

    return baseURL
  }

  async validate(req: Request, { iat, exp, ...userDetail }: JwtSimplifiedPayload & { iat: number; exp: number }): Promise<JwtPayload> {
    try {
      const now = Date.now()
      const { microServices } = await this.swivelConfigService.get()
      const realIssueTime = iat * 1000 // need * 1000
      const realExpiryTime = exp * 1000 // need * 1000
      const totalIssueTime = realExpiryTime - realIssueTime // should be constant to any token
      const microToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req)
      const user: JwtPayload = await parse(userDetail, VERSION, microToken)

      // check authenticated
      const authentication = await this.authenticationTableService.findOne({ where: { id: user.authenticationId, username: user.user } })
      if (!authentication) throw new UnauthorizedException()

      user.user = user.pretend || user.user
      user.microServices = microServices
      delete user.pretend

      const refreshToken = getRefreshToken(req)

      let newAccessToken: string

      if (realExpiryTime - now < totalIssueTime * 0.1) {
        // expired in 10% of the token
        const extra = getExtraInformationFromRequest(req)

        if (refreshToken) {
          console.debug('JWT token has been renewed by Refresh Token', this.constructor.name)
          newAccessToken = (await this.refreshAuthService.refreshLogin(req.system, refreshToken, extra)).accessToken
        }
        else {
          console.debug('JWT token has been renewed with added refreshToken', this.constructor.name)
          const detail = await this.authService.generateToken(req.system, authentication.authTypeCode, authentication.username, extra, authentication, false)
          newAccessToken = detail.accessToken
        }
      }

      // jwt cached for localhost
      const cacheKey = `jwt-${authentication.authTypeCode}-${authentication.id}-${authentication.username}-${realIssueTime}`
      const saved = await this.cacheService.get<JwtPayload>(cacheKey)
      if (saved && typeof saved !== 'string') {
        if (newAccessToken) saved.accessToken = newAccessToken
        console.debug('JWT payload cached', this.constructor.name)
        return saved
      }

      // get jwt payload
      await resolvePayload.apply(this, [user])
      user.accessToken = newAccessToken || microToken
      user.iat = realIssueTime
      this.cacheService.save(cacheKey, { ...user }, { expiredAt: realExpiryTime })

      return user
    }
    catch (e) {
      console.error(e.message, e.stack, this.constructor.name)
      return
    }
  }
}
