import axios, { type InternalAxiosRequestConfig } from 'axios'

import { useAuthStore } from '../stores/auth'
import type { ApiError, AuthToken } from '../types/api'

const baseURL = import.meta.env.DEV
  ? ''
  : import.meta.env.VITE_API_BASE_URL ||
    'https://greenhouse-be.alieexe.my.id'

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

const http = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
})

let refreshPromise: Promise<AuthToken> | null = null

function redirectToLogin() {
  if (window.location.pathname !== '/login') {
    window.location.assign('/login')
  }
}

http.interceptors.request.use((config) => {
  const auth = useAuthStore()

  if (auth.token) {
    config.headers.Authorization = `Bearer ${auth.token}`
  }

  return config
})

http.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error)
    }

    const originalRequest = error.config as RetryableConfig | undefined

    if (
      !originalRequest ||
      error.response?.status !== 401 ||
      originalRequest._retry ||
      (originalRequest.url ?? '').startsWith('/auth/')
    ) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    const auth = useAuthStore()

    if (!auth.refreshToken) {
      auth.clearSession()
      redirectToLogin()
      return Promise.reject(error)
    }

    if (!refreshPromise) {
      refreshPromise = axios
        .post<AuthToken>(`${baseURL}/auth/refresh`, {
          refresh_token: auth.refreshToken,
        })
        .then((response) => response.data)
        .finally(() => {
          refreshPromise = null
        })
    }

    try {
      const tokens = await refreshPromise
      auth.setTokens(tokens)
      originalRequest.headers.Authorization = `Bearer ${tokens.access_token}`
      return http(originalRequest)
    } catch (refreshError) {
      auth.clearSession()
      redirectToLogin()
      return Promise.reject(refreshError)
    }
  },
)

export function getApiError(err: unknown): string {
  if (err && typeof err === 'object') {
    const error = err as {
      response?: { data?: Partial<ApiError> }
      message?: unknown
    }
    const message = error.response?.data?.message

    if (typeof message === 'string' && message) {
      return message
    }

    if (typeof error.message === 'string' && error.message) {
      return error.message
    }
  }

  return 'Something went wrong. Please try again.'
}

export default http
