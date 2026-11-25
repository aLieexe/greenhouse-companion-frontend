<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Filter,
  RefreshCw,
  Search,
} from 'lucide-vue-next'

import { getApiError } from '../../api/http'
import { listLogs } from '../../api/logs'
import { useDevicesStore } from '../../stores/devices'
import type { DeviceLog } from '../../types/api'

const route = useRoute()
const store = useDevicesStore()
const deviceId = computed(() => String(route.params.deviceId ?? ''))
const deviceName = computed(
  () => store.deviceById(deviceId.value)?.name ?? 'Unknown Device',
)

interface LogFilter {
  bootId: string
  severity: string
  uptime: string
  code: string
}

interface LogQuery {
  boot_id?: string
  severity?: string
  uptime_s?: number
  code?: string
}

const PAGE_SIZES = [10, 20, 50, 100]
const filterClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none transition placeholder:text-gray-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

function emptyFilter(): LogFilter {
  return { bootId: '', severity: '', uptime: '', code: '' }
}

const filter = ref<LogFilter>(emptyFilter())
const filterError = ref('')

const logs = ref<DeviceLog[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const error = ref('')
let requestId = 0

const totalPages = computed(() =>
  Math.max(1, Math.ceil(total.value / pageSize.value)),
)

const firstItem = computed(() =>
  total.value === 0 ? 0 : (page.value - 1) * pageSize.value + 1,
)

const lastItem = computed(() =>
  Math.min(page.value * pageSize.value, total.value),
)

function parseUptime(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

function queryFromFilter(): LogQuery | null {
  const params: LogQuery = {}

  const bootId = filter.value.bootId.trim()
  if (bootId) params.boot_id = bootId

  const severity = filter.value.severity.trim()
  if (severity) params.severity = severity

  const uptime = parseUptime(filter.value.uptime)
  if (uptime === null && filter.value.uptime.trim()) {
    filterError.value = 'Uptime must be a non-negative integer'
    return null
  }
  if (uptime !== null) params.uptime_s = uptime

  const code = filter.value.code.trim()
  if (code) params.code = code

  filterError.value = ''
  return params
}

function isCurrentRequest(id: string, currentRequest: number) {
  return id === deviceId.value && currentRequest === requestId
}

async function loadLogs() {
  const params = queryFromFilter()
  if (!params) return

  const id = deviceId.value
  const currentRequest = ++requestId
  const requestedPage = page.value
  const limit = pageSize.value

  loading.value = true
  error.value = ''

  try {
    const response = await listLogs(id, {
      page: requestedPage,
      limit,
      ...params,
    })
    if (!isCurrentRequest(id, currentRequest)) return

    logs.value = response.logs
    total.value = response.total_count
  } catch (err) {
    if (!isCurrentRequest(id, currentRequest)) return
    logs.value = []
    total.value = 0
    error.value = getApiError(err)
  } finally {
    if (isCurrentRequest(id, currentRequest)) loading.value = false
  }
}

function applyFilters() {
  page.value = 1
  void loadLogs()
}

function resetFilters() {
  filter.value = emptyFilter()
  filterError.value = ''
  page.value = 1
  void loadLogs()
}

function changePage(nextPage: number) {
  if (nextPage < 1 || nextPage > totalPages.value || loading.value) return
  page.value = nextPage
  void loadLogs()
}

function changePageSize() {
  page.value = 1
  void loadLogs()
}

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

const severityStyles: Record<string, string> = {
  info: 'bg-blue-50 text-blue-700 ring-blue-200',
  information: 'bg-blue-50 text-blue-700 ring-blue-200',
  warn: 'bg-amber-50 text-amber-700 ring-amber-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  error: 'bg-red-50 text-red-700 ring-red-200',
  err: 'bg-red-50 text-red-700 ring-red-200',
}

const severityDots: Record<string, string> = {
  info: 'bg-blue-500',
  information: 'bg-blue-500',
  warn: 'bg-amber-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  err: 'bg-red-500',
}

function severityClass(severity: string) {
  return (
    severityStyles[severity.toLowerCase()] ??
    'bg-gray-100 text-gray-600 ring-gray-200'
  )
}

function severityDotClass(severity: string) {
  return severityDots[severity.toLowerCase()] ?? 'bg-gray-400'
}

onMounted(() => {
  void loadLogs()
})

watch(deviceId, () => {
  requestId++
  logs.value = []
  total.value = 0
  error.value = ''
  loading.value = false
  page.value = 1
  void loadLogs()
})
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

    <section
      v-if="error"
      class="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center"
    >
      <AlertCircle :size="28" class="mx-auto text-rose-600" />
      <p class="mt-3 text-sm font-semibold text-rose-800">
        Unable to load logs
      </p>
      <p class="mt-1 text-sm text-rose-700">
        {{ error }}
      </p>
      <button
        type="button"
        @click="loadLogs"
        class="mt-4 inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700"
      >
        <RefreshCw :size="16" />
        Retry
      </button>
    </section>

    <!-- Logs table -->
    <section
      v-else
      class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
    >
      <div class="border-b border-gray-200 p-5">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 class="text-base font-semibold text-gray-900">
              Activity History
            </h2>
            <p class="mt-1 text-sm text-gray-500">
              Showing logs for {{ deviceName }}
            </p>
          </div>

          <div class="flex items-center gap-2">
            <Filter class="h-4 w-4 text-gray-400" />
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Filters
            </span>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label class="block">
            <span class="mb-1 block text-xs font-medium text-gray-500">Boot ID</span>
            <input
              v-model="filter.bootId"
              type="text"
              placeholder="e.g. boot-a81f20"
              :class="filterClass"
              @keyup.enter="applyFilters"
            />
          </label>

          <label class="block">
            <span class="mb-1 block text-xs font-medium text-gray-500">Severity</span>
            <input
              v-model="filter.severity"
              type="text"
              placeholder="e.g. WARN"
              :class="filterClass"
              @keyup.enter="applyFilters"
            />
          </label>

          <label class="block">
            <span class="mb-1 block text-xs font-medium text-gray-500">Uptime (s)</span>
            <input
              v-model="filter.uptime"
              type="number"
              min="0"
              step="1"
              placeholder="e.g. 120"
              :class="filterClass"
              @keyup.enter="applyFilters"
            />
          </label>

          <label class="block">
            <span class="mb-1 block text-xs font-medium text-gray-500">Log Code</span>
            <input
              v-model="filter.code"
              type="text"
              placeholder="e.g. SENSOR_TIMEOUT"
              :class="filterClass"
              @keyup.enter="applyFilters"
            />
          </label>
        </div>

        <p v-if="filterError" class="mt-2 text-xs text-rose-600">
          {{ filterError }}
        </p>

        <div class="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            @click="applyFilters"
            class="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Apply
          </button>
          <button
            type="button"
            @click="resetFilters"
            class="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            Reset
          </button>
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
            <tr v-if="loading">
              <td colspan="6" class="px-5 py-16 text-center text-sm text-gray-500">
                <div class="flex items-center justify-center gap-2">
                  <RefreshCw class="h-5 w-5 animate-spin text-emerald-600" />
                  Loading logs...
                </div>
              </td>
            </tr>

            <template v-else>
              <tr
                v-for="log in logs"
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
                    class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset"
                    :class="severityClass(log.severity)"
                  >
                    <span
                      class="h-1.5 w-1.5 rounded-full"
                      :class="severityDotClass(log.severity)"
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

              <tr v-if="logs.length === 0">
                <td colspan="6" class="px-5 py-16 text-center">
                  <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                    <Search class="h-5 w-5" />
                  </div>
                  <p class="mt-3 text-sm font-semibold text-gray-900">
                    No logs found
                  </p>
                  <p class="mt-1 text-sm text-gray-500">
                    Try changing your filters.
                  </p>
                  <button
                    type="button"
                    @click="resetFilters"
                    class="mt-4 text-sm font-semibold text-emerald-700 hover:text-emerald-800"
                  >
                    Clear all filters
                  </button>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="flex flex-col gap-3 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap items-center gap-3">
          <p class="text-sm text-gray-500">
            Showing
            <span class="font-semibold text-gray-800">{{ firstItem }}</span>
            to
            <span class="font-semibold text-gray-800">{{ lastItem }}</span>
            of
            <span class="font-semibold text-gray-800">{{ total }}</span>
            results
          </p>

          <label class="flex items-center gap-2 text-xs text-gray-500">
            Rows per page
            <select
              v-model.number="pageSize"
              @change="changePageSize"
              class="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option v-for="size in PAGE_SIZES" :key="size" :value="size">
                {{ size }}
              </option>
            </select>
          </label>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="changePage(page - 1)"
            :disabled="page <= 1 || loading"
            class="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft class="h-4 w-4" />
            Previous
          </button>

          <span class="px-2 text-sm text-gray-600">
            Page {{ page }} of {{ totalPages }}
          </span>

          <button
            type="button"
            @click="changePage(page + 1)"
            :disabled="page >= totalPages || loading"
            class="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight class="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
