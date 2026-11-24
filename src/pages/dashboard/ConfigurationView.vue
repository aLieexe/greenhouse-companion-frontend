
<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  Settings2,
  SlidersHorizontal,
  Fan,
  Droplets,
  Clock3,
  ShieldCheck,
  Save,
  RotateCcw,
  CheckCircle2,
  Leaf,
} from 'lucide-vue-next'

interface ActuatorConfig {
  enabled: boolean
  metric: string
  turn_on_above: number
  turn_on_below: number
  turn_off_above: number
  turn_off_below: number
}

interface Configuration {
  automation: boolean
  telemetry_interval_sec: number
}

const defaultConfiguration: Configuration = {
  automation: true,
  telemetry_interval_sec: 10,
}

const defaultFan: ActuatorConfig = {
  enabled: true,
  metric: 'ambient_temp_c',
  turn_on_above: 30,
  turn_on_below: 0,
  turn_off_above: 0,
  turn_off_below: 27,
}

const defaultPump: ActuatorConfig = {
  enabled: true,
  metric: 'soil_moisture',
  turn_on_above: 0,
  turn_on_below: 35,
  turn_off_above: 45,
  turn_off_below: 0,
}

const configuration = reactive({ ...defaultConfiguration })
const fan = reactive({ ...defaultFan })
const pump = reactive({ ...defaultPump })

const savedMessage = ref('')
const isSaved = ref(false)

const enabledActuators = computed(
  () => Number(fan.enabled) + Number(pump.enabled),
)

const telemetryDescription = computed(() => {
  if (configuration.telemetry_interval_sec < 10) {
    return 'Frequent updates'
  }

  if (configuration.telemetry_interval_sec <= 30) {
    return 'Balanced update frequency'
  }

  return 'Reduced update frequency'
})

function saveConfiguration() {
  isSaved.value = true
  savedMessage.value = 'Configuration saved locally for this preview.'

  window.setTimeout(() => {
    isSaved.value = false
  }, 3500)
}

function resetConfiguration() {
  Object.assign(configuration, defaultConfiguration)
  Object.assign(fan, defaultFan)
  Object.assign(pump, defaultPump)

  isSaved.value = false
  savedMessage.value = 'Configuration restored to its demo defaults.'
}

function metricLabel(metric: string) {
  const labels: Record<string, string> = {
    ambient_temp_c: 'Ambient Temperature (°C)',
    ambient_humidity: 'Ambient Humidity (%)',
    soil_temp_c: 'Soil Temperature (°C)',
    soil_moisture: 'Soil Moisture (%)',
  }

  return labels[metric] ?? metric
}
</script>

<template>
  <div class="space-y-6 pb-8">
    <!-- Page Introduction -->
    <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
      <div>
        <h3 class="text-2xl font-bold text-gray-900">
          Configuration
        </h3>

        <p class="mt-1 text-sm text-gray-500">
          Configure greenhouse device settings and automation.
        </p>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          @click="resetConfiguration"
          class="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <RotateCcw :size="16" />
          Reset
        </button>

        <button
          type="button"
          @click="saveConfiguration"
          class="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        >
          <Save :size="16" />
          Save Changes
        </button>
      </div>
    </div>

    <!-- Summary cards -->
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <div class="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-gray-500">Automation Mode</p>
          <div class="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
            <Leaf :size="20" />
          </div>
        </div>
        <p class="mt-3 text-2xl font-bold text-gray-900">
          {{ configuration.automation ? 'Automatic' : 'Manual' }}
        </p>
        <p class="mt-1 text-xs text-gray-500">
          Current control behavior
        </p>
      </div>

      <div class="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-gray-500">Telemetry Interval</p>
          <div class="rounded-xl bg-blue-50 p-2.5 text-blue-600">
            <Clock3 :size="20" />
          </div>
        </div>
        <p class="mt-3 text-2xl font-bold text-gray-900">
          {{ configuration.telemetry_interval_sec }} sec
        </p>
        <p class="mt-1 text-xs text-gray-500">
          {{ telemetryDescription }}
        </p>
      </div>

      <div class="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:col-span-2 xl:col-span-1">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-gray-500">Enabled Actuators</p>
          <div class="rounded-xl bg-purple-50 p-2.5 text-purple-600">
            <SlidersHorizontal :size="20" />
          </div>
        </div>
        <p class="mt-3 text-2xl font-bold text-gray-900">
          {{ enabledActuators }} / 2
        </p>
        <p class="mt-1 text-xs text-gray-500">
          Fan and water pump availability
        </p>
      </div>
    </div>

    <!-- General configuration -->
    <section class="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div class="flex items-center gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
        <div class="rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
          <Settings2 :size="20" />
        </div>
        <div>
          <h2 class="font-semibold text-gray-900">General Settings</h2>
          <p class="text-xs text-gray-500">
            Configure the overall behavior of your greenhouse
          </p>
        </div>
      </div>

      <div class="space-y-6 p-5 sm:p-6">
        <!-- Automation -->
        <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div class="max-w-xl">
            <p class="text-sm font-semibold text-gray-800">
              Automatic Control
            </p>
            <p class="mt-1 text-sm leading-relaxed text-gray-500">
              Allow the system to control the fan and water pump automatically
              based on configured sensor thresholds.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            :aria-checked="configuration.automation"
            @click="configuration.automation = !configuration.automation"
            class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition"
            :class="configuration.automation ? 'bg-emerald-600' : 'bg-gray-300'"
          >
            <span
              class="inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition"
              :class="configuration.automation ? 'translate-x-6' : 'translate-x-1'"
            />
          </button>
        </div>

        <div class="border-t border-gray-100" />

        <!-- Telemetry interval -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-center">
          <div>
            <p class="text-sm font-semibold text-gray-800">
              Telemetry Interval
            </p>
            <p class="mt-1 text-sm leading-relaxed text-gray-500">
              Set how frequently the device sends sensor readings.
            </p>
          </div>

          <div>
            <div class="relative">
              <input
                v-model.number="configuration.telemetry_interval_sec"
                type="number"
                min="1"
                max="3600"
                class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-16 text-sm font-medium text-gray-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
              <span class="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                seconds
              </span>
            </div>
            <p class="mt-1.5 text-xs text-gray-400">
              Demo input range: 1–3600 seconds
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- Actuator configuration -->
    <section class="space-y-4">
      <div>
        <h2 class="text-lg font-semibold text-gray-900">
          Actuator Configuration
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          Set the sensor metrics and threshold values for each actuator.
        </p>
      </div>

      <!-- Fan -->
      <div class="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div class="flex flex-col justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <div class="flex items-center gap-3">
            <div class="rounded-xl bg-sky-50 p-2.5 text-sky-600">
              <Fan :size="22" />
            </div>
            <div>
              <h3 class="font-semibold text-gray-900">Cooling Fan</h3>
              <p class="text-xs text-gray-500">Fan actuator settings</p>
            </div>
          </div>

          <label class="inline-flex cursor-pointer items-center gap-2">
            <span class="text-sm text-gray-600">
              {{ fan.enabled ? 'Enabled' : 'Disabled' }}
            </span>
            <input v-model="fan.enabled" type="checkbox" class="peer sr-only" />
            <span class="relative h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-emerald-600 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" />
          </label>
        </div>

        <div class="space-y-5 p-5 sm:p-6" :class="{ 'opacity-50': !fan.enabled }">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-2 block text-sm font-medium text-gray-700">
                Monitoring Metric
              </label>
              <select
                v-model="fan.metric"
                :disabled="!fan.enabled"
                class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed"
              >
                <option value="ambient_temp_c">Ambient Temperature</option>
                <option value="ambient_humidity">Ambient Humidity</option>
                <option value="soil_temp_c">Soil Temperature</option>
                <option value="soil_moisture">Soil Moisture</option>
              </select>
              <p class="mt-1.5 text-xs text-gray-400">
                Selected: {{ metricLabel(fan.metric) }}
              </p>
            </div>
          </div>

          <div>
            <h4 class="mb-3 text-sm font-semibold text-gray-800">
              Activation Thresholds
            </h4>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="mb-2 block text-xs font-medium text-gray-500">
                  Turn ON above
                </label>
                <input
                  v-model.number="fan.turn_on_above"
                  type="number"
                  step="any"
                  :disabled="!fan.enabled"
                  class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label class="mb-2 block text-xs font-medium text-gray-500">
                  Turn ON below
                </label>
                <input
                  v-model.number="fan.turn_on_below"
                  type="number"
                  step="any"
                  :disabled="!fan.enabled"
                  class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label class="mb-2 block text-xs font-medium text-gray-500">
                  Turn OFF above
                </label>
                <input
                  v-model.number="fan.turn_off_above"
                  type="number"
                  step="any"
                  :disabled="!fan.enabled"
                  class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label class="mb-2 block text-xs font-medium text-gray-500">
                  Turn OFF below
                </label>
                <input
                  v-model.number="fan.turn_off_below"
                  type="number"
                  step="any"
                  :disabled="!fan.enabled"
                  class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pump -->
      <div class="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div class="flex flex-col justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <div class="flex items-center gap-3">
            <div class="rounded-xl bg-blue-50 p-2.5 text-blue-600">
              <Droplets :size="22" />
            </div>
            <div>
              <h3 class="font-semibold text-gray-900">Water Pump</h3>
              <p class="text-xs text-gray-500">Water pump actuator settings</p>
            </div>
          </div>

          <label class="inline-flex cursor-pointer items-center gap-2">
            <span class="text-sm text-gray-600">
              {{ pump.enabled ? 'Enabled' : 'Disabled' }}
            </span>
            <input v-model="pump.enabled" type="checkbox" class="peer sr-only" />
            <span class="relative h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-emerald-600 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" />
          </label>
        </div>

        <div class="space-y-5 p-5 sm:p-6" :class="{ 'opacity-50': !pump.enabled }">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class="mb-2 block text-sm font-medium text-gray-700">
                Monitoring Metric
              </label>
              <select
                v-model="pump.metric"
                :disabled="!pump.enabled"
                class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed"
              >
                <option value="ambient_temp_c">Ambient Temperature</option>
                <option value="ambient_humidity">Ambient Humidity</option>
                <option value="soil_temp_c">Soil Temperature</option>
                <option value="soil_moisture">Soil Moisture</option>
              </select>
              <p class="mt-1.5 text-xs text-gray-400">
                Selected: {{ metricLabel(pump.metric) }}
              </p>
            </div>
          </div>

          <div>
            <h4 class="mb-3 text-sm font-semibold text-gray-800">
              Activation Thresholds
            </h4>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="mb-2 block text-xs font-medium text-gray-500">
                  Turn ON above
                </label>
                <input
                  v-model.number="pump.turn_on_above"
                  type="number"
                  step="any"
                  :disabled="!pump.enabled"
                  class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label class="mb-2 block text-xs font-medium text-gray-500">
                  Turn ON below
                </label>
                <input
                  v-model.number="pump.turn_on_below"
                  type="number"
                  step="any"
                  :disabled="!pump.enabled"
                  class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label class="mb-2 block text-xs font-medium text-gray-500">
                  Turn OFF above
                </label>
                <input
                  v-model.number="pump.turn_off_above"
                  type="number"
                  step="any"
                  :disabled="!pump.enabled"
                  class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label class="mb-2 block text-xs font-medium text-gray-500">
                  Turn OFF below
                </label>
                <input
                  v-model.number="pump.turn_off_below"
                  type="number"
                  step="any"
                  :disabled="!pump.enabled"
                  class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Save feedback -->
    <div
      v-if="savedMessage"
      class="flex items-center gap-2 rounded-xl border p-4 text-sm"
      :class="isSaved
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-blue-200 bg-blue-50 text-blue-800'"
    >
      <CheckCircle2 :size="18" />
      {{ savedMessage }}
    </div>

    <!-- Footer note -->
    <div class="flex items-start gap-2 rounded-xl bg-gray-100 p-4 text-xs leading-relaxed text-gray-500">
      <ShieldCheck :size="16" class="mt-0.5 shrink-0" />
      <p>
        Configuration parameters follow the backend API structure. The
        displayed default values are examples for frontend testing and should
        be reviewed before being applied to a physical greenhouse device.
      </p>
    </div>
  </div>
</template>
