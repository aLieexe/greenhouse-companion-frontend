import http from './http'
import type {
  AuthToken,
  LoginRequest,
  RefreshRequest,
  RegisterRequest,
  RegisterResponse,
  User,
  UserContext,
} from '../types/api'

export async function login(credentials: LoginRequest): Promise<AuthToken> {
  const { data } = await http.post<AuthToken>('/auth/login', credentials)
  return data
}

export async function register(
  credentials: RegisterRequest,
): Promise<RegisterResponse> {
  const { data } = await http.post<RegisterResponse>(
    '/auth/register',
    credentials,
  )
  return data
}

export async function refresh(request: RefreshRequest): Promise<AuthToken> {
  const { data } = await http.post<AuthToken>('/auth/refresh', request)
  return data
}

export async function logout(): Promise<void> {
  await http.post<void>('/auth/logout')
}

export async function me(): Promise<User> {
  const { data } = await http.get<User>('/me')
  return data
}

export async function check(): Promise<UserContext> {
  const { data } = await http.get<UserContext>('/auth/check')
  return data
}
