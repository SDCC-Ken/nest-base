import { Controller, UseGuards, Req, Get, Param } from '@nestjs/common'
import { SafeJwtAuthGuard } from 'modules/auth/guards/simple-auth-guard'
import { Request } from 'classes/request'
import { AuthenticationTableService } from 'modules/sequelize/services/table/authentication'

@Controller('auth')
export class AuthController {
  constructor(private readonly authenticationTableService: AuthenticationTableService) {}

  @UseGuards(SafeJwtAuthGuard)
  @Get()
  async test(@Req() req: Request) {
    return req.user
  }

  @UseGuards(SafeJwtAuthGuard)
  @Get('logs/:email?')
  async getLogs(@Param('email') username: string, @Req() req: Request) {
    return await this.authenticationTableService.getLog({
      where: {
        realmCode: 'local',
        system: req.system,
        partyGroupCode: req.user.customer,
        username: username || req.user.user
      },
      order: [['id', 'desc']],
      limit: 10
    })
  }
}
