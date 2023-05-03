import { CanActivate, ExecutionContext, mixin } from '@nestjs/common'
import { Type } from '@nestjs/passport'
import { AuthGuard } from './auth-guard'
import { Request } from 'express'
import { JwtPayload } from '../interface'

export function FunctionJwtAuthGuard(
  validFunction: (user: JwtPayload) => Promise<boolean>
): Type<CanActivate> {
  class MixinRoleAuthGuard extends AuthGuard('jwt', validFunction) {}
  const guard = mixin(MixinRoleAuthGuard)
  return guard
}

export class SafeJwtAuthGuard extends FunctionJwtAuthGuard(async user => !!user) {}
export class AdminSafeJwtAuthGuard extends FunctionJwtAuthGuard(async user => user && (user.isSuperAdmin)) {}
export class SwivelUserAdminSafeJwtAuthGuard extends FunctionJwtAuthGuard(async user => user && (user.isSuperAdmin && user.user.endsWith('@swivelsoftware.com'))) {}

export class DevOrSafeJwtAuthGuard extends FunctionJwtAuthGuard(async user => process.env.NODE_ENV !== 'production' || !!user) {
  handleRequest(err: any, user: any): JwtPayload {
    if (err) throw err
    return user
  }
}

export class UnsafeJwtAuthGuard extends FunctionJwtAuthGuard(async() => true) {
  async canActivate(context: ExecutionContext): Promise<any> {
    const req: Request = context.switchToHttp().getRequest()
    if (req['overrideUser']) {
      req.user = req['overrideUser']
      return true
    }
    return await super.canActivate(context)
  }
  handleRequest(err: any, user: any): JwtPayload {
    if (err) throw err
    return user
  }
}

export class SuperAdminJwtAuthGuard extends FunctionJwtAuthGuard(async user => user && user.isSuperAdmin) {}

export function SwivelAdminSafeJwtAuthGuard(): Type<CanActivate> {
  return FunctionJwtAuthGuard(async(user: JwtPayload) => {
    return user && (user.isSuperAdmin && user.user.endsWith('360@swivelsoftware.com'))
  })
}
