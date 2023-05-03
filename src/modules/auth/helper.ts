import { NotFoundException, UnprocessableEntityException } from '@nestjs/common'
import { Request } from 'classes/request'
import { Api } from 'models/main/api'
import { PartyGroup } from 'models/main/partyGroup'
import { PersonSystem } from 'models/main/personSystem'
import { ExtraRequestInformation } from 'modules/sequelize/interfaces/authenticationToken'
import { ApiTableService } from 'modules/sequelize/services/table/api'
import { PartyGroupTableService } from 'modules/sequelize/services/table/partyGroup'
import { PartyGroupSystemTableService } from 'modules/sequelize/services/table/partyGroupSystem'
import { PersonSystemTableService } from 'modules/sequelize/services/table/personSystem'
import requestIp = require('request-ip')
import { Op } from 'sequelize'
import { trim } from 'utils/trim'
import { JwtPayload } from './interface'

export function getExtraInformationFromRequest(req: Request): ExtraRequestInformation {
  return {
    time: Date.now(),
    ip: requestIp.getClientIp(req),
    browser: req.header('user-agent'),
    version: req.header('360-version')
  }
}

export function getRefreshTokenFromRequest(req: Request) {
  if(typeof req['cookies'] !== 'undefined') return null
  const value = req.header('x-refresh-token')
  return value
}

export interface IPayloadLoader {
  readonly partyGroupTableService: PartyGroupTableService
  readonly partyGroupSystemTableService: PartyGroupSystemTableService
  readonly personSystemTableService: PersonSystemTableService
  readonly apiTableService: ApiTableService
}

export async function resolvePayload(this: IPayloadLoader, user: JwtPayload) {
  switch (user.entityType) {
    case 'api': {
      const [api, partyGroup] = await Promise.all<Api, PartyGroup>([
        this.apiTableService.findOne(user.entityId, user)
          .then(a => {
            if (!a) throw new NotFoundException(`API ${user.user} not found`)
            return a
          }),
        this.partyGroupTableService.findOne({ where: { code: user.customer } }, user)
          .then(pg => {
            if (!pg) throw new NotFoundException(`PartyGroup ${user.customer} not found`)
            return pg
          })
      ])

      user.partyGroups = [{ code: partyGroup.code, name: partyGroup.name, systems: trim(partyGroup.systems) }]
      user.selectedPartyGroup = user.partyGroups[0]
      break
    }
    case 'person': {
      const [personSystems, aliasSystems] = await Promise.all<PersonSystem[], PersonSystem[]>([
        this.personSystemTableService.find({ where: { type: 'person', primaryKey: user.entityId } }, user),
        user.aliasId ? this.personSystemTableService.find({ where: { type: 'alias', primaryKey: user.aliasId } }, user) : []
      ])
      personSystems.push(...aliasSystems)

      const userPartyGroupSystems = await this.partyGroupSystemTableService.find({ where: { id: { [Op.in]: personSystems.map(s => s.systemId) } } })
      const partyGroups = await this.partyGroupTableService.find({ where: { code: { [Op.in]: userPartyGroupSystems.map(s => s.partyGroupCode) } } })
      user.partyGroups = partyGroups.map(pg => ({ code: pg.code, name: pg.name, systems: trim(pg.systems) }))
      user.selectedPartyGroup = user.partyGroups.find(({ code }) => code === user.customer)

      user.systems = personSystems
        .filter(s => s.partyGroupSystem.partyGroupCode === user.customer)
        .map(s => ({ id: s.id, type: s.type, code: s.code, customer: s.partyGroupSystem.partyGroupCode, system: s.partyGroupSystem.system }))

      user.thirdPartyCode = personSystems.reduce((r, ps) => {
        if (ps.code) r[ps.partyGroupSystem.system] = ps.code
        return r
      }, {})
      break
    }
    default: {
      throw new UnprocessableEntityException(`EntityType ${user.entityType} not implemented`)
    }
  }

  return user
}
