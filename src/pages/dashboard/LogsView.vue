
<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  Info,
  Search,
  Terminal,
} from 'lucide-vue-next'

type Severity = 'info' | 'warning' | 'error'

interface DeviceLog {
  id: number
  device_id: string
  boot_id: string
  code: string
  message: string
  received_at: string
  severity: Severity
  uptime_s: number
}

interface Device {
  id: string
  name: string
  status: string
}

const devices: Device[] = [
  { id: 'device-001', name: 'Main Unit', status: 'online' },
  { id: 'device-002', name: 'Backup Unit', status: 'offline' },
  { id: 'device-003', name: 'Experimental Unit', status: 'unknown' },
]

const selectedDevice = ref('device-001')
const searchQuery = ref('')
const severityFilter = ref('all')
const codeFilter = ref('all')
const currentPage = ref(1)
const pageSize = 8

// Simulated log data following the backend DeviceLog schema.
const logs = ref<DeviceLog[]>([
  {
    id: 108,
    device_id: 'device-001',
    boot_id: 'boot-a81f20',
    code: 'PUMP_ACTIVATED',
    message: 'Water pump activated because soil moisture reached the configured threshold.',
    received_at: '2026-11-23T14:32:15+07:00',
    severity: 'info',
    uptime_s: 86420,
  },
  {
    id: 107,
    device_id: 'device-001',
    boot_id: 'boot-a81f20',
    code: 'SOIL_MOISTURE_LOW',
    message: 'Soil moisture level dropped below the configured threshold.',
    received_at: '2026-11-23T14:30:42+07:00',
    severity: 'warning',
    uptime_s: 86327,
  },
  {
    id: 106,
    device_id: 'device-001',
    boot_id: 'boot-a81f20',
    code: 'SENSOR_READING',
    message: 'Sensor readings received successfully.',
    received_at: '2026-11-23T14:25:10+07:00',
    severity: 'info',
    uptime_s: 86000,
  },
  {
    id: 105,
    device_id: 'device-001',
    boot_id: 'boot-a81f20',
    code: 'SENSOR_TIMEOUT',
    message: 'Failed to receive a response from the soil temperature sensor.',
    received_at: '2026-11-23T14:20:03+07:00',
    severity: 'error',
    uptime_s: 85700,
  },
  {
    id: 104,
    device_id: 'device-001',
    boot_id: 'boot-a81f20',
    code: 'FAN_ACTIVATED',
    message: 'Cooling fan activated by the automatic control system.',
    received_at: '2026-11-23T14:15:22+07:00',
    severity: 'info',
    uptime_s: 85400,
  },
  {
    id: 103,
    device_id: 'device-001',
    boot_id: 'boot-a81f20',
    code: 'AMBIENT_TEMP_HIGH',
    message: 'Ambient temperature exceeded the configured upper threshold.',
    received_at: '2026-11-23T14:10:45+07:00',
    severity: 'warning',
    uptime_s: 85100,
  },
  {
    id: 102,
    device_id: 'device-001',
    boot_id: 'boot-a81f20',
    code: 'DEVICE_CONNECTED',
    message: 'Device successfully connected to the greenhouse system.',
    received_at: '2026-11-23T13:55:00+07:00',
    severity: 'info',
    uptime_s: 84200,
  },
  {
    id: 101,
    device_id: 'device-001',
    boot_id: 'boot-a81f20',
    code: 'CONFIG_UPDATED',
    message: 'Device configuration was updated successfully.',
    received_at: '2026-11-23T13:40:18+07:00',
    severity: 'info',
    uptime_s: 83300,
  },
  {
    id: 100,
    device_id: 'device-001',
    boot_id: 'boot-91c420',
    code: 'DEVICE_RESTARTED',
    message: 'Device restarted and started a new boot session.',
    received_at: '2026-11-23T12:30:00+07:00',
    severity: 'warning',
    uptime_s: 0,
  },
  {
    id: 99,
    device_id: 'device-001',
    boot_id: 'boot-91c420',
    code: 'DEVICE_CONNECTED',
    message: 'Device connection established.',
    received_at: '2026-11-23T12:30:08+07:00',
    severity: 'info',
    uptime_s: 8,
  },
  {
    id: 98,
    device_id: 'device-001',
    boot_id: 'boot-91c420',
    code: 'SENSOR_READING',
    message: 'All sensor readings received successfully.',
    received_at: '2026-11-23T12:35:00+07:00',
    severity: 'info',
    uptime_s: 300,
  },
  {
    id: 97,
    device_id: 'device-001',
    boot_id: 'boot-91c420',
    code: 'PUMP_ACTIVATED',
    message: 'Water pump activated by automatic irrigation.',
    received_at: '2026-11-23T12:40:12+07:00',
    severity: 'info',
    uptime_s: 612,
  },
  {
    id: 96,
    device_id: 'device-001',
    boot_id: 'boot-91c420',
    code: 'NETWORK_WARNING',
    message: 'Temporary network interruption detected.',
    received_at: '2026-11-23T12:45:00+07:00',
    severity: 'warning',
    uptime_s: 900,
  },
  {
    id: 95,
    device_id: 'device-001',
    boot_id: 'boot-91c420',
    code: 'SENSOR_READING',
    message: 'Sensor readings received successfully.',
    received_at: '2026-11-23T12:50:00+07:00',
    severity: 'info',
    uptime_s: 1200,
  },
  {
    id: 94,
    device_id: 'device-001',
    boot_id: 'boot-91c420',
    code: 'FAN_ACTIVATED',
    message: 'Cooling fan activated.',
    received_at: '2026-11-23T12:55:00+07:00',
    severity: 'info',
    uptime_s: 1500,
  },
])

const deviceLogs = computed(() =>
  logs.value.filter((log) => log.device_id === selectedDevice.value),
)

const filteredLogs = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return deviceLogs.value.filter((log) => {
    const matchesSearch =
      !query ||
      log.message.toLowerCase().includes(query) ||
      log.code.toLowerCase().includes(query) ||
      log.boot_id.toLowerCase().includes(query)

    const matchesSeverity =
      severityFilter.value === 'all' ||
      log.severity === severityFilter.value

    const matchesCode =
      codeFilter.value === 'all' ||
      log.code === codeFilter.value

    return matchesSearch && matchesSeverity && matchesCode
  })
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredLogs.value.length / pageSize)),
)

const paginatedLogs = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredLogs.value.slice(start, start + pageSize)
})

const totalLogs = computed(() => deviceLogs.value.length)

const infoCount = computed(
  () => deviceLogs.value.filter((log) => log.severity === 'info').length,
)

const warningCount = computed(
  () => deviceLogs.value.filter((log) => log.severity === 'warning').length,
)

const errorCount = computed(
  () => deviceLogs.value.filter((log) => log.severity === 'error').length,
)

const availableCodes = computed(() => [
  ...new Set(deviceLogs.value.map((log) => log.code)),
])

const selectedDeviceName = computed(
  () =>
    devices.find((device) => device.id === selectedDevice.value)?.name ??
    'Unknown Device',
)

const firstItem = computed(() =>
  filteredLogs.value.length === 0
    ? 0
    : (currentPage.value - 1) * pageSize + 1,
)

const lastItem = computed(() =>
  Math.min(currentPage.value * pageSize, filteredLogs.value.length),
)

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value))
}

function formatUptime(seconds: number) {
  if (seconds === 0) return '0s'

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainingSeconds = seconds % 60

  const parts = []
  if (days) parts.push(`${days}d`)
  if (hours) parts.push(`${hours}h`)
  if (minutes) parts.push(`${minutes}m`)
  if (remainingSeconds && parts.length < 2) {
    parts.push(`${remainingSeconds}s`)
  }

  return parts.join(' ') || '0s'
}

function severityClass(severity: Severity) {
  const classes: Record<Severity, string> = {
    info: 'bg-blue-50 text-blue-700 ring-blue-200',
    warning: 'bg-amber-50 text-amber-700 ring-amber-200',
    error: 'bg-red-50 text-red-700 ring-red-200',
  }

  return classes[severity]
}

function resetFilters() {
  searchQuery.value = ''
  severityFilter.value = 'all'
  codeFilter.value = 'all'
  currentPage.value = 1
}

function changePage(page: number) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
}

function handleFilterChange() {
  currentPage.value = 1
}
</script>

<template>
  <div class="space-y-6">
    <!-- Page Introduction -->
    <section class="mb-8">
      <h3 class="text-2xl font-bold text-gray-900">
        Logs & History
      </h3>

      <p class="mt-1 text-sm text-gray-500">
        Review device events, system messages, and operational history.
      </p>
    </section>

    <!-- Summary cards -->
    <section class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-gray-500">Total Logs</p>
          <div class="rounded-lg bg-gray-100 p-2 text-gray-600">
            <Terminal class="h-5 w-5" />
          </div>
        </div>
        <p class="mt-4 text-3xl font-bold text-gray-900">{{ totalLogs }}</p>
        <p class="mt-1 text-xs text-gray-500">Recorded device events</p>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-gray-500">Information</p>
          <div class="rounded-lg bg-blue-50 p-2 text-blue-600">
            <Info class="h-5 w-5" />
          </div>
        </div>
        <p class="mt-4 text-3xl font-bold text-gray-900">{{ infoCount }}</p>
        <p class="mt-1 text-xs text-gray-500">Normal system events</p>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-gray-500">Warnings</p>
          <div class="rounded-lg bg-amber-50 p-2 text-amber-600">
            <AlertTriangle class="h-5 w-5" />
          </div>
        </div>
        <p class="mt-4 text-3xl font-bold text-gray-900">{{ warningCount }}</p>
        <p class="mt-1 text-xs text-gray-500">Events requiring attention</p>
      </div>

      <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-gray-500">Errors</p>
          <div class="rounded-lg bg-red-50 p-2 text-red-600">
            <AlertCircle class="h-5 w-5" />
          </div>
        </div>
        <p class="mt-4 text-3xl font-bold text-gray-900">{{ errorCount }}</p>
        <p class="mt-1 text-xs text-gray-500">Detected system errors</p>
      </div>
    </section>

    <!-- Logs table -->
    <section class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div class="border-b border-gray-200 p-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 class="text-base font-semibold text-gray-900">
              Activity History
            </h2>
            <p class="mt-1 text-sm text-gray-500">
              Showing logs for {{ selectedDeviceName }}
            </p>
          </div>

          <div class="flex flex-col gap-2 sm:flex-row">
            <div class="relative">
              <Search class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                v-model="searchQuery"
                @input="handleFilterChange"
                type="text"
                placeholder="Search logs..."
                class="w-full rounded-lg border border-gray-300 py-2.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-52"
              />
            </div>

            <div class="relative">
              <Filter class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <select
                v-model="severityFilter"
                @change="handleFilterChange"
                class="w-full appearance-none rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-8 text-sm text-gray-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-36"
              >
                <option value="all">All Severity</option>
                <option value="info">Information</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>

            <select
              v-model="codeFilter"
              @change="handleFilterChange"
              class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-48"
            >
              <option value="all">All Log Codes</option>
              <option
                v-for="code in availableCodes"
                :key="code"
                :value="code"
              >
                {{ code }}
              </option>
            </select>

            <button
              @click="resetFilters"
              class="rounded-lg border border-gray-300 px-3 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <!-- Table -->
      <div class="overflow-x-auto">
        <table class="w-full min-w-[900px] text-left">
          <thead class="bg-gray-50">
            <tr class="border-b border-gray-200">
              <th class="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Event
              </th>
              <th class="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Severity
              </th>
              <th class="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Log Code
              </th>
              <th class="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Boot ID
              </th>
              <th class="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Uptime
              </th>
              <th class="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Received At
              </th>
            </tr>
          </thead>

          <tbody class="divide-y divide-gray-100">
            <tr
              v-for="log in paginatedLogs"
              :key="log.id"
              class="transition hover:bg-gray-50"
            >
              <td class="max-w-md px-5 py-4">
                <p class="text-sm font-medium text-gray-900">
                  {{ log.message }}
                </p>
                <p class="mt-1 text-xs text-gray-400">
                  Log ID: #{{ log.id }}
                </p>
              </td>

              <td class="px-5 py-4">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset"
                  :class="severityClass(log.severity)"
                >
                  <span
                    class="h-1.5 w-1.5 rounded-full"
                    :class="{
                      'bg-blue-500': log.severity === 'info',
                      'bg-amber-500': log.severity === 'warning',
                      'bg-red-500': log.severity === 'error',
                    }"
                  />
                  {{ log.severity }}
                </span>
              </td>

              <td class="px-5 py-4">
                <span class="rounded-md bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700">
                  {{ log.code }}
                </span>
              </td>

              <td class="px-5 py-4">
                <span class="font-mono text-xs text-gray-500">
                  {{ log.boot_id }}
                </span>
              </td>

              <td class="px-5 py-4">
                <span class="text-sm text-gray-600">
                  {{ formatUptime(log.uptime_s) }}
                </span>
              </td>

              <td class="px-5 py-4">
                <div class="flex items-center gap-2 whitespace-nowrap text-sm text-gray-600">
                  <Clock3 class="h-4 w-4 text-gray-400" />
                  {{ formatDate(log.received_at) }}
                </div>
              </td>
            </tr>

            <tr v-if="paginatedLogs.length === 0">
              <td colspan="6" class="px-5 py-16 text-center">
                <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                  <Search class="h-5 w-5" />
                </div>
                <p class="mt-3 text-sm font-semibold text-gray-900">
                  No logs found
                </p>
                <p class="mt-1 text-sm text-gray-500">
                  Try changing your search query or filters.
                </p>
                <button
                  @click="resetFilters"
                  class="mt-4 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  Clear all filters
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-sm text-gray-500">
          Showing
          <span class="font-semibold text-gray-800">{{ firstItem }}</span>
          to
          <span class="font-semibold text-gray-800">{{ lastItem }}</span>
          of
          <span class="font-semibold text-gray-800">{{ filteredLogs.length }}</span>
          results
        </p>

        <div class="flex items-center gap-2">
          <button
            @click="changePage(currentPage - 1)"
            :disabled="currentPage === 1"
            class="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft class="h-4 w-4" />
            Previous
          </button>

          <span class="px-2 text-sm text-gray-600">
            Page {{ currentPage }} of {{ totalPages }}
          </span>

          <button
            @click="changePage(currentPage + 1)"
            :disabled="currentPage === totalPages"
            class="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight class="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>

    <!-- Footer note -->
    <div class="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
      <CheckCircle2 class="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Log records are displayed in a simulated environment. Live device logs
        will be loaded from the backend API after integration.
      </p>
    </div>
  </div>
</template>
