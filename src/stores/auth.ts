import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  check as checkRequest,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from '../api/auth'
import type { RegisterResponse, User, UserContext } from '../types/api'

let initPromise: Promise<void> | null = null

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const ready = ref(false)

  const isAuthenticated = computed(() => user.value !== null)

  function applyContext(context: UserContext) {
    user.value = {
      id: context.UserID,
      username: context.Username,
    }
  }

  function init(): Promise<void> {
    if (ready.value) {
      return Promise.resolve()
    }

    if (!initPromise) {
      initPromise = (async () => {
        try {
          applyContext(await checkRequest())
        } catch {
          // The interceptor already tried a refresh and cleared the session.
        } finally {
          ready.value = true
        }
      })().finally(() => {
        initPromise = null
      })
    }

    return initPromise
  }

  async function login(username: string, password: string) {
    await loginRequest({ username, password })
    applyContext(await checkRequest())
    ready.value = true
  }

  async function register(
    username: string,
    password: string,
  ): Promise<RegisterResponse> {
    return registerRequest({ username, password })
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
    user.value = null
  }

  return {
    user,
    ready,
    isAuthenticated,
    init,
    login,
    register,
    logout,
    clearSession,
  }
})
