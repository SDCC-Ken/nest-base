export interface RegisterFormPayload {
  authType: 'user' | 'api'
  realmCode: 'google' | 'local' | 'wechat'
  username: string
  password: string
  confirmPassword: string
  rememberMe?: boolean
  realmId?: string
  firstName?: string
  lastName?: string
  displayName?: string
  email?: string
  photoURL?: string
  token: string
}
