<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import SensorChart from '../../components/dashboard/SensorChart.vue'

import {
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

const selectedSensor = ref<SensorKey>('ambient_temp_c')
const selectedRange = ref<TimeRange>('1h')

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

const activeSensor = computed(() => {
  return sensorList.find((sensor) => sensor.key === selectedSensor.value)!
})

const { latest } = useTelemetrySocket(deviceId)

const history = ref<Telemetry[]>([])
const historyLoading = ref(false)
const historyError = ref('')

function compareRows(a: Telemetry, b: Telemetry) {
  const byTime = new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
  return byTime !== 0 ? byTime : a.seq - b.seq
}

const sortedHistory = computed(() => [...history.value].sort(compareRows))

// Ordering is undocumented; infer it from page 1 before choosing which pages hold the newest rows.
async function loadHistory(id: string, range: TimeRange) {
  if (id !== deviceId.value || range !== selectedRange.value) return

  const receivedFrom = new Date(Date.now() - RANGE_MS[range]).toISOString()
  historyLoading.value = true
  historyError.value = ''

  try {
    const first = await listTelemetry(id, {
      page: 1,
      limit: LIMIT,
      received_from: receivedFrom,
    })
    if (id !== deviceId.value || range !== selectedRange.value) return

    let rows = first.telemetry

    if (
      first.total_count > LIMIT &&
      rows.length > 1 &&
      compareRows(rows[0], rows[rows.length - 1]) < 0
    ) {
      const lastPage = Math.ceil(first.total_count / LIMIT)
      const pages = [lastPage]
      if (rows.length < LIMIT && lastPage > 1) pages.push(lastPage - 1)

      const olderPages = await Promise.all(
        pages.map((page) =>
          listTelemetry(id, { page, limit: LIMIT, received_from: receivedFrom }),
        ),
      )
      if (id !== deviceId.value || range !== selectedRange.value) return
      rows = [...rows, ...olderPages.flatMap((response) => response.telemetry)]
    }

    const deduped = new Map<string, Telemetry>()
    for (const row of rows) deduped.set(`${row.boot_id}:${row.seq}`, row)

    history.value = [...deduped.values()].sort(compareRows).slice(-LIMIT)
  } catch (err) {
    if (id !== deviceId.value || range !== selectedRange.value) return
    history.value = []
    historyError.value = getApiError(err)
  } finally {
    if (id === deviceId.value && range === selectedRange.value) {
      historyLoading.value = false
    }
  }
}

function retryHistory() {
  void loadHistory(deviceId.value, selectedRange.value)
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

function formatChartLabel(value: string) {
  if (selectedRange.value !== '7d') return formatClock(value)

  const weekday = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
  }).format(new Date(value))

  return `${weekday} ${formatClock(value)}`
}

const chartLabels = computed(() =>
  sortedHistory.value.map((row) => formatChartLabel(row.received_at)),
)

const chartValues = computed(() =>
  sortedHistory.value.map((row) => row.metrics[selectedSensor.value] ?? null),
)

onMounted(() => {
  void loadHistory(deviceId.value, selectedRange.value)
})

watch([deviceId, selectedRange], ([id, range]) => {
  history.value = []
  historyError.value = ''
  void loadHistory(id, range)
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
      <div class="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
        <div>
          <h4 class="text-lg font-bold text-gray-900">
            Historical Sensor Data
          </h4>

          <p class="mt-1 text-sm text-gray-500">
            {{ activeSensor.description }}
          </p>
        </div>

        <!-- Time Range Filter -->
        <div class="flex flex-wrap gap-2">
          <button
            v-for="range in timeRanges"
            :key="range.value"
            type="button"
            @click="selectedRange = range.value"
            class="rounded-lg px-3 py-2 text-xs font-semibold transition"
            :class="selectedRange === range.value
              ? 'bg-emerald-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
          >
            {{ range.label }}
          </button>
        </div>
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

        <SensorChart
          v-else
          :labels="chartLabels"
          :values="chartValues"
          :label="activeSensor.label"
          :color="activeSensor.color"
          :unit="activeSensor.unit"
          height="h-80"
        />
      </div>
    </section>
  </div>
</template>
