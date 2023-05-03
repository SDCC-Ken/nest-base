import { CanActivate, mixin, ExecutionContext, Optional, UnauthorizedException } from '@nestjs/common'
import { Type, AuthModuleOptions } from '@nestjs/passport'
import * as passport from 'passport'
import { JwtPayload } from '../interface'
export type IAuthGuard = CanActivate & {
  logIn<
    TRequest extends {
      logIn: (user: any, errFunc: (err: any) => any) => void
    } = any
  >(
    request: TRequest
  ): Promise<void>
  handleRequest(err: any, user: any, info: any): JwtPayload
}
const defaultOptions = {
  session: false,
  property: 'user'
}
const NO_STRATEGY_ERROR = `
  In order to use "defaultStrategy", please, ensure to import PassportModule in each place where AuthGuard() is being used.
  Otherwise, passport won't work correctly.
`

export function AuthGuard(
  type: string,
  validFunction: (user: JwtPayload) => Promise<boolean>
): Type<CanActivate> {
  class MixinAuthGuard implements IAuthGuard {
    constructor(@Optional() protected readonly options?: AuthModuleOptions) {
      this.options = this.options || {}
      if (!type && !this.options.defaultStrategy) {
        console.error(NO_STRATEGY_ERROR)
      }
    }
    getRequestResponse(context: ExecutionContext) {
      switch (context.getType()) {
        case 'http': {
          return [
            context.switchToHttp().getRequest(),
            context.switchToHttp().getResponse()
          ]
        }
        case 'ws': {
          return [
            context.switchToWs().getClient().handshake,
            context.switchToHttp().getResponse()
          ]
        }
      }
    }
    getRequest<T = any>(context: ExecutionContext): T {
      switch (context.getType()) {
        case 'http': {
          return context.switchToHttp().getRequest()
        }
        case 'ws': {
          return context.switchToWs().getClient().handshake
        }
      }
    }
    async canActivate(context: ExecutionContext): Promise<boolean> {
      const options = { ...defaultOptions, ...this.options }
      const [request, response] = this.getRequestResponse(context)

      const passportFn = createPassportContext(request, response)
      const user: JwtPayload = (await passportFn(
        type || this.options.defaultStrategy,
        options,
        (err: any, info: any, u: any) => this.handleRequest(err, info, u)
      )) as any
      if (await validFunction(user)) {
        if (user) {
          request[options.property || defaultOptions.property] = user
        }
        return true
      }
      return false
    }
    async logIn<
      TRequest extends {
        logIn:(user: any, errFunc: (err: any) => any) => void
      } = any
    >(req: TRequest): Promise<void> {
      const user = req[this.options.property || defaultOptions.property]
      await new Promise<void>((resolve, reject) =>
        req.logIn(user, err => (err ? reject(err) : resolve()))
      )
    }
    handleRequest(err: any, user: any, info: any): JwtPayload {
      if (err || !user) {
        throw err || new UnauthorizedException()
      }
      return user
    }
  }
  const guard = mixin(MixinAuthGuard)
  return guard
}
const createPassportContext = (request: any, response: any) => (
  type: any,
  options: any,
  callback: (err: any, user: any, info: any) => any
) =>
  new Promise((resolve, reject) =>
    passport.authenticate(type, options, (err, user, info) => {
      try {
        request.authInfo = info
        return resolve(callback(err, user, info))
      } catch (err) {
        reject(err)
      }
    })(request, response, (err: any) => (err ? reject(err) : resolve))
  )
