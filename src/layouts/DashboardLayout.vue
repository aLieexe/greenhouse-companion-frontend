
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter, RouterLink, RouterView } from 'vue-router'

import { useAuthStore } from '../stores/auth'
import { useDevicesStore } from '../stores/devices'

import {
  Activity,
  ChevronRight,
  Cpu,
  LayoutDashboard,
  Leaf,
  LogOut,
  Settings,
  SlidersHorizontal,
  Users,
  ScrollText,
} from 'lucide-vue-next'

const route = useRoute()
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

const devicesStore = useDevicesStore()

const deviceId = computed(() => String(route.params.deviceId ?? ''))
const deviceName = computed(
  () => devicesStore.deviceById(deviceId.value)?.name ?? 'Greenhouse',
)

const navigation = computed(() => [
  { name: 'Dashboard', path: `/${deviceId.value}/dashboard`, icon: LayoutDashboard },
  { name: 'Monitoring', path: `/${deviceId.value}/monitoring`, icon: Activity },
  { name: 'Device Control', path: `/${deviceId.value}/device-control`, icon: SlidersHorizontal },
  { name: 'Configuration', path: `/${deviceId.value}/configuration`, icon: Settings },
  { name: 'Members', path: `/${deviceId.value}/members`, icon: Users },
  { name: 'Logs & History', path: `/${deviceId.value}/logs`, icon: ScrollText },
])
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-gray-50">

    <!-- Sidebar -->
    <aside class="hidden w-64 shrink-0 border-r border-gray-200 bg-white lg:flex lg:flex-col">

      <!-- Logo -->
      <div class="flex h-20 items-center gap-3 border-b border-gray-100 px-6">
        <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
          <Leaf :size="22" />
        </div>

        <div>
          <h1 class="text-lg font-bold text-gray-900">Greenhouse.</h1>
          <p class="text-xs text-gray-400">Companion Dashboard</p>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 space-y-1 px-4 py-6">
        <p class="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          Main Menu
        </p>

        <RouterLink
          v-for="item in navigation"
          :key="item.path"
          :to="item.path"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition"
          :class="route.path === item.path
            ? 'bg-emerald-50 text-emerald-700'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'"
        >
          <component :is="item.icon" :size="19" />
          <span>{{ item.name }}</span>

          <span
            v-if="route.path === item.path"
            class="ml-auto h-2 w-2 rounded-full bg-emerald-600"
          />
        </RouterLink>
      </nav>

      <!-- Devices back-link and Sidebar Footer -->
      <div class="space-y-1 border-t border-gray-100 p-4">
        <RouterLink
          to="/devices"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-500 transition hover:bg-gray-50 hover:text-gray-800"
        >
          <Cpu :size="19" />
          <span>Devices</span>
        </RouterLink>

        <div class="border-t border-gray-100" />

        <button
          type="button"
          @click="handleSignOut"
          :disabled="signingOut"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-gray-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut :size="19" />
          <span>{{ signingOut ? 'Signing out...' : 'Sign Out' }}</span>
        </button>
      </div>
    </aside>

    <!-- Main Content -->
    <div class="flex min-w-0 flex-1 flex-col">

      <!-- Header -->
      <header class="flex h-20 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-5 sm:px-8">
        <div class="flex items-center">
          <nav class="flex items-center gap-2 text-sm">
            <RouterLink
              to="/devices"
              class="text-gray-500 transition hover:text-emerald-700"
            >
              devices
            </RouterLink>
            <ChevronRight :size="14" class="text-gray-400" />
            <span class="font-medium text-gray-900">
              {{ deviceName }}
            </span>
          </nav>
        </div>

        <button type="button" class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">
            {{ initials }}
          </div>

          <p class="hidden text-sm font-semibold text-gray-800 sm:block">
            {{ auth.user?.username ?? 'User' }}
          </p>
        </button>
      </header>

      <!-- Page Content -->
      <main class="flex-1 overflow-y-auto p-5 sm:p-8">
        <RouterView />
      </main>

    </div>
  </div>
</template>
