import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException
} from '@nestjs/common'
import { Op, Transaction } from 'sequelize'
import { AuthService, RealmStatus } from '.'
import { JwtPayload } from '../interface'
import { LoginFormPayload, LoginResult } from '../interfaces/loginform-payload'
import { RegisterFormPayload } from '../interfaces/registerform-payload'
import moment = require('moment')

import ms = require('ms')

@Injectable()
export class LocalAuthService {
  constructor(
    private readonly authService: AuthService,
  ) {}


  async login(
    loginForm: LoginFormPayload,
    extraRequestInformation: any
  ): Promise<{ expiry?: string | number; accessToken?: string; refreshToken?: string }> {

    try {
      const token = await this.authService.login(
        loginForm.username,
        'local',
        'local',
        async (authentication, partyGroup) => {
          if (!authentication.authenticationRealms) return RealmStatus.FAIL

          const partyGroupSystem = partyGroup && partyGroup.systems.find(s => s.system === system)
          let expiry =
            partyGroupSystem &&
            partyGroupSystem.configuration &&
            partyGroupSystem.configuration.passwordExpiry
          if (typeof expiry === 'string') expiry = expiry.match(/[a-zA-Z]+|[0-9]+/g) // e.g. ['3', 'm']

          const localRealm = authentication.authenticationRealms.filter(
            r => r.realmCode === 'local'
          )
          for (const r of localRealm) {
            if (r.password === loginForm.password) {
              return authentication.username.endsWith('@swivelsoftware.com') ||
                !expiry ||
                moment
                  .utc(r.createdAt)
                  .add(+expiry[0], expiry[1])
                  .isAfter(moment())
                ? RealmStatus.PASS
                : RealmStatus.EXPIRED
            }
          }
          return RealmStatus.FAIL
        },
        extraRequestInformation,
        loginForm.rememberMe,
        undefined
      )
      if (token) return token
      throw new UnauthorizedException('Fail to login')
    } catch (e) {
      console.error(e.message, e.stack, this.constructor.name)
      throw new UnprocessableEntityException(e.message)
    }
  }


  async register(
    system: string,
    registerForm: RegisterFormPayload,
    inviteToken: string,
    extraRequestInformation: any,
    transaction?: Transaction
  ): Promise<LoginResult> {

      try {
        return await this.authService.register(
          system,
          registerForm.username,
          registerForm.password,
          'local',
          'local',
          inviteToken,
          extraRequestInformation,
          registerForm.rememberMe || false,
          null,
          {
            email: registerForm.email,
            displayName: registerForm.displayName,
            firstName: registerForm.firstName,
            lastName: registerForm.lastName,
            photoURL: registerForm.photoURL
          },
          transaction
        )
      } catch (e) {
        console.error(e.message, e.stack, this.constructor.name)
        throw new UnprocessableEntityException(e.message)
      }
    }
  
}
