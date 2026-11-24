export interface AuthToken {
  access_token: string
  expires_in: number
  refresh_token: string
}

export interface User {
  id: string
  username: string
}

export interface UserContext {
  csrftoken?: string
  userID: string
  username: string
}

export interface ApiError {
  errorCode: string
  message: string
  status: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
}

export interface RefreshRequest {
  refresh_token: string
}

export interface RegisterResponse {
  id: string
  username: string
}
