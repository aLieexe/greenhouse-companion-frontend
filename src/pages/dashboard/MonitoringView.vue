<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import SensorChart from '../../components/dashboard/SensorChart.vue'

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Droplets,
  RefreshCw,
  Sprout,
  Thermometer,
} from 'lucide-vue-next'

import { getApiError } from '../../api/http'
import { listTelemetry } from '../../api/telemetry'
import { useTelemetrySocket } from '../../composables/useTelemetrySocket'
import type { Telemetry } from '../../types/api'

const route = useRoute()
const deviceId = computed(() => String(route.params.deviceId ?? ''))

// Sensor definitions
const sensorList = [
  {
    key: 'ambient_temp_c',
    title: 'Ambient Temperature',
    label: 'Ambient Temperature',
    unit: '°C',
    icon: Thermometer,
    color: '#059669',
    description: 'Temperature of the surrounding air',
  },
  {
    key: 'ambient_humidity',
    title: 'Ambient Humidity',
    label: 'Ambient Humidity',
    unit: '%',
    icon: Droplets,
    color: '#0ea5e9',
    description: 'Humidity level of the surrounding air',
  },
  {
    key: 'soil_temp_c',
    title: 'Soil Temperature',
    label: 'Soil Temperature',
    unit: '°C',
    icon: Thermometer,
    color: '#f59e0b',
    description: 'Temperature measured in the soil',
  },
  {
    key: 'soil_moisture',
    title: 'Soil Moisture',
    label: 'Soil Moisture',
    unit: '%',
    icon: Sprout,
    color: '#8b5cf6',
    description: 'Moisture level measured in the soil',
  },
] as const

type SensorKey = typeof sensorList[number]['key']
type TimeRange = '1h' | '6h' | '24h' | '7d'

interface TelemetryFilter {
  bootId: string
  seqFrom: string
  seqTo: string
  receivedFrom: string
  receivedTo: string
}

interface TelemetryFilterParams {
  boot_id?: string
  seq_from?: number
  seq_to?: number
  received_from?: string
  received_to?: string
}

const selectedSensor = ref<SensorKey>('ambient_temp_c')
const activePreset = ref<TimeRange | null>('1h')
const chartPoints = ref(100)

const timeRanges: { label: string; value: TimeRange }[] = [
  { label: '1 Hour', value: '1h' },
  { label: '6 Hours', value: '6h' },
  { label: '24 Hours', value: '24h' },
  { label: '7 Days', value: '7d' },
]

const RANGE_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
}
const LIMIT = 100
const CHART_POINT_COUNTS = [20, 50, 100]
const PAGE_SIZES = [10, 20, 50, 100]
const CSV_HEADERS = [
  'received_at',
  'boot_id',
  'seq',
  'ambient_temp_c',
  'ambient_humidity',
  'soil_temp_c',
  'soil_moisture',
]

const filterInputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'

function emptyFilter(): TelemetryFilter {
  return { bootId: '', seqFrom: '', seqTo: '', receivedFrom: '', receivedTo: '' }
}

const filter = ref<TelemetryFilter>(emptyFilter())
const filterError = ref('')

function toLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseSeq(value: string) {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

function parseDate(value: string) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function toIso(value: string) {
  const date = parseDate(value)
  return date ? date.toISOString() : undefined
}

const telemetryFilterParams = computed<TelemetryFilterParams>(() => {
  const params: TelemetryFilterParams = {}

  const bootId = filter.value.bootId.trim()
  if (bootId) params.boot_id = bootId

  const seqFrom = parseSeq(filter.value.seqFrom)
  if (seqFrom !== null) params.seq_from = seqFrom

  const seqTo = parseSeq(filter.value.seqTo)
  if (seqTo !== null) params.seq_to = seqTo

  const receivedFrom = toIso(filter.value.receivedFrom)
  if (receivedFrom) params.received_from = receivedFrom

  const receivedTo = toIso(filter.value.receivedTo)
  if (receivedTo) params.received_to = receivedTo

  return params
})

function validateFilters() {
  const seqFrom = parseSeq(filter.value.seqFrom)
  const seqTo = parseSeq(filter.value.seqTo)

  if (seqFrom === null && filter.value.seqFrom.trim()) {
    filterError.value = 'Seq From must be a non-negative integer'
    return false
  }

  if (seqTo === null && filter.value.seqTo.trim()) {
    filterError.value = 'Seq To must be a non-negative integer'
    return false
  }

  if (seqFrom !== null && seqTo !== null && seqTo < seqFrom) {
    filterError.value = 'Seq To must be greater than or equal to Seq From'
    return false
  }

  const receivedFrom = parseDate(filter.value.receivedFrom)
  const receivedTo = parseDate(filter.value.receivedTo)
  if (receivedFrom && receivedTo && receivedTo < receivedFrom) {
    filterError.value = 'Received To must not be earlier than Received From'
    return false
  }

  filterError.value = ''
  return true
}

const activeSensor = computed(() => {
  return sensorList.find((sensor) => sensor.key === selectedSensor.value)!
})

const { latest } = useTelemetrySocket(deviceId)

const history = ref<Telemetry[]>([])
const historyTotal = ref(0)
const historyLoading = ref(false)
const historyError = ref('')
let historyRequestId = 0

const tableRows = ref<Telemetry[]>([])
const tableTotal = ref(0)
const tablePage = ref(1)
const tablePageSize = ref(20)
const tableLoading = ref(false)
const tableError = ref('')
let tableRequestId = 0

const exportLoading = ref(false)
const exportProgress = ref('')
const exportError = ref('')

const tableTotalPages = computed(() =>
  Math.max(1, Math.ceil(tableTotal.value / tablePageSize.value)),
)

function isCurrentHistory(id: string, requestId: number) {
  return id === deviceId.value && requestId === historyRequestId
}

function isCurrentTable(id: string, requestId: number) {
  return id === deviceId.value && requestId === tableRequestId
}

function compareRows(a: Telemetry, b: Telemetry) {
  const byTime = new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
  return byTime !== 0 ? byTime : a.seq - b.seq
}

const sortedHistory = computed(() => [...history.value].sort(compareRows))

// Ordering is undocumented; infer it from page 1 before choosing which pages hold the newest rows.
async function loadHistory() {
  const id = deviceId.value
  const params = { ...telemetryFilterParams.value }
  const limit = chartPoints.value
  const requestId = ++historyRequestId

  historyLoading.value = true
  historyError.value = ''

  try {
    const first = await listTelemetry(id, { page: 1, limit, ...params })
    if (!isCurrentHistory(id, requestId)) return

    historyTotal.value = first.total_count
    let rows = first.telemetry

    if (
      first.total_count > limit &&
      rows.length > 1 &&
      compareRows(rows[0], rows[rows.length - 1]) < 0
    ) {
      const lastPage = Math.ceil(first.total_count / limit)
      const pages = [lastPage]
      if (rows.length < limit && lastPage > 1) pages.push(lastPage - 1)

      const olderPages = await Promise.all(
        pages.map((page) => listTelemetry(id, { page, limit, ...params })),
      )
      if (!isCurrentHistory(id, requestId)) return
      rows = [...rows, ...olderPages.flatMap((response) => response.telemetry)]
    }

    const deduped = new Map<string, Telemetry>()
    for (const row of rows) deduped.set(`${row.boot_id}:${row.seq}`, row)

    history.value = [...deduped.values()].sort(compareRows).slice(-limit)
  } catch (err) {
    if (!isCurrentHistory(id, requestId)) return
    history.value = []
    historyTotal.value = 0
    historyError.value = getApiError(err)
  } finally {
    if (isCurrentHistory(id, requestId)) historyLoading.value = false
  }
}

async function loadTable() {
  const id = deviceId.value
  const requestId = ++tableRequestId
  const page = tablePage.value
  const limit = tablePageSize.value

  tableLoading.value = true
  tableError.value = ''

  try {
    const response = await listTelemetry(id, {
      page,
      limit,
      ...telemetryFilterParams.value,
    })
    if (!isCurrentTable(id, requestId)) return

    tableRows.value = response.telemetry
    tableTotal.value = response.total_count
  } catch (err) {
    if (!isCurrentTable(id, requestId)) return
    tableRows.value = []
    tableTotal.value = 0
    tableError.value = getApiError(err)
  } finally {
    if (isCurrentTable(id, requestId)) tableLoading.value = false
  }
}

function refreshAll() {
  tablePage.value = 1
  history.value = []
  historyTotal.value = 0
  historyError.value = ''
  tableRows.value = []
  tableTotal.value = 0
  tableError.value = ''
  void loadHistory()
  void loadTable()
}

function setPreset(range: TimeRange, resetOtherFilters = false) {
  const now = new Date()
  filter.value = {
    ...(resetOtherFilters ? emptyFilter() : filter.value),
    receivedFrom: toLocalInput(new Date(now.getTime() - RANGE_MS[range])),
    receivedTo: toLocalInput(now),
  }
  activePreset.value = range
  filterError.value = ''
  refreshAll()
}

function applyFilters() {
  if (!validateFilters()) return
  refreshAll()
}

function clearFilters() {
  filter.value = emptyFilter()
  activePreset.value = null
  filterError.value = ''
  refreshAll()
}

function retryHistory() {
  void loadHistory()
}

function retryTable() {
  void loadTable()
}

function changePage(nextPage: number) {
  if (nextPage < 1 || nextPage > tableTotalPages.value) return
  tablePage.value = nextPage
  void loadTable()
}

function changePageSize() {
  tablePage.value = 1
  void loadTable()
}

const currentReadings = computed<Record<SensorKey, number | null>>(() => {
  const row = latest.value ?? sortedHistory.value.at(-1)

  return {
    ambient_temp_c: row?.metrics.ambient_temp_c ?? null,
    ambient_humidity: row?.metrics.ambient_humidity ?? null,
    soil_temp_c: row?.metrics.soil_temp_c ?? null,
    soil_moisture: row?.metrics.soil_moisture ?? null,
  }
})

function readingDescription(key: SensorKey) {
  if (currentReadings.value[key] === null) return 'Waiting for device data'
  return latest.value ? 'Live sensor reading' : 'Latest recorded reading'
}

function formatClock(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

const chartUsesWeekdays = computed(() => {
  const rows = sortedHistory.value
  if (rows.length < 2) return false

  const span = new Date(rows[rows.length - 1].received_at).getTime()
    - new Date(rows[0].received_at).getTime()
  return span > 48 * 60 * 60 * 1000
})

function formatChartLabel(value: string) {
  const clock = formatClock(value)
  if (!chartUsesWeekdays.value) return clock

  const weekday = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
  }).format(new Date(value))

  return `${weekday} ${clock}`
}

const chartLabels = computed(() =>
  sortedHistory.value.map((row) => formatChartLabel(row.received_at)),
)

const chartValues = computed(() =>
  sortedHistory.value.map((row) => row.metrics[selectedSensor.value] ?? null),
)

const historyCaption = computed(() =>
  historyTotal.value > sortedHistory.value.length
    ? `Showing latest ${chartPoints.value} of ${historyTotal.value} readings in range`
    : `Showing all ${sortedHistory.value.length} readings in range`,
)

function formatReceivedAt(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatMetric(value: number | null | undefined) {
  return value == null ? '–' : value
}

function csvField(value: string | number | null | undefined) {
  if (value == null) return ''
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function csvTimestamp(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

function buildCsv(rows: Telemetry[]) {
  const lines = [CSV_HEADERS.join(',')]
  for (const row of rows) {
    lines.push([
      row.received_at,
      row.boot_id,
      row.seq,
      row.metrics.ambient_temp_c,
      row.metrics.ambient_humidity,
      row.metrics.soil_temp_c,
      row.metrics.soil_moisture,
    ].map(csvField).join(','))
  }
  return `${lines.join('\r\n')}\r\n`
}

async function exportCsv() {
  if (exportLoading.value || tableTotal.value === 0) return

  const id = deviceId.value
  const params = { ...telemetryFilterParams.value }
  const rows: Telemetry[] = []
  let total = tableTotal.value
  let maxPages = Math.ceil(total / LIMIT)

  exportLoading.value = true
  exportError.value = ''
  exportProgress.value = `Exporting 0/${total.toLocaleString()}...`

  try {
    for (let page = 1; page <= maxPages; page++) {
      const response = await listTelemetry(id, { page, limit: LIMIT, ...params })
      if (id !== deviceId.value) return

      total = Math.max(total, response.total_count)
      maxPages = Math.ceil(total / LIMIT)
      if (response.telemetry.length === 0) break

      rows.push(...response.telemetry)
      exportProgress.value = `Exporting ${rows.length.toLocaleString()}/${total.toLocaleString()}...`

      if (rows.length >= total) break
    }

    const blob = new Blob([buildCsv(rows)], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `telemetry-${csvTimestamp(new Date())}.csv`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  } catch (err) {
    exportError.value = getApiError(err)
  } finally {
    exportLoading.value = false
    exportProgress.value = ''
  }
}

onMounted(() => {
  setPreset('1h')
})

watch(deviceId, () => {
  setPreset('1h', true)
})

watch(chartPoints, () => {
  historyRequestId++
  void loadHistory()
})
</script>

<template>
  <div>
    <!-- Page Introduction -->
    <section class="mb-8">
      <h3 class="text-2xl font-bold text-gray-900">
        Monitoring
      </h3>

      <p class="mt-1 text-sm text-gray-500">
        Monitor greenhouse sensor readings and historical data.
      </p>
    </section>

    <!-- Sensor Summary -->
    <section class="mb-8">
      <div class="mb-4">
        <h4 class="text-lg font-bold text-gray-900">
          Current Sensor Readings
        </h4>

        <p class="mt-1 text-sm text-gray-500">
          Overview of the latest greenhouse environmental measurements.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button
          v-for="sensor in sensorList"
          :key="sensor.key"
          type="button"
          @click="selectedSensor = sensor.key"
          class="rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          :class="selectedSensor === sensor.key
            ? 'border-emerald-500 ring-2 ring-emerald-100'
            : 'border-gray-200'"
        >
          <div class="flex items-start justify-between">
            <div>
              <p class="text-sm font-medium text-gray-500">
                {{ sensor.title }}
              </p>

              <div class="mt-4 flex items-baseline gap-1">
                <span class="text-3xl font-bold tracking-tight text-gray-900">
                  {{ currentReadings[sensor.key] ?? '--' }}
                </span>

                <span class="text-sm font-medium text-gray-500">
                  {{ sensor.unit }}
                </span>
              </div>
            </div>

            <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-50 text-gray-600">
              <component :is="sensor.icon" :size="22" />
            </div>
          </div>

          <div class="mt-5 flex items-center gap-2 border-t border-gray-100 pt-4">
            <span
              class="h-2 w-2 rounded-full"
              :class="currentReadings[sensor.key] === null ? 'bg-gray-400' : 'bg-emerald-500'"
            />

            <p class="text-xs text-gray-500">
              {{ readingDescription(sensor.key) }}
            </p>
          </div>
        </button>
      </div>
    </section>

    <!-- Historical Chart -->
    <section class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div>
        <h4 class="text-lg font-bold text-gray-900">
          Historical Sensor Data
        </h4>

        <p class="mt-1 text-sm text-gray-500">
          {{ activeSensor.description }}
        </p>
      </div>

      <!-- Filters -->
      <div class="mt-6 space-y-4 rounded-xl bg-gray-50 p-4">
        <div class="flex flex-wrap gap-2">
          <button
            v-for="range in timeRanges"
            :key="range.value"
            type="button"
            @click="setPreset(range.value)"
            class="rounded-lg px-3 py-2 text-xs font-semibold transition"
            :class="activePreset === range.value
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
          >
            {{ range.label }}
          </button>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-medium text-gray-600">
              Boot ID
            </span>

            <input
              v-model="filter.bootId"
              @input="activePreset = null"
              type="text"
              placeholder="Any boot"
              :class="filterInputClass"
            />
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-medium text-gray-600">
              Seq From
            </span>

            <input
              v-model="filter.seqFrom"
              @input="activePreset = null"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              :class="filterInputClass"
            />
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-medium text-gray-600">
              Seq To
            </span>

            <input
              v-model="filter.seqTo"
              @input="activePreset = null"
              type="number"
              min="0"
              step="1"
              placeholder="Any"
              :class="filterInputClass"
            />
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-medium text-gray-600">
              Received From
            </span>

            <input
              v-model="filter.receivedFrom"
              @input="activePreset = null"
              type="datetime-local"
              :class="filterInputClass"
            />
          </label>

          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-medium text-gray-600">
              Received To
            </span>

            <input
              v-model="filter.receivedTo"
              @input="activePreset = null"
              type="datetime-local"
              :class="filterInputClass"
            />
          </label>

          <div class="flex items-end gap-2 sm:col-span-2 lg:col-span-3">
            <button
              type="button"
              @click="applyFilters"
              class="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
            >
              Apply
            </button>

            <button
              type="button"
              @click="clearFilters"
              class="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Clear
            </button>
          </div>
        </div>

        <p v-if="filterError" class="text-xs text-rose-600">
          {{ filterError }}
        </p>
      </div>

      <!-- Selected Sensor -->
      <div class="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-4">
        <div>
          <p class="text-xs font-medium text-gray-500">
            Selected Parameter
          </p>

          <p class="mt-1 font-semibold text-gray-900">
            {{ activeSensor.label }}
          </p>
        </div>

        <div class="text-right">
          <p class="text-xs font-medium text-gray-500">
            Latest Reading
          </p>

          <p class="mt-1 text-xl font-bold text-gray-900">
            {{ currentReadings[selectedSensor] ?? '--' }} {{ activeSensor.unit }}
          </p>
        </div>
      </div>

      <!-- Chart -->
      <div class="mt-6">
        <div
          v-if="historyLoading"
          class="flex h-80 flex-col items-center justify-center gap-3 rounded-xl bg-gray-50 text-sm text-gray-500"
        >
          <RefreshCw :size="28" class="animate-spin text-emerald-600" />
          <span>Loading readings...</span>
        </div>

        <div
          v-else-if="historyError"
          class="flex h-80 flex-col items-center justify-center gap-3 rounded-xl bg-gray-50 px-6 text-center"
        >
          <p class="text-sm text-rose-600">
            {{ historyError }}
          </p>

          <button
            type="button"
            @click="retryHistory"
            class="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
          >
            Retry
          </button>
        </div>

        <div
          v-else-if="sortedHistory.length === 0"
          class="flex h-80 items-center justify-center rounded-xl bg-gray-50 text-sm text-gray-500"
        >
          No readings in this range
        </div>

        <template v-else>
          <SensorChart
            :labels="chartLabels"
            :values="chartValues"
            :label="activeSensor.label"
            :color="activeSensor.color"
            :unit="activeSensor.unit"
            height="h-80"
          />

          <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs text-gray-500">
              {{ historyCaption }}
            </p>

            <label for="chart-points" class="flex items-center gap-2 text-xs text-gray-500">
              Chart points
              <select
                id="chart-points"
                v-model.number="chartPoints"
                class="rounded-lg border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              >
                <option v-for="count in CHART_POINT_COUNTS" :key="count" :value="count">
                  {{ count }}
                </option>
              </select>
            </label>
          </div>
        </template>
      </div>
    </section>

    <!-- Telemetry Records -->
    <section class="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 class="text-lg font-bold text-gray-900">
            Telemetry Records
          </h4>

          <p class="mt-1 text-sm text-gray-500">
            Browse every reading matching the current filters, one page at a time.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            @click="exportCsv"
            :disabled="exportLoading || tableTotal === 0"
            class="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Download class="h-4 w-4" />
            {{ exportLoading ? exportProgress : 'Export CSV' }}
          </button>

          <p v-if="exportError" class="text-xs text-rose-600">
            {{ exportError }}
          </p>
        </div>
      </div>

      <div class="overflow-x-auto rounded-xl border border-gray-200">
        <table class="w-full min-w-5xl border-collapse text-left">
          <thead class="bg-gray-50">
            <tr class="text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th class="whitespace-nowrap px-4 py-3">
                Received At
              </th>
              <th class="whitespace-nowrap px-4 py-3">
                Boot ID
              </th>
              <th class="whitespace-nowrap px-4 py-3">
                Seq
              </th>
              <th class="whitespace-nowrap px-4 py-3">
                Ambient Temp (°C)
              </th>
              <th class="whitespace-nowrap px-4 py-3">
                Ambient Humidity (%)
              </th>
              <th class="whitespace-nowrap px-4 py-3">
                Soil Temp (°C)
              </th>
              <th class="whitespace-nowrap px-4 py-3">
                Soil Moisture (%)
              </th>
            </tr>
          </thead>

          <tbody class="divide-y divide-gray-100">
            <tr v-if="tableLoading">
              <td colspan="7" class="px-4 py-12 text-center text-sm text-gray-500">
                <div class="flex items-center justify-center gap-2">
                  <RefreshCw :size="20" class="animate-spin text-emerald-600" />
                  Loading readings...
                </div>
              </td>
            </tr>

            <tr v-else-if="tableError">
              <td colspan="7" class="px-4 py-12 text-center">
                <p class="text-sm text-rose-600">
                  {{ tableError }}
                </p>

                <button
                  type="button"
                  @click="retryTable"
                  class="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                >
                  Retry
                </button>
              </td>
            </tr>

            <tr v-else-if="tableRows.length === 0">
              <td colspan="7" class="px-4 py-12 text-center text-sm text-gray-500">
                No readings match the current filters
              </td>
            </tr>

            <template v-else>
              <tr
                v-for="row in tableRows"
                :key="`${row.boot_id}:${row.seq}:${row.received_at}`"
                class="text-sm text-gray-700"
              >
                <td class="whitespace-nowrap px-4 py-3">
                  {{ formatReceivedAt(row.received_at) }}
                </td>
                <td class="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-600">
                  {{ row.boot_id }}
                </td>
                <td class="whitespace-nowrap px-4 py-3">
                  {{ row.seq }}
                </td>
                <td class="whitespace-nowrap px-4 py-3">
                  {{ formatMetric(row.metrics.ambient_temp_c) }}
                </td>
                <td class="whitespace-nowrap px-4 py-3">
                  {{ formatMetric(row.metrics.ambient_humidity) }}
                </td>
                <td class="whitespace-nowrap px-4 py-3">
                  {{ formatMetric(row.metrics.soil_temp_c) }}
                </td>
                <td class="whitespace-nowrap px-4 py-3">
                  {{ formatMetric(row.metrics.soil_moisture) }}
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div class="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-wrap items-center gap-3 text-xs text-gray-500">
          <label for="telemetry-page-size" class="flex items-center gap-2">
            Rows per page
            <select
              id="telemetry-page-size"
              v-model.number="tablePageSize"
              @change="changePageSize"
              class="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            >
              <option v-for="size in PAGE_SIZES" :key="size" :value="size">
                {{ size }}
              </option>
            </select>
          </label>

          <span>
            Page {{ tablePage }} of {{ tableTotalPages }} · {{ tableTotal }} records
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="changePage(tablePage - 1)"
            :disabled="tablePage <= 1 || tableLoading"
            class="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft class="h-4 w-4" />
            Previous
          </button>

          <button
            type="button"
            @click="changePage(tablePage + 1)"
            :disabled="tablePage >= tableTotalPages || tableLoading"
            class="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight class="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
