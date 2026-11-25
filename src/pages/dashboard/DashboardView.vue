<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, type Component } from 'vue'
import { useRoute } from 'vue-router'

import SensorCard from '../../components/dashboard/SensorCard.vue'
import SensorChart from '../../components/dashboard/SensorChart.vue'
import ActuatorCard from '../../components/dashboard/ActuatorCard.vue'

import {
  Cpu,
  Droplets,
  Sprout,
  Thermometer,
  Wind,
} from 'lucide-vue-next'

import { getDevice } from '../../api/devices'
import { getApiError } from '../../api/http'
import { getActuatorState, sendCommand } from '../../api/commands'
import { listTelemetry } from '../../api/telemetry'
import { useTelemetrySocket } from '../../composables/useTelemetrySocket'
import { useDevicesStore } from '../../stores/devices'
import type {
  ActuatorKey,
  ActuatorRuntimeState,
  DeviceDetail,
  DeviceStatus,
  SetActuatorCommand,
  Telemetry,
  TelemetryMetrics,
} from '../../types/api'
import { formatMacAddress } from '../../utils/format'

const route = useRoute()
const devicesStore = useDevicesStore()
const deviceId = computed(() => String(route.params.deviceId ?? ''))

const detail = ref<DeviceDetail | null>(null)
const detailError = ref('')

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function statusLabel(status: DeviceStatus) {
  const labels: Record<DeviceStatus, string> = {
    online: 'Online',
    offline: 'Offline',
    unknown: 'Unknown',
  }

  return labels[status]
}

const statusClass = computed(() => {
  const status = detail.value?.status ?? 'unknown'

  return status === 'online'
    ? 'bg-emerald-50 text-emerald-700'
    : status === 'offline'
      ? 'bg-rose-50 text-rose-700'
      : 'bg-gray-100 text-gray-600'
})

const statusDotClass = computed(() => {
  const status = detail.value?.status ?? 'unknown'

  return status === 'online'
    ? 'bg-emerald-500'
    : status === 'offline'
      ? 'bg-rose-500'
      : 'bg-gray-400'
})

const detailFields = computed(() => [
  {
    label: 'MAC Address',
    value: detail.value ? formatMacAddress(detail.value.hardware_id) : 'Unknown',
    mono: true,
  },
  {
    label: 'Registered',
    value: detail.value ? formatDate(detail.value.created_at) : 'Unknown',
    mono: false,
  },
  {
    label: 'IP Address',
    value: detail.value?.current_ip || 'Unknown',
    mono: false,
  },
  {
    label: 'Last Seen',
    value: detail.value?.last_seen_at
      ? formatDateTime(detail.value.last_seen_at)
      : 'Never',
    mono: false,
  },
  {
    label: 'Boot ID',
    value: detail.value?.boot_id || 'Unknown',
    mono: true,
  },
  {
    label: 'Role',
    value: detail.value?.role || 'Unknown',
    mono: false,
  },
])

async function loadDetail() {
  const id = deviceId.value

  try {
    const data = await getDevice(id)
    if (id !== deviceId.value) return
    detail.value = data
    detailError.value = ''
  } catch (err) {
    if (id !== deviceId.value) return
    detail.value = null
    detailError.value = getApiError(err)
  }
}

type MetricKey = keyof TelemetryMetrics

const sensorList: {
  key: MetricKey
  title: string
  label: string
  unit: string
  icon: Component
  color: string
  description: string
}[] = [
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
]

const selectedMetric = ref<MetricKey>('ambient_temp_c')
const activeSensor = computed(
  () => sensorList.find((sensor) => sensor.key === selectedMetric.value)!,
)

const telemetry = ref<Telemetry[]>([])
const telemetryError = ref('')
const { status: socketStatus, latest } = useTelemetrySocket(deviceId)

const sortedTelemetry = computed(() =>
  [...telemetry.value].sort((a, b) => {
    const byTime =
      new Date(a.received_at).getTime() - new Date(b.received_at).getTime()
    return byTime !== 0 ? byTime : a.seq - b.seq
  }),
)

async function loadTelemetry() {
  const id = deviceId.value

  try {
    const response = await listTelemetry(id, { page: 1, limit: 20 })
    if (id !== deviceId.value) return
    telemetry.value = response.telemetry
    telemetryError.value = ''
  } catch (err) {
    if (id !== deviceId.value) return
    telemetry.value = []
    telemetryError.value = getApiError(err)
  }
}

const currentReadings = computed<Record<MetricKey, number | null>>(() => {
  const row = latest.value ?? sortedTelemetry.value.at(-1)

  return {
    ambient_temp_c: row?.metrics.ambient_temp_c ?? null,
    ambient_humidity: row?.metrics.ambient_humidity ?? null,
    soil_temp_c: row?.metrics.soil_temp_c ?? null,
    soil_moisture: row?.metrics.soil_moisture ?? null,
  }
})

function readingDescription(key: MetricKey) {
  if (currentReadings.value[key] === null) return 'Waiting for device data'
  return latest.value ? 'Live sensor reading' : 'Latest recorded reading'
}

const connectionBadge = computed(() => {
  if (!latest.value) {
    return {
      label: 'Waiting for data',
      badge: 'bg-gray-100 text-gray-600',
      dot: 'bg-gray-400',
    }
  }

  return socketStatus.value === 'live'
    ? {
        label: 'Live',
        badge: 'bg-emerald-50 text-emerald-700',
        dot: 'bg-emerald-500',
      }
    : {
        label: 'Reconnecting',
        badge: 'bg-amber-50 text-amber-700',
        dot: 'bg-amber-500',
      }
})

function formatClock(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

const chartLabels = computed(() =>
  sortedTelemetry.value.map((row) => formatClock(row.received_at)),
)

const chartValues = computed(() =>
  sortedTelemetry.value.map((row) => row.metrics[selectedMetric.value] ?? null),
)

const actuatorList: {
  key: ActuatorKey
  title: string
  description: string
  icon: Component
}[] = [
  {
    key: 'pump',
    title: 'Water Pump',
    description: 'Control the irrigation water pump',
    icon: Droplets,
  },
  {
    key: 'fan-1',
    title: 'Cooling Fan 1',
    description: 'Control the greenhouse ventilation fan',
    icon: Wind,
  },
  {
    key: 'fan-2',
    title: 'Cooling Fan 2',
    description: 'Control the greenhouse ventilation fan',
    icon: Wind,
  },
]

const actuatorStates = ref<Partial<Record<ActuatorKey, ActuatorRuntimeState>>>({})
const actuatorBusy = ref<Record<ActuatorKey, boolean>>({
  pump: false,
  'fan-1': false,
  'fan-2': false,
})
const actuatorErrors = ref<Record<ActuatorKey, string>>({
  pump: '',
  'fan-1': '',
  'fan-2': '',
})
const actuatorLoadError = ref('')

const canControl = computed(
  () => devicesStore.deviceById(deviceId.value)?.role !== 'viewer',
)

const refetchTimers = new Set<ReturnType<typeof setTimeout>>()

function clearRefetchTimers() {
  refetchTimers.forEach((timer) => clearTimeout(timer))
  refetchTimers.clear()
}

async function loadActuatorState() {
  const id = deviceId.value

  try {
    const response = await getActuatorState(id)
    if (id !== deviceId.value) return
    actuatorStates.value = response.actuators ?? {}
    actuatorLoadError.value = ''
  } catch (err) {
    if (id !== deviceId.value) return
    actuatorLoadError.value = getApiError(err)
  }
}

function scheduleActuatorRefetch(id: string) {
  for (const delay of [4000, 65000]) {
    const timer = setTimeout(() => {
      refetchTimers.delete(timer)
      if (id === deviceId.value) void loadActuatorState()
    }, delay)

    refetchTimers.add(timer)
  }
}

async function issueCommand(
  key: ActuatorKey,
  payload: SetActuatorCommand,
  optimistic?: Partial<ActuatorRuntimeState>,
) {
  const id = deviceId.value
  const previous = actuatorStates.value[key]

  actuatorBusy.value[key] = true
  actuatorErrors.value[key] = ''

  if (previous && optimistic) {
    actuatorStates.value = {
      ...actuatorStates.value,
      [key]: { ...previous, ...optimistic },
    }
  }

  try {
    await sendCommand(id, payload)
    if (id === deviceId.value) scheduleActuatorRefetch(id)
  } catch (err) {
    if (id !== deviceId.value) return

    if (previous) {
      actuatorStates.value = { ...actuatorStates.value, [key]: previous }
    }
    actuatorErrors.value[key] = getApiError(err)
  } finally {
    if (id === deviceId.value) actuatorBusy.value[key] = false
  }
}

function toggleActuator(key: ActuatorKey) {
  const state = actuatorStates.value[key]
  if (!state || actuatorBusy.value[key]) return

  const on = !state.on

  void issueCommand(
    key,
    {
      action: 'set_actuator',
      actuator: key,
      state: on,
      duty: state.duty,
      mode: 'manual',
    },
    { on },
  )
}

function setDuty(key: ActuatorKey, duty: number) {
  const state = actuatorStates.value[key]
  if (!state || actuatorBusy.value[key]) return

  void issueCommand(
    key,
    {
      action: 'set_actuator',
      actuator: key,
      state: state.on,
      duty,
      mode: 'manual',
    },
    { duty },
  )
}

function takeManual(key: ActuatorKey) {
  const state = actuatorStates.value[key]
  if (!state || actuatorBusy.value[key]) return

  void issueCommand(key, {
    action: 'set_actuator',
    actuator: key,
    state: state.on,
    duty: state.duty,
    mode: 'manual',
  })
}

onMounted(() => {
  void loadDetail()
  void loadTelemetry()
  void loadActuatorState()
})

watch(deviceId, () => {
  clearRefetchTimers()
  detail.value = null
  detailError.value = ''
  telemetry.value = []
  telemetryError.value = ''
  actuatorStates.value = {}
  actuatorLoadError.value = ''

  for (const key of ['pump', 'fan-1', 'fan-2'] as ActuatorKey[]) {
    actuatorBusy.value[key] = false
    actuatorErrors.value[key] = ''
  }

  void loadDetail()
  void loadTelemetry()
  void loadActuatorState()
})

onUnmounted(clearRefetchTimers)
</script>

<template>
  <div>
    <!-- Page Introduction -->
    <section class="mb-8">
      <h3 class="text-2xl font-bold text-gray-900">
        Dashboard Overview
      </h3>

      <p class="mt-1 text-sm text-gray-500">
        Monitor and manage your greenhouse environment from one place.
      </p>
    </section>

    <!-- Device Status -->
    <section class="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div class="flex items-center gap-4">
          <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Cpu :size="24" />
          </div>

          <div>
            <h4 class="font-semibold text-gray-900">
              {{ detail?.name ?? 'Greenhouse Device' }}
            </h4>

            <p class="text-sm text-gray-500">
              Device connection status
            </p>
          </div>
        </div>

        <div
          class="flex items-center gap-2 self-start rounded-full px-3 py-1.5 sm:self-center"
          :class="statusClass"
        >
          <span class="h-2 w-2 rounded-full" :class="statusDotClass" />
          <span class="text-xs font-semibold">
            {{ statusLabel(detail?.status ?? 'unknown') }}
          </span>
        </div>
      </div>

      <div class="mt-5 grid grid-cols-2 gap-4 border-t border-gray-100 pt-5 sm:grid-cols-3 lg:grid-cols-6">
        <div v-for="field in detailFields" :key="field.label">
          <p class="text-xs font-medium text-gray-400">
            {{ field.label }}
          </p>

          <p
            class="mt-1 text-sm text-gray-700"
            :class="field.mono ? 'font-mono text-xs' : ''"
          >
            {{ field.value }}
          </p>
        </div>
      </div>

      <p v-if="detailError" class="mt-4 text-xs text-rose-600">
        {{ detailError }}
      </p>
    </section>

    <!-- Sensor Overview -->
    <section class="mb-8">
      <div class="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h4 class="text-lg font-bold text-gray-900">
            Environment Overview
          </h4>

          <p class="text-sm text-gray-500">
            Real-time greenhouse sensor readings
          </p>
        </div>

        <span
          class="flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
          :class="connectionBadge.badge"
        >
          <span class="h-2 w-2 rounded-full" :class="connectionBadge.dot" />
          {{ connectionBadge.label }}
        </span>
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button
          v-for="sensor in sensorList"
          :key="sensor.key"
          type="button"
          @click="selectedMetric = sensor.key"
          class="rounded-2xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          :class="selectedMetric === sensor.key
            ? 'border-emerald-500 ring-2 ring-emerald-100'
            : 'border-gray-200'"
        >
          <SensorCard
            :title="sensor.title"
            :value="currentReadings[sensor.key]"
            :unit="sensor.unit"
            :icon="sensor.icon"
            :description="readingDescription(sensor.key)"
          />
        </button>
      </div>
    </section>

    <!-- Monitoring and Actuator -->
    <section class="grid grid-cols-1 gap-6 xl:grid-cols-3">

      <!-- Monitoring Chart -->
      <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm xl:col-span-2">
        <h4 class="font-bold text-gray-900">
          Sensor Monitoring
        </h4>

        <p class="mt-1 text-sm text-gray-500">
          Historical sensor data and trends
        </p>

        <div class="mt-6">
          <div
            v-if="sortedTelemetry.length === 0"
            class="flex h-48 flex-col items-center justify-center rounded-xl bg-gray-50 px-6 text-center text-sm text-gray-500"
          >
            <span>{{ telemetryError || 'No telemetry recorded yet' }}</span>
          </div>

          <SensorChart
            v-else
            height="h-48"
            :labels="chartLabels"
            :values="chartValues"
            :label="activeSensor.label"
            :color="activeSensor.color"
            :unit="activeSensor.unit"
          />
        </div>
      </div>

      <!-- Actuator Control -->
      <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h4 class="font-bold text-gray-900">
          Actuator Control
        </h4>

        <p class="mt-1 text-sm text-gray-500">
          Manage greenhouse equipment
        </p>

        <p v-if="!canControl" class="mt-2 text-xs text-amber-700">
          Control requires admin access.
        </p>

        <p v-if="actuatorLoadError" class="mt-2 text-xs text-rose-600">
          {{ actuatorLoadError }}
        </p>

        <div class="mt-6 space-y-4">
          <ActuatorCard
            v-for="actuator in actuatorList"
            :key="actuator.key"
            :title="actuator.title"
            :description="actuator.description"
            :icon="actuator.icon"
            :state="actuatorStates[actuator.key] ?? null"
            :busy="actuatorBusy[actuator.key]"
            :disabled="!canControl"
            :error="actuatorErrors[actuator.key]"
            @toggle="toggleActuator(actuator.key)"
            @set-duty="setDuty(actuator.key, $event)"
            @take-manual="takeManual(actuator.key)"
          />
        </div>
      </div>

    </section>
  </div>
</template>
