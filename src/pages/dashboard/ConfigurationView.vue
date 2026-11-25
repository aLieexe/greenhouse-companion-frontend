<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch, type Component } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import axios from 'axios'
import {
  CheckCircle2,
  Droplets,
  Fan,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
} from 'lucide-vue-next'

import { getConfig, getConfigVersion, listConfigVersions, updateConfig } from '../../api/config'
import { getApiError } from '../../api/http'
import { useDevicesStore } from '../../stores/devices'
import type {
  ActuatorKey,
  ConfigAuthor,
  ConfigResponse,
  ConfigVersionResponse,
  ConfigVersionSummary,
  DeviceConfig,
  DeviceConfigActuator,
  DeviceConfigActuators,
  DeviceConfigBehavior,
  UpdateConfigRequest,
} from '../../types/api'

interface ActuatorForm {
  enabled: boolean
  metric: string
  duty: number
  turn_on_above: number
  turn_on_below: number
  turn_off_above: number
  turn_off_below: number
}

interface ConfigForm {
  label: string
  config: {
    configuration: DeviceConfigBehavior
    actuators: Record<ActuatorKey, ActuatorForm>
  }
}

type ThresholdField = 'turn_on_above' | 'turn_on_below' | 'turn_off_above' | 'turn_off_below'
type ModalChoice = 'save' | 'discard' | 'cancel'
type RouteLeaveResolver = (allowed: boolean) => void

const route = useRoute()
const devicesStore = useDevicesStore()
const deviceId = computed(() => String(route.params.deviceId ?? ''))
const canEdit = computed(() => devicesStore.deviceById(deviceId.value)?.role !== 'viewer')

const actuatorKeys: ActuatorKey[] = ['fan-1', 'fan-2', 'pump']
const actuatorList: { key: ActuatorKey; name: string; icon: Component }[] = [
  { key: 'fan-1', name: 'Cooling Fan 1', icon: Fan },
  { key: 'fan-2', name: 'Cooling Fan 2', icon: Fan },
  { key: 'pump', name: 'Water Pump', icon: Droplets },
]
const metricOptions = [
  { value: 'ambient_temp_c', label: 'Ambient Temperature' },
  { value: 'ambient_humidity', label: 'Ambient Humidity' },
  { value: 'soil_temp_c', label: 'Soil Temperature' },
  { value: 'soil_moisture', label: 'Soil Moisture' },
]
const versionPageSizes = [10, 20, 50]

const form = reactive<ConfigForm>(createForm())
const baseline = ref<UpdateConfigRequest | null>(null)
const currentConfig = ref<ConfigResponse | null>(null)
const configLoading = ref(false)
const configError = ref('')
const saving = ref(false)
const saveError = ref('')
const saveSuccess = ref('')
const hasConflict = ref(false)

const isDirty = computed(() => {
  if (!baseline.value) return false
  return JSON.stringify(buildPayload()) !== JSON.stringify(baseline.value)
})
const formUnavailable = computed(() => configLoading.value || !!configError.value)

function numeric(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function actuatorForm(actuator?: DeviceConfigActuator): ActuatorForm {
  return {
    enabled: actuator?.enabled ?? false,
    metric: actuator?.metric ?? '',
    duty: actuator?.duty ?? 0,
    turn_on_above: actuator?.turn_on_above ?? 0,
    turn_on_below: actuator?.turn_on_below ?? 0,
    turn_off_above: actuator?.turn_off_above ?? 0,
    turn_off_below: actuator?.turn_off_below ?? 0,
  }
}

function createForm(label = '', config?: DeviceConfig): ConfigForm {
  return {
    label,
    config: {
      configuration: {
        automation: config?.configuration.automation ?? false,
        telemetry_interval_sec: config?.configuration.telemetry_interval_sec ?? 30,
      },
      actuators: {
        'fan-1': actuatorForm(config?.actuators['fan-1']),
        'fan-2': actuatorForm(config?.actuators['fan-2']),
        pump: actuatorForm(config?.actuators.pump),
      },
    },
  }
}

function buildPayload(): UpdateConfigRequest {
  const actuators: DeviceConfigActuators = {}

  for (const key of actuatorKeys) {
    const source = form.config.actuators[key]
    const actuator: DeviceConfigActuator = {
      enabled: Boolean(source.enabled),
      metric: String(source.metric ?? ''),
      duty: numeric(source.duty),
    }

    if (source.enabled) {
      if (key === 'pump') {
        actuator.turn_on_below = numeric(source.turn_on_below)
        actuator.turn_off_above = numeric(source.turn_off_above)
      } else {
        actuator.turn_on_above = numeric(source.turn_on_above)
        actuator.turn_off_below = numeric(source.turn_off_below)
      }
    }

    actuators[key] = actuator
  }

  return {
    label: String(form.label ?? '').trim(),
    config: {
      configuration: {
        automation: Boolean(form.config.configuration.automation),
        telemetry_interval_sec: numeric(form.config.configuration.telemetry_interval_sec),
      },
      actuators,
    },
  }
}

function validateForm(): string {
  const label = String(form.label ?? '').trim()
  if (label.length === 0 || label.length > 128) {
    return 'Configuration Label must be between 1 and 128 characters.'
  }

  const interval = Number(form.config.configuration.telemetry_interval_sec)
  if (!Number.isInteger(interval) || interval < 1) {
    return 'Telemetry Interval must be a whole number greater than 0.'
  }

  for (const { key, name } of actuatorList) {
    const actuator = form.config.actuators[key]
    if (!actuator.enabled) continue

    if (!String(actuator.metric ?? '').trim()) {
      return `${name} metric is required when the actuator is enabled.`
    }

    const duty = Number(actuator.duty)
    if (!Number.isInteger(duty) || duty < 0 || duty > 100) {
      return `${name} Duty Level must be a whole number between 0 and 100.`
    }

    if (key === 'pump') {
      const on = Number(actuator.turn_on_below)
      const off = Number(actuator.turn_off_above)
      if (!Number.isFinite(on) || !Number.isFinite(off) || on >= off) {
        return `${name} Turn ON below must be lower than Turn OFF above.`
      }
    } else {
      const on = Number(actuator.turn_on_above)
      const off = Number(actuator.turn_off_below)
      if (!Number.isFinite(on) || !Number.isFinite(off) || on <= off) {
        return `${name} Turn ON above must be greater than Turn OFF below.`
      }
    }
  }

  return ''
}

let configToken = 0

async function loadConfig(id: string) {
  const token = ++configToken
  configLoading.value = true
  configError.value = ''
  hasConflict.value = false

  try {
    const response = await getConfig(id)
    if (id !== deviceId.value || token !== configToken) return

    currentConfig.value = response
    Object.assign(form, createForm(response.version === null ? '' : response.label, response.config))
    baseline.value = buildPayload()
    saveError.value = ''
    saveSuccess.value = ''
  } catch (err) {
    if (id !== deviceId.value || token !== configToken) return

    currentConfig.value = null
    configError.value = getApiError(err)
    baseline.value = null
    Object.assign(form, createForm())
  } finally {
    if (id === deviceId.value && token === configToken) configLoading.value = false
  }
}

async function saveConfiguration(): Promise<boolean> {
  if (saving.value || !baseline.value) return false

  if (!canEdit.value) {
    saveError.value = 'Saving requires admin access.'
    return false
  }

  const error = validateForm()
  if (error) {
    saveError.value = error
    hasConflict.value = false
    return false
  }

  saving.value = true
  saveError.value = ''
  saveSuccess.value = ''
  hasConflict.value = false

  const id = deviceId.value

  try {
    const result = await updateConfig(id, buildPayload())
    if (id !== deviceId.value) return false

    Object.assign(form, createForm(result.data.label, result.data.config))
    baseline.value = buildPayload()
    currentConfig.value = result.data
    saveSuccess.value = result.status === 201
      ? `Saved as version ${result.data.version}`
      : 'Label updated'
    void loadVersions(id, 1)
    return true
  } catch (err) {
    if (id !== deviceId.value) return false

    saveError.value = getApiError(err)
    hasConflict.value = axios.isAxiosError(err) && err.response?.status === 409
    return false
  } finally {
    saving.value = false
  }
}

function reloadAfterConflict() {
  hasConflict.value = false
  saveError.value = ''
  void loadConfig(deviceId.value)
  void loadVersions(deviceId.value, 1)
}

function restoreBaseline() {
  if (!baseline.value) return
  Object.assign(form, createForm(baseline.value.label, baseline.value.config))
  saveError.value = ''
  saveSuccess.value = ''
  hasConflict.value = false
}

const modalOpen = ref(false)
const pendingResolve = ref<RouteLeaveResolver | null>(null)

async function resolveModal(choice: ModalChoice) {
  const resolve = pendingResolve.value
  if (!resolve) return

  pendingResolve.value = null
  modalOpen.value = false

  if (choice === 'cancel') {
    resolve(false)
    return
  }

  if (choice === 'save') {
    const saved = await saveConfiguration()
    if (!saved) {
      resolve(false)
      return
    }
  }

  resolve(true)
}

onBeforeRouteLeave(() => {
  if (!isDirty.value) return true

  return new Promise<boolean>((resolve) => {
    pendingResolve.value = resolve
    modalOpen.value = true
  })
})

function handleBeforeUnload(event: BeforeUnloadEvent) {
  event.preventDefault()
  event.returnValue = ''
}

watch(isDirty, (dirty) => {
  if (dirty) window.addEventListener('beforeunload', handleBeforeUnload)
  else window.removeEventListener('beforeunload', handleBeforeUnload)
})

const versions = ref<ConfigVersionSummary[]>([])
const versionTotal = ref(0)
const versionPage = ref(1)
const versionPageSize = ref(10)
const versionsLoading = ref(false)
const versionsError = ref('')
const failedVersionPage = ref(1)
const versionTotalPages = computed(() => Math.max(1, Math.ceil(versionTotal.value / versionPageSize.value)))
const hasPrevVersion = computed(() => versionPage.value > 1)
const hasNextVersion = computed(() => versionPage.value < versionTotalPages.value)

let versionToken = 0

async function loadVersions(id: string, page: number) {
  if (id !== deviceId.value) return

  const token = ++versionToken
  versionsLoading.value = true
  versionsError.value = ''

  try {
    const response = await listConfigVersions(id, { page, limit: versionPageSize.value })
    if (id !== deviceId.value || token !== versionToken) return

    versions.value = response.versions
    versionTotal.value = response.total_count
    versionPage.value = response.page
    failedVersionPage.value = page
  } catch (err) {
    if (id !== deviceId.value || token !== versionToken) return

    if (page === 1) {
      versions.value = []
      versionTotal.value = 0
    }
    failedVersionPage.value = page
    versionsError.value = getApiError(err)
  } finally {
    if (id === deviceId.value && token === versionToken) versionsLoading.value = false
  }
}

function refreshVersions() {
  void loadVersions(deviceId.value, 1)
}

function retryVersions() {
  void loadVersions(deviceId.value, failedVersionPage.value)
}

function goToVersionPage(page: number) {
  const id = deviceId.value
  const target = Math.min(Math.max(page, 1), versionTotalPages.value)
  if (!id || target === versionPage.value || versionsLoading.value) return
  void loadVersions(id, target)
}

watch(versionPageSize, () => {
  versionPage.value = 1
  void loadVersions(deviceId.value, 1)
})

const expandedVersions = ref<number[]>([])
const detailLoading = ref<Record<number, boolean>>({})
const detailErrors = ref<Record<number, string>>({})
const versionDetails = new Map<number, ConfigVersionResponse>()
const requestedDetails = new Set<number>()

function detailFor(version: number) {
  return versionDetails.get(version)
}

async function loadVersionDetail(version: number) {
  const idAtStart = deviceId.value
  if (!idAtStart) return

  detailLoading.value[version] = true
  detailErrors.value[version] = ''
  requestedDetails.add(version)

  try {
    const data = await getConfigVersion(idAtStart, version)
    if (idAtStart !== deviceId.value) return
    versionDetails.set(version, data)
  } catch (err) {
    if (idAtStart !== deviceId.value) return
    detailErrors.value[version] = getApiError(err)
  } finally {
    if (idAtStart === deviceId.value) detailLoading.value[version] = false
  }
}

function toggleVersion(version: number) {
  if (expandedVersions.value.includes(version)) {
    expandedVersions.value = expandedVersions.value.filter((item) => item !== version)
    return
  }

  expandedVersions.value = [...expandedVersions.value, version]
  if (!versionDetails.has(version) && !requestedDetails.has(version)) void loadVersionDetail(version)
}

function retryVersionDetail(version: number) {
  requestedDetails.delete(version)
  void loadVersionDetail(version)
}

function thresholdFields(key: ActuatorKey): { label: string; field: ThresholdField }[] {
  if (key === 'pump') {
    return [
      { label: 'Turn ON below', field: 'turn_on_below' },
      { label: 'Turn OFF above', field: 'turn_off_above' },
    ]
  }

  return [
    { label: 'Turn ON above', field: 'turn_on_above' },
    { label: 'Turn OFF below', field: 'turn_off_below' },
  ]
}

function detailThresholds(version: number, key: ActuatorKey) {
  const actuator = detailFor(version)?.config.actuators[key]
  return thresholdFields(key).map((field) => ({
    label: field.label,
    value: actuator?.[field.field] ?? '–',
  }))
}

function detailAutomation(version: number) {
  return detailFor(version)?.config.configuration.automation ? 'On' : 'Off'
}

function detailTelemetry(version: number) {
  return detailFor(version)?.config.configuration.telemetry_interval_sec ?? '–'
}

function detailActuator(version: number, key: ActuatorKey) {
  return detailFor(version)?.config.actuators[key]
}

function detailMetric(version: number, key: ActuatorKey) {
  const metric = detailActuator(version, key)?.metric
  return metric ? metricLabel(metric) : '–'
}

function detailDuty(version: number, key: ActuatorKey) {
  const duty = detailActuator(version, key)?.duty
  return duty === undefined ? '–' : `${duty}%`
}

// DashboardLayout owns the scroll container, so the routed page scrolls through <main>, not window.
function scrollToForm() {
  document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' })
}

function applyVersionValues(version: ConfigVersionResponse) {
  Object.assign(form, createForm(version.label, version.config))
  saveError.value = ''
  saveSuccess.value = ''
  hasConflict.value = false
}

function useVersion(summary: ConfigVersionSummary) {
  const version = detailFor(summary.version)
  if (!version) return

  applyVersionValues(version)
  void nextTick(scrollToForm)
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

function authorLabel(author: ConfigAuthor | null) {
  if (!author) return 'unknown'
  return author.name || author.id
}

function syncChipClass(state: ConfigResponse['sync_state']) {
  return state === 'in_sync' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
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

watch(deviceId, (id) => {
  configToken++
  versionToken++

  currentConfig.value = null
  configError.value = ''
  saveError.value = ''
  saveSuccess.value = ''
  hasConflict.value = false
  baseline.value = null
  Object.assign(form, createForm())

  versions.value = []
  versionTotal.value = 0
  versionPage.value = 1
  versionsLoading.value = false
  versionsError.value = ''
  expandedVersions.value = []
  detailLoading.value = {}
  detailErrors.value = {}
  versionDetails.clear()
  requestedDetails.clear()

  void loadConfig(id)
  void loadVersions(id, 1)
})

watch(isDirty, (dirty) => {
  if (dirty) saveSuccess.value = ''
})

onMounted(() => {
  void loadConfig(deviceId.value)
  void loadVersions(deviceId.value, 1)
})

onUnmounted(() => window.removeEventListener('beforeunload', handleBeforeUnload))
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

      <div class="flex flex-col items-end gap-2">
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            @click="restoreBaseline"
            :disabled="!isDirty"
            class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition"
            :class="!isDirty
              ? 'cursor-not-allowed border border-gray-200 bg-gray-50 text-gray-400'
              : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'"
          >
            <RotateCcw :size="16" />
            Reset
          </button>

          <button
            type="button"
            @click="saveConfiguration"
            :disabled="!isDirty || saving || !canEdit"
            class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition"
            :class="!isDirty || saving || !canEdit
              ? 'cursor-not-allowed bg-gray-100 text-gray-400'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'"
          >
            <Save :size="16" />
            {{ saving ? 'Saving...' : 'Save Changes' }}
          </button>
        </div>

        <p v-if="!canEdit" class="text-xs text-amber-700">
          Saving requires admin access
        </p>

        <p v-if="saveError" class="max-w-sm text-right text-xs text-rose-600">
          {{ saveError }}
        </p>

        <button
          v-if="hasConflict"
          type="button"
          @click="reloadAfterConflict"
          class="text-xs font-semibold text-emerald-700 underline"
        >
          Reload configuration
        </button>
      </div>
    </div>

    <div
      v-if="configError"
      class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
    >
      <span>{{ configError }}</span>
      <button type="button" @click="loadConfig(deviceId)" class="font-semibold underline">
        Retry
      </button>
    </div>

    <div
      v-if="configLoading"
      class="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white p-6 text-sm text-gray-500 shadow-sm"
    >
      <RefreshCw :size="16" class="animate-spin text-emerald-600" />
      Loading configuration...
    </div>

    <template v-else>
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

        <div
          v-if="currentConfig"
          class="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-gray-100 px-5 py-3 text-xs text-gray-500 sm:px-6"
        >
          <template v-if="currentConfig.version === null">
            <span>No configuration saved yet, showing built-in defaults</span>
          </template>
          <template v-else>
            <span class="font-semibold text-gray-700">Version {{ currentConfig.version }}</span>
            <span>·</span>
            <span>{{ currentConfig.label }}</span>
            <span>·</span>
            <span>changed by {{ authorLabel(currentConfig.changed_by) }}</span>
            <span
              class="rounded-full px-2 py-0.5 font-semibold"
              :class="syncChipClass(currentConfig.sync_state)"
            >
              {{ currentConfig.sync_state === 'in_sync' ? 'In sync' : 'Pending' }}
            </span>
          </template>
        </div>

        <div class="space-y-6 p-5 sm:p-6">
          <div>
            <label for="config-label" class="mb-2 block text-sm font-semibold text-gray-800">
              Configuration Label
            </label>
            <input
              id="config-label"
              v-model="form.label"
              type="text"
              maxlength="128"
              placeholder="e.g. Baseline setup"
              :disabled="formUnavailable"
              class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <p class="mt-1.5 text-xs text-gray-400">
              Identifies this configuration in the version history.
            </p>
          </div>

          <div class="border-t border-gray-100" />

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
              :aria-checked="form.config.configuration.automation"
              :disabled="formUnavailable"
              @click="form.config.configuration.automation = !form.config.configuration.automation"
              class="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50"
              :class="form.config.configuration.automation ? 'bg-emerald-600' : 'bg-gray-300'"
            >
              <span
                class="inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition"
                :class="form.config.configuration.automation ? 'translate-x-6' : 'translate-x-1'"
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
                  v-model.number="form.config.configuration.telemetry_interval_sec"
                  type="number"
                  min="1"
                  step="1"
                  :disabled="formUnavailable"
                  class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-16 text-sm font-medium text-gray-800 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                />
                <span class="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  seconds
                </span>
              </div>
              <p class="mt-1.5 text-xs text-gray-400">
                Seconds between telemetry reports
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

        <div
          v-for="actuator in actuatorList"
          :key="actuator.key"
          class="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
        >
          <div class="flex flex-col justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
            <div class="flex items-center gap-3">
              <div
                class="rounded-xl p-2.5"
                :class="actuator.key === 'pump' ? 'bg-blue-50 text-blue-600' : 'bg-sky-50 text-sky-600'"
              >
                <component :is="actuator.icon" :size="22" />
              </div>
              <div>
                <h3 class="font-semibold text-gray-900">{{ actuator.name }}</h3>
                <p class="text-xs text-gray-500">{{ actuator.key.toUpperCase() }} actuator settings</p>
              </div>
            </div>

            <label class="inline-flex cursor-pointer items-center gap-2">
              <span class="text-sm text-gray-600">
                {{ form.config.actuators[actuator.key].enabled ? 'Enabled' : 'Disabled' }}
              </span>
              <input
                v-model="form.config.actuators[actuator.key].enabled"
                type="checkbox"
                class="peer sr-only"
                :disabled="formUnavailable"
              />
              <span class="relative h-6 w-11 rounded-full bg-gray-200 transition peer-checked:bg-emerald-600 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-5" />
            </label>
          </div>

          <div
            class="space-y-5 p-5 sm:p-6"
            :class="{ 'opacity-50': !form.config.actuators[actuator.key].enabled }"
          >
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label class="mb-2 block text-sm font-medium text-gray-700">
                  Monitoring Metric
                </label>
                <select
                  v-model="form.config.actuators[actuator.key].metric"
                  :disabled="formUnavailable || !form.config.actuators[actuator.key].enabled"
                  class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed"
                >
                  <option v-for="metric in metricOptions" :key="metric.value" :value="metric.value">
                    {{ metric.label }}
                  </option>
                </select>
                <p class="mt-1.5 text-xs text-gray-400">
                  Selected: {{ metricLabel(form.config.actuators[actuator.key].metric) }}
                </p>
              </div>

              <div>
                <label class="mb-2 block text-sm font-medium text-gray-700">
                  Duty Level
                </label>
                <input
                  v-model.number="form.config.actuators[actuator.key].duty"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  :disabled="formUnavailable || !form.config.actuators[actuator.key].enabled"
                  class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 disabled:cursor-not-allowed"
                />
                <p class="mt-1.5 text-xs text-gray-400">
                  Output level from 0 to 100
                </p>
              </div>
            </div>

            <div>
              <h4 class="mb-3 text-sm font-semibold text-gray-800">
                Activation Thresholds
              </h4>
              <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div v-for="field in thresholdFields(actuator.key)" :key="field.field">
                  <label class="mb-2 block text-xs font-medium text-gray-500">
                    {{ field.label }}
                  </label>
                  <input
                    v-model.number="form.config.actuators[actuator.key][field.field]"
                    type="number"
                    step="any"
                    :disabled="formUnavailable || !form.config.actuators[actuator.key].enabled"
                    class="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-emerald-500 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>

    <!-- Save feedback -->
    <div
      v-if="saveSuccess"
      class="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
    >
      <CheckCircle2 :size="18" />
      {{ saveSuccess }}
    </div>

    <!-- Version history -->
    <section>
      <div class="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h4 class="text-lg font-bold text-gray-900">
            Configuration Versions
          </h4>
          <p class="mt-1 text-sm text-gray-500">
            Browse saved revisions and reuse their settings.
          </p>
        </div>

        <button
          type="button"
          @click="refreshVersions"
          :disabled="versionsLoading"
          class="flex w-fit items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw :size="16" />
          Refresh
        </button>
      </div>

      <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div v-if="versionsLoading" class="flex items-center gap-2 p-6 text-sm text-gray-500">
          <RefreshCw :size="16" class="animate-spin text-emerald-600" />
          Loading versions...
        </div>

        <p v-else-if="versions.length === 0" class="p-6 text-sm text-gray-500">
          No saved versions yet
        </p>

        <ul v-else class="divide-y divide-gray-100">
          <li v-for="version in versions" :key="version.version">
            <button
              type="button"
              @click="toggleVersion(version.version)"
              class="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-gray-50"
            >
              <div class="flex min-w-0 flex-wrap items-center gap-2">
                <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  Version {{ version.version }}
                </span>

                <span v-if="version.is_current" class="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                  Current
                </span>

                <span class="text-sm text-gray-700">{{ version.label }}</span>

                <span class="text-xs text-gray-400">
                  {{ formatDateTime(version.created_at) }}
                </span>
              </div>

              <div class="flex shrink-0 items-center gap-3 text-xs text-gray-500">
                <span>{{ authorLabel(version.changed_by) }}</span>
                <span class="text-gray-300">
                  {{ expandedVersions.includes(version.version) ? '−' : '+' }}
                </span>
              </div>
            </button>

            <div
              v-if="expandedVersions.includes(version.version)"
              class="border-t border-gray-100 bg-gray-50 px-5 py-4"
            >
              <p v-if="detailLoading[version.version]" class="flex items-center gap-2 text-xs text-gray-500">
                <RefreshCw :size="14" class="animate-spin" />
                Loading version details...
              </p>

              <div v-else-if="detailErrors[version.version]" class="flex items-center gap-2 text-xs text-rose-600">
                <span>{{ detailErrors[version.version] }}</span>
                <button type="button" @click="retryVersionDetail(version.version)" class="font-semibold underline">
                  Retry
                </button>
              </div>

              <template v-else-if="detailFor(version.version)">
                <dl class="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                  <div>
                    <dt class="text-xs font-medium text-gray-400">Automation</dt>
                    <dd class="mt-1 text-sm text-gray-700">{{ detailAutomation(version.version) }}</dd>
                  </div>

                  <div>
                    <dt class="text-xs font-medium text-gray-400">Telemetry Interval</dt>
                    <dd class="mt-1 text-sm text-gray-700">{{ detailTelemetry(version.version) }} seconds</dd>
                  </div>

                  <div v-for="actuator in actuatorList" :key="actuator.key">
                    <dt class="text-xs font-medium text-gray-400">{{ actuator.name }}</dt>
                    <dd class="mt-1 space-y-1 text-sm text-gray-700">
                      <p>Enabled: {{ detailActuator(version.version, actuator.key)?.enabled ? 'Yes' : 'No' }}</p>
                      <p>Metric: {{ detailMetric(version.version, actuator.key) }}</p>
                      <p>Duty: {{ detailDuty(version.version, actuator.key) }}</p>
                      <p v-for="field in detailThresholds(version.version, actuator.key)" :key="field.label">
                        {{ field.label }}: {{ field.value }}
                      </p>
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  @click="useVersion(version)"
                  class="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  <RotateCcw :size="16" />
                  Use this Configuration
                </button>
              </template>
            </div>
          </li>
        </ul>

        <div
          v-if="!versionsLoading && versions.length > 0"
          class="flex flex-col items-center gap-2 border-t border-gray-100 px-5 py-4 sm:flex-row sm:justify-between"
        >
          <p class="text-xs text-gray-500">
            Page {{ versionPage }} of {{ versionTotalPages }} · {{ versionTotal }} records
          </p>

          <div class="flex items-center gap-2">
            <select
              v-model.number="versionPageSize"
              aria-label="Versions per page"
              class="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              <option v-for="size in versionPageSizes" :key="size" :value="size">
                {{ size }} / page
              </option>
            </select>

            <button
              type="button"
              @click="goToVersionPage(versionPage - 1)"
              :disabled="!hasPrevVersion || versionsLoading"
              class="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <button
              type="button"
              @click="goToVersionPage(versionPage + 1)"
              :disabled="!hasNextVersion || versionsLoading"
              class="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <div v-if="versionsError" class="mt-2 flex items-center gap-2 text-xs text-rose-600">
        <span>{{ versionsError }}</span>
        <button type="button" @click="retryVersions" class="font-semibold underline">
          Retry
        </button>
      </div>
    </section>

    <!-- Unsaved changes modal -->
    <div
      v-if="modalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h4 class="text-lg font-bold text-gray-900">
          Unsaved changes
        </h4>
        <p class="mt-2 text-sm text-gray-500">
          Your configuration edits have not been saved.
        </p>

        <div class="mt-6 flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-5">
          <button
            type="button"
            @click="resolveModal('cancel')"
            class="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            type="button"
            @click="resolveModal('discard')"
            :disabled="saving"
            class="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Discard
          </button>

          <button
            type="button"
            @click="resolveModal('save')"
            :disabled="saving"
            class="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {{ saving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
