import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  login as loginRequest,
  logout as logoutRequest,
  me,
  register as registerRequest,
} from '../api/auth'
import type { AuthToken, RegisterResponse, User } from '../types/api'

const ACCESS_TOKEN_KEY = 'gc_access_token'
const REFRESH_TOKEN_KEY = 'gc_refresh_token'
const EXPIRES_AT_KEY = 'gc_token_expires_at'

function storedExpiresAt(): number | null {
  const value = localStorage.getItem(EXPIRES_AT_KEY)

  if (!value) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY))
  const refreshToken = ref<string | null>(
    localStorage.getItem(REFRESH_TOKEN_KEY),
  )
  const expiresAt = ref<number | null>(storedExpiresAt())
  const user = ref<User | null>(null)

  const isAuthenticated = computed(
    () =>
      !!token.value &&
      (expiresAt.value === null || expiresAt.value > Date.now()),
  )

  function setTokens(tokens: AuthToken) {
    const nextExpiresAt = Date.now() + tokens.expires_in * 1000

    token.value = tokens.access_token
    refreshToken.value = tokens.refresh_token
    expiresAt.value = nextExpiresAt

    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token)
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token)
    localStorage.setItem(EXPIRES_AT_KEY, String(nextExpiresAt))
  }

  async function login(username: string, password: string) {
    const tokens = await loginRequest({ username, password })
    setTokens(tokens)
    await fetchUser()
  }

  async function register(
    username: string,
    password: string,
  ): Promise<RegisterResponse> {
    return registerRequest({ username, password })
  }

  async function fetchUser() {
    user.value = await me()
  }

  async function init() {
    if (!token.value) {
      return
    }

    try {
      await fetchUser()
    } catch {
      // The refresh interceptor handles recoverable failures; boot stays non-blocking.
    }
  }

  async function logout() {
    try {
      await logoutRequest()
    } catch {
      // Clearing the local session must not depend on the request succeeding.
    } finally {
      clearSession()
    }
  }

  function clearSession() {
    token.value = null
    refreshToken.value = null
    expiresAt.value = null
    user.value = null

    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(EXPIRES_AT_KEY)
  }

  return {
    token,
    refreshToken,
    expiresAt,
    user,
    isAuthenticated,
    setTokens,
    login,
    register,
    fetchUser,
    init,
    logout,
    clearSession,
  }
})
