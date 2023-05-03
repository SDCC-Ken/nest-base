export interface LoginFormPayload {
  username: string
  password: string
  rememberMe?: boolean
  partyGroupCode?: string
  token?: string
  expiry?: string | number
}

export interface LoginResult {
  authenticationId?: number
  expiry?: string | number
  accessToken?: string
  refreshToken?: string
}
