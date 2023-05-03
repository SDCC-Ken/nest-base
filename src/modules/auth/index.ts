import { Module, forwardRef } from '@nestjs/common'
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'

import { JwtStrategy } from './strategies/jwt'
import { AuthController } from './controller'
import { LocalAuthController } from './controllers/local'
import { ApiAuthService } from './services/api'
import { LocalAuthService } from './services/local'
import { RefreshAuthService } from './services/refresh'
import { AuthService } from './services'

const SwivelJwtModule = JwtModule.registerAsync({
  useFactory: async(): Promise<JwtModuleOptions> => {
    return {
      secret: "test"
    } as JwtModuleOptions
  },
  inject: []
})

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    SwivelJwtModule
  ],
  controllers: [
    AuthController,
    LocalAuthController,
  ],
  providers: [
    JwtStrategy,
    AuthService,
    ApiAuthService,
    LocalAuthService,
    RefreshAuthService
  ],
  exports: [
    SwivelJwtModule,
    JwtStrategy,
    ApiAuthService,
    LocalAuthService
  ]
})
export class AuthModule {}
