
<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { Leaf, LogOut } from 'lucide-vue-next'

import { useAuthStore } from '../stores/auth'

const router = useRouter()
const auth = useAuthStore()

const signingOut = ref(false)

const initials = computed(() =>
  auth.user?.username ? auth.user.username.slice(0, 2).toUpperCase() : 'GC',
)

async function handleSignOut() {
  if (signingOut.value) {
    return
  }

  signingOut.value = true

  try {
    await auth.logout()
  } finally {
    signingOut.value = false
    await router.push('/login')
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">

    <!-- Header -->
    <header class="flex h-20 items-center justify-between border-b border-gray-200 bg-white px-5 sm:px-8">
      <RouterLink to="/devices" class="flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
          <Leaf :size="22" />
        </div>

        <div>
          <h1 class="text-lg font-bold text-gray-900">Greenhouse.</h1>
          <p class="text-xs text-gray-400">Companion Dashboard</p>
        </div>
      </RouterLink>

      <div class="flex items-center gap-4">
        <div class="hidden h-9 w-px bg-gray-200 sm:block" />

        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
            {{ initials }}
          </div>

          <div class="hidden text-left sm:block">
            <p class="text-sm font-semibold text-gray-800">
              {{ auth.user?.username ?? 'User' }}
            </p>
            <p class="text-xs text-gray-400">Greenhouse Owner</p>
          </div>
        </div>

        <button
          type="button"
          @click="handleSignOut"
          :disabled="signingOut"
          class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-gray-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut :size="18" />
          <span class="hidden sm:inline">
            {{ signingOut ? 'Signing out...' : 'Sign Out' }}
          </span>
        </button>
      </div>
    </header>

    <!-- Page Content -->
    <main class="p-5 sm:p-8">
      <RouterView />
    </main>

  </div>
</template>
