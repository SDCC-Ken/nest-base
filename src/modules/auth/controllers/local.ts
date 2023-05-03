import { BadRequestException, Body, Controller, Get, InternalServerErrorException, NotFoundException, Param, Post, Req, Res, UnauthorizedException, UnprocessableEntityException, UseGuards } from '@nestjs/common'
import { Request, Response } from 'express'
import { Person } from 'models/person'

import { SafeJwtAuthGuard, UnsafeJwtAuthGuard } from '../guards/simple-auth-guard'
import { getExtraInformationFromRequest } from '../helper'
import { LoginFormPayload } from '../interfaces/loginform-payload'
import { RegisterFormPayload } from '../interfaces/registerform-payload'
import { ISubscription } from '../interfaces/subscription'
import { LocalAuthService } from '../services/local'
import { AuthService, RealmStatus } from '../services'

import { Transaction } from 'sequelize'

@Controller('auth/local')
export class LocalAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly localAuthService: LocalAuthService
  ) {}

  @UseGuards(UnsafeJwtAuthGuard)
  @Post('login')
  async login(@Body() loginForm: LoginFormPayload, @Req() req: Request): Promise<any> {
    const extraRequestInformation = getExtraInformationFromRequest(req)
    const result = await this.localAuthService.login(loginForm, extraRequestInformation)
    if (!result) throw new UnprocessableEntityException('Username or password is not correct')
    return result
  }

  @UseGuards(UnsafeJwtAuthGuard)
  @Post('register/:token?')
  async register(@Param('token') token: string, @Body() registerForm: RegisterFormPayload, @Req() req: Request) {
    if (!token) throw new BadRequestException('missing registration token')
    const { accessToken } = await this.localAuthService.register(registerForm, getExtraInformationFromRequest(req))
    return { accessToken }
  }


  @Post('logout')
  @UseGuards(UnsafeJwtAuthGuard)
  async logout(@Body() subscription: ISubscription, @Req() req: Request, @Res() res: Response) {
    res.clearCookie('access-token').send()
  }

}
