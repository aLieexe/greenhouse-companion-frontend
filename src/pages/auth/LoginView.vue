
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Leaf, Eye, EyeOff, UserRound, LockKeyhole, ArrowRight } from 'lucide-vue-next'

import { getApiError } from '../../api/http'
import { useAuthStore } from '../../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const showPassword = ref(false)
const message = ref('')
const successMessage = ref('')
const loading = ref(false)

onMounted(() => {
  if (route.query.registered === '1') {
    successMessage.value = 'Account created. Sign in to continue.'
  }
})

async function handleLogin() {
  if (loading.value) {
    return
  }

  message.value = ''
  successMessage.value = ''

  if (username.value.length < 5 || username.value.length > 100) {
    message.value = 'Username must be between 5 and 100 characters.'
    return
  }

  if (!password.value) {
    message.value = 'Password is required.'
    return
  }

  loading.value = true

  try {
    await auth.login(username.value, password.value)

    const redirect = route.query.redirect
    const target =
      typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
        ? redirect
        : '/dashboard'

    await router.push(target)
  } catch (err) {
    message.value = getApiError(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="min-h-screen bg-[#f7faf7] flex items-center justify-center p-4 lg:p-8">
    <div class="w-full max-w-6xl min-h-[680px] bg-white rounded-3xl shadow-xl shadow-green-900/5 overflow-hidden grid lg:grid-cols-2">

      <!-- Left: Login Form -->
      <section class="flex flex-col justify-center px-7 py-12 sm:px-12 lg:px-16">

        <RouterLink to="/" class="flex items-center gap-3 w-fit mb-14">
          <div class="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
            <Leaf :size="25" />
          </div>
          <span class="text-xl font-bold tracking-tight text-gray-900">
            Greenhouse<span class="text-emerald-600">.</span>
          </span>
        </RouterLink>

        <div class="max-w-md w-full mx-auto">
          <p class="text-sm font-semibold text-emerald-600 mb-3">
            WELCOME BACK
          </p>

          <h1 class="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
            Welcome back!
          </h1>

          <p class="text-gray-500 mt-3 mb-9">
            Sign in to monitor and manage your smart greenhouse.
          </p>

          <form @submit.prevent="handleLogin" class="space-y-5">
            <p v-if="successMessage" class="text-sm text-emerald-700 bg-emerald-50 rounded-lg p-3">
              {{ successMessage }}
            </p>

            <div>
              <label for="username" class="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>

              <div class="relative">
                <UserRound class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" :size="19" />
                <input
                  id="username"
                  v-model="username"
                  type="text"
                  placeholder="Your username"
                  autocomplete="username"
                  required
                  class="w-full h-12 pl-12 pr-4 rounded-xl border border-gray-200 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition"
                />
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-2">
                <label for="password" class="text-sm font-medium text-gray-700">
                  Password
                </label>
              </div>

              <div class="relative">
                <LockKeyhole class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" :size="19" />
                <input
                  id="password"
                  v-model="password"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Enter your password"
                  required
                  class="w-full h-12 pl-12 pr-12 rounded-xl border border-gray-200 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition"
                />

                <button
                  type="button"
                  @click="showPassword = !showPassword"
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  :aria-label="showPassword ? 'Hide password' : 'Show password'"
                >
                  <EyeOff v-if="showPassword" :size="19" />
                  <Eye v-else :size="19" />
                </button>
              </div>
            </div>

            <button
              type="submit"
              :disabled="loading"
              class="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-600/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <template v-if="loading">
                Signing in...
              </template>
              <template v-else>
                Sign In
                <ArrowRight :size="18" />
              </template>
            </button>

            <p v-if="message" class="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
              {{ message }}
            </p>
          </form>

          <p class="text-sm text-gray-500 text-center mt-8">
            Don't have an account?
            <RouterLink to="/register" class="text-emerald-700 font-semibold hover:text-emerald-800">
              Create account
            </RouterLink>
          </p>
        </div>

        <p class="text-xs text-gray-400 mt-14 text-center">
          © 2026 Greenhouse Companion. All rights reserved.
        </p>
      </section>

      <!-- Right: Branding Panel -->
      <section class="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-emerald-800 via-emerald-700 to-green-600 items-center justify-center p-12">
        <div class="absolute w-96 h-96 rounded-full border border-white/10 -top-32 -right-24"></div>
        <div class="absolute w-72 h-72 rounded-full border border-white/10 -bottom-20 -left-20"></div>

        <div class="relative z-10 max-w-md text-white">
          <div class="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mb-8">
            <Leaf :size="34" />
          </div>

          <p class="text-emerald-100 text-sm font-semibold tracking-[0.2em] mb-4">
            SMART FARMING, SIMPLIFIED
          </p>

          <h2 class="text-4xl xl:text-5xl font-bold leading-tight">
            Grow smarter.
            <span class="text-emerald-200">Live greener.</span>
          </h2>

          <p class="text-emerald-50/80 leading-relaxed mt-6 text-lg">
            Monitor environmental conditions, manage your devices, and keep your greenhouse healthy from anywhere.
          </p>

          <div class="mt-12 grid grid-cols-2 gap-4">
            <div class="rounded-2xl bg-white/10 border border-white/10 p-5 backdrop-blur">
              <p class="text-emerald-100 text-sm">Monitoring</p>
              <p class="font-semibold text-lg mt-1">Real-time data</p>
            </div>
            <div class="rounded-2xl bg-white/10 border border-white/10 p-5 backdrop-blur">
              <p class="text-emerald-100 text-sm">Management</p>
              <p class="font-semibold text-lg mt-1">Smart control</p>
            </div>
          </div>
        </div>
      </section>

    </div>
  </main>
</template>
