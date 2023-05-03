import { ForbiddenException, Injectable, NotFoundException, NotImplementedException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'

import { Op, Transaction, QueryTypes } from 'sequelize'

import { JwtPayload } from '../interface'
import { LoginResult } from '../interfaces/loginform-payload'


import moment = require('moment')


import _ = require('lodash')

export enum RealmStatus {
  PASS,
  EXPIRED,
  FAIL
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
  ) { }

  async login(
    username: string,
    checker: (authentication: any) => Promise<RealmStatus>,
    extraRequestInformation: any,
    rememberMe = false,
    transaction?: Transaction
  ) {
    if (!transaction) {
      return await this.authenticationTableService.transaction(async transaction => {
        return this.login(username, checker, extraRequestInformation, rememberMe, transaction)
      })
    }
    try {
      const authentication = await this.authenticationTableService.findOne({ where: { username, authTypeCode } }, undefined, transaction)
      if (!authentication) throw new Error(`[${username}] Login Failed!`)


      switch (await checker(authentication, partyGroup)) {
        case RealmStatus.EXPIRED:
          throw new Error(`[${username}] Password Expired!`)
        case RealmStatus.FAIL:
          throw new Error(`[${username}] Login Failed!`)
      }
      const token = await this.generateToken(username, extraRequestInformation, authentication, rememberMe, transaction)
      return token
    }
    catch (e) {
      console.error(e.message, e.stack, 'AuthService')
      throw new UnprocessableEntityException(e.message)
    }
  }

  async generateToken(
    username: string,
    extraRequestInformation: any,
    authentication: any,
    rememberMe = false,
    transaction?: Transaction
  ): Promise<LoginResult> {
    const jwtPayload = await this.generateJwtPayload(
      username,
      authentication,
      transaction
    )
    return {
      authenticationId: authentication.id,
      accessToken: this.jwtService.sign(jwtPayload, {
        expiresIn: '1m',
        issuer: 'ken',
        subject: 'ken'
      })
    }
  }


  async generateJwtPayload(
    username: string,
    authentication: any,
    transaction?: Transaction
  ): Promise<any> {
    
    return {
      v: 1,
      a: authentication.id,
      y: authentication.authTypeCode,
      u: authentication.username,
    } 
  }

  async register(
    username: string,
    password: string,
    inviteToken: string,
    extraRequestInformation: any,
    rememberMe = false,
    realmCodeId?: string,
    realmProfile?: {
      firstName?: string
      lastName?: string
      displayName?: string
      email?: string
      phone?: string
      photoURL?: string
    },
    transaction?: Transaction
  ): Promise<LoginResult> {
    if (!transaction) {
      return this.authenticationTableService.transaction(async transaction =>
        this.register(
          username,
          password,
          inviteToken,
          extraRequestInformation,
          rememberMe,
          realmCodeId,
          realmProfile,
          transaction
        )
      )
    }
    try {
      const token = await this.tokenTableService.verifyToken(inviteToken, transaction)
      if (!token) throw new Error('Invalid invitation token')
      if ((token.flexData.userName || '').toLocaleLowerCase() !== username.toLocaleLowerCase()) throw new ForbiddenException(`Token not matched for ${username}`)
      await this.tokenTableService.useToken(inviteToken, transaction)

      const person = await this.personTableService.findOne({ where: { userName: username } }, undefined, transaction)
      if (!person || (person.status === 'accepted' || person.status === 'verifing')) throw new Error('Person not invited')

      const personSystems = await this.personSystemTableService.find({ where: { type: 'person', primaryKey: person.id } }, undefined, transaction)
      const userPartyGroupSystems = await this.partyGroupSystemTableService.find({ where: { id: { [Op.in]: personSystems.map(s => s.systemId) } } }, undefined, transaction)

      const selectedPartyGroupSystems = userPartyGroupSystems.filter(s => s.system === system)
      if (!selectedPartyGroupSystems.length) throw new NotFoundException(`System ${system} not setup for ${username}`)

      const partyGroupCode = selectedPartyGroupSystems[0].partyGroupCode
      const user: JwtPayload = {
        authenticationId: -1,
        authTypeCode: 'local',
        entityType: 'person',
        entityId: person.id,
        customer: partyGroupCode,
        user: person.userName,
        isSuperAdmin: person.isSuperAdmin,
        accessToken: '',
        iat: 0
      }

      let authentication = await this.authenticationTableService.findOne({ where: { username, authTypeCode: 'local' } }, undefined, transaction)
      authentication = await this.authenticationTableService.save({
        id: authentication ? authentication.id : undefined,
        username,
        authTypeCode,
        signupDate: new Date(),
        authenticationRealms: [
          {
            password,
            realmCode: selectedRealmCode,
            realmCodeId,
            realmProfile
          }
        ]
      } as Authentication, undefined, transaction)
      user.authenticationId = authentication.id

      person.status = 'accepted'
      await this.personTableService.save(person, user, transaction)

      this.authenticationTableService.log(system, partyGroupCode, username, selectedRealmCode, extraRequestInformation.ip, true, 'register')
      return {
        ...(await this.generateToken(system, authTypeCode, username, extraRequestInformation, authentication, rememberMe, undefined, undefined, undefined, undefined, undefined, transaction)),
        user: user.user,
        customer: user.customer
      } as any
    }
    catch (e) {
      console.error(e.message, e.stack, 'AuthService')
      this.authenticationTableService.log(system, null, username, selectedRealmCode, extraRequestInformation.ip, false, 'register')
      throw new UnprocessableEntityException('We cannot register an account for you')
    }
  }
}
