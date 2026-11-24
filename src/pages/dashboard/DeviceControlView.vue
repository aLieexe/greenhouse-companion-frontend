<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, type Component } from 'vue'
import { useRoute } from 'vue-router'

import {
  Activity,
  Droplets,
  Fan,
  Power,
  RefreshCw,
  SlidersHorizontal,
  Zap,
} from 'lucide-vue-next'

import { getActuatorState, getCommand, listCommands, sendCommand } from '../../api/commands'
import { getApiError } from '../../api/http'
import { useAuthStore } from '../../stores/auth'
import { useDevicesStore } from '../../stores/devices'
import type {
  ActuatorKey,
  ActuatorRuntimeState,
  DeviceCommand,
  DeviceCommandSummary,
  SetActuatorCommand,
} from '../../types/api'

const route = useRoute()
const authStore = useAuthStore()
const devicesStore = useDevicesStore()
const deviceId = computed(() => String(route.params.deviceId ?? ''))

const actuatorKeys: ActuatorKey[] = ['pump', 'fan-1', 'fan-2']

const actuatorList: {
  key: ActuatorKey
  name: string
  description: string
  icon: Component
}[] = [
  {
    key: 'pump',
    name: 'Water Pump',
    description: 'Water distribution and irrigation system',
    icon: Droplets,
  },
  {
    key: 'fan-1',
    name: 'Cooling Fan 1',
    description: 'Greenhouse ventilation and air circulation',
    icon: Fan,
  },
  {
    key: 'fan-2',
    name: 'Cooling Fan 2',
    description: 'Greenhouse ventilation and air circulation',
    icon: Fan,
  },
]

const actuatorStates = ref<Partial<Record<ActuatorKey, ActuatorRuntimeState>>>({})
const draftDuties = ref<Record<ActuatorKey, number>>({
  pump: 0,
  'fan-1': 0,
  'fan-2': 0,
})
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

const hasReportedState = computed(() => Object.keys(actuatorStates.value).length > 0)
const activeCount = computed(
  () => actuatorKeys.filter((key) => actuatorStates.value[key]?.on === true).length,
)

const canControl = computed(
  () => devicesStore.deviceById(deviceId.value)?.role !== 'viewer',
)

watch(actuatorStates, (states) => {
  for (const key of actuatorKeys) {
    const duty = states[key]?.duty
    if (duty !== undefined) draftDuties.value[key] = duty
  }
})

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
    if (id === deviceId.value) {
      scheduleActuatorRefetch(id)
      void loadCommands(id, 1)
    }
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
  if (!state || state.mode === 'automatic' || actuatorBusy.value[key]) return

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
  if (!state || state.mode === 'automatic' || actuatorBusy.value[key]) return
  if (duty === state.duty) return

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

function powerBadgeLabel(state?: ActuatorRuntimeState) {
  if (!state) return 'Unknown'
  return state.on ? 'Active' : 'Inactive'
}

function powerBadgeClass(state?: ActuatorRuntimeState) {
  return state?.on ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
}

function modeBadgeLabel(state?: ActuatorRuntimeState) {
  if (state?.mode === 'manual') return 'Manual'
  if (state?.mode === 'automatic') return 'Automatic'
  return 'Unknown'
}

function modeBadgeClass(state?: ActuatorRuntimeState) {
  return state?.mode === 'manual'
    ? 'bg-emerald-50 text-emerald-700'
    : state?.mode === 'automatic'
      ? 'bg-blue-50 text-blue-700'
      : 'bg-gray-100 text-gray-500'
}

function controlsDisabled(key: ActuatorKey) {
  return !canControl.value || actuatorBusy.value[key] || !actuatorStates.value[key]
}

function powerDisabled(key: ActuatorKey) {
  return controlsDisabled(key) || actuatorStates.value[key]?.mode === 'automatic'
}

function applyDisabled(key: ActuatorKey) {
  const state = actuatorStates.value[key]
  return powerDisabled(key) || !state || draftDuties.value[key] === state.duty
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

const commands = ref<DeviceCommandSummary[]>([])
const commandTotal = ref(0)
const commandPage = ref(1)
const commandsLoading = ref(false)
const commandsLoadingMore = ref(false)
const commandsError = ref('')
const failedPage = ref(1)
const hasMoreCommands = computed(() => commands.value.length < commandTotal.value)

async function loadCommands(id: string, page: number) {
  if (id !== deviceId.value) return

  const initial = page === 1
  if (initial) commandsLoading.value = true
  else commandsLoadingMore.value = true
  commandsError.value = ''

  try {
    const response = await listCommands(id, { page, limit: 20 })
    if (id !== deviceId.value) return

    if (initial) {
      commands.value = response.commands
    } else {
      const known = new Set(commands.value.map((command) => command.id))
      commands.value = [
        ...commands.value,
        ...response.commands.filter((command) => !known.has(command.id)),
      ]
    }

    commandTotal.value = response.total_count
    commandPage.value = response.page
    failedPage.value = page
  } catch (err) {
    if (id !== deviceId.value) return

    if (initial) {
      commands.value = []
      commandTotal.value = 0
    }
    failedPage.value = page
    commandsError.value = getApiError(err)
  } finally {
    if (id === deviceId.value) {
      commandsLoading.value = false
      commandsLoadingMore.value = false
    }
  }
}

function refreshCommands() {
  void loadCommands(deviceId.value, 1)
}

function retryCommands() {
  void loadCommands(deviceId.value, failedPage.value)
}

function loadMoreCommands() {
  if (commandsLoadingMore.value || !hasMoreCommands.value) return
  void loadCommands(deviceId.value, commandPage.value + 1)
}

const expandedIds = ref<string[]>([])
const detailLoading = ref<Record<string, boolean>>({})
const detailErrors = ref<Record<string, string>>({})
const commandDetails = new Map<string, DeviceCommand>()
const requestedDetails = new Set<string>()

function detailFor(id: string) {
  return commandDetails.get(id)
}

async function loadCommandDetail(id: string) {
  const idAtStart = deviceId.value
  detailLoading.value[id] = true
  detailErrors.value[id] = ''
  requestedDetails.add(id)

  try {
    const data = await getCommand(idAtStart, id)
    if (idAtStart !== deviceId.value) return
    commandDetails.set(id, data)
  } catch (err) {
    if (idAtStart !== deviceId.value) return
    detailErrors.value[id] = getApiError(err)
  } finally {
    if (idAtStart === deviceId.value) detailLoading.value[id] = false
  }
}

function toggleCommand(id: string) {
  if (expandedIds.value.includes(id)) {
    expandedIds.value = expandedIds.value.filter((item) => item !== id)
    return
  }

  expandedIds.value = [...expandedIds.value, id]
  if (!commandDetails.has(id) && !requestedDetails.has(id)) void loadCommandDetail(id)
}

function actionLabel(action: string) {
  if (action === 'set_actuator') return 'Set Actuator'
  if (action === 'reboot') return 'Reboot'
  return action
}

function statusLabel(status: string) {
  if (!status) return 'Unknown'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function statusBadgeClass(status: string) {
  if (status === 'pending') return 'bg-gray-100 text-gray-600'
  if (status === 'accepted') return 'bg-amber-50 text-amber-700'
  if (status === 'completed') return 'bg-emerald-50 text-emerald-700'
  if (status === 'failed' || status === 'rejected') return 'bg-rose-50 text-rose-700'
  return 'bg-gray-100 text-gray-600'
}

function payloadText(id: string, key: string) {
  const value = commandDetails.get(id)?.payload[key]
  if (value === undefined || value === null) return '-'
  if (key === 'state') return value ? 'On' : 'Off'
  if (key === 'duty') return typeof value === 'number' ? `${value}%` : String(value)
  return String(value)
}

function detailAck(id: string) {
  return commandDetails.get(id)?.ack_result
}

function detailAckedAt(id: string) {
  const value = commandDetails.get(id)?.acked_at
  return value ? formatDateTime(value) : '-'
}

function detailStatus(id: string) {
  return commandDetails.get(id)?.status ?? ''
}

onMounted(() => {
  void loadActuatorState()
  void loadCommands(deviceId.value, 1)
})

watch(deviceId, (id) => {
  clearRefetchTimers()
  actuatorStates.value = {}
  actuatorLoadError.value = ''

  for (const key of actuatorKeys) {
    draftDuties.value[key] = 0
    actuatorBusy.value[key] = false
    actuatorErrors.value[key] = ''
  }

  commands.value = []
  commandTotal.value = 0
  commandPage.value = 1
  commandsError.value = ''
  commandsLoading.value = false
  commandsLoadingMore.value = false
  expandedIds.value = []
  detailLoading.value = {}
  detailErrors.value = {}
  commandDetails.clear()
  requestedDetails.clear()

  void loadActuatorState()
  void loadCommands(id, 1)
})

onUnmounted(clearRefetchTimers)
</script>

<template>
  <div>
    <!-- Page Introduction -->
    <section class="mb-8">
      <h3 class="text-2xl font-bold text-gray-900">
        Device Control
      </h3>

      <p class="mt-1 text-sm text-gray-500">
        Manage and adjust your greenhouse equipment.
      </p>
    </section>

    <!-- Control Summary -->
    <section class="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-500">
              Total Actuators
            </p>

            <p class="mt-2 text-3xl font-bold text-gray-900">
              {{ actuatorList.length }}
            </p>
          </div>

          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <SlidersHorizontal :size="22" />
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-500">
              Active Actuators
            </p>

            <p class="mt-2 text-3xl font-bold text-emerald-600">
              {{ hasReportedState ? activeCount : '—' }}
            </p>
          </div>

          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Activity :size="22" />
          </div>
        </div>
      </div>
    </section>

    <!-- Actuator Controls -->
    <section class="mb-8">
      <div class="mb-4">
        <h4 class="text-lg font-bold text-gray-900">
          Actuator Management
        </h4>

        <p class="mt-1 text-sm text-gray-500">
          Control individual greenhouse equipment.
        </p>

        <p v-if="!canControl" class="mt-2 text-xs text-amber-700">
          Control requires admin access.
        </p>

        <p v-if="actuatorLoadError" class="mt-2 text-xs text-rose-600">
          {{ actuatorLoadError }}
        </p>
      </div>

      <div class="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <article
          v-for="actuator in actuatorList"
          :key="actuator.key"
          class="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <!-- Actuator Header -->
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-4">
              <div
                class="flex h-12 w-12 items-center justify-center rounded-xl"
                :class="actuatorStates[actuator.key]?.on
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-gray-100 text-gray-500'"
              >
                <component :is="actuator.icon" :size="24" />
              </div>

              <div>
                <h5 class="font-bold text-gray-900">
                  {{ actuator.name }}
                </h5>

                <p class="mt-1 font-mono text-xs text-gray-400">
                  {{ actuator.key.toUpperCase() }}
                </p>
              </div>
            </div>

            <div class="flex flex-col items-end gap-2">
              <span
                class="rounded-full px-3 py-1 text-xs font-semibold"
                :class="powerBadgeClass(actuatorStates[actuator.key])"
              >
                {{ powerBadgeLabel(actuatorStates[actuator.key]) }}
              </span>

              <span
                class="rounded-full px-3 py-1 text-xs font-medium"
                :class="modeBadgeClass(actuatorStates[actuator.key])"
              >
                {{ modeBadgeLabel(actuatorStates[actuator.key]) }}
              </span>
            </div>
          </div>

          <p class="mt-5 text-sm text-gray-500">
            {{ actuator.description }}
          </p>

          <!-- Power Control -->
          <div class="mt-6 flex items-center justify-between border-t border-gray-100 pt-5">
            <div>
              <p class="text-sm font-semibold text-gray-800">
                Power Status
              </p>

              <p class="mt-1 text-xs text-gray-500">
                {{ !actuatorStates[actuator.key]
                  ? 'No state reported'
                  : actuatorStates[actuator.key]?.on
                    ? 'Currently running'
                    : 'Currently stopped' }}
              </p>
            </div>

            <button
              type="button"
              @click="toggleActuator(actuator.key)"
              :disabled="powerDisabled(actuator.key)"
              class="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
              :class="actuatorStates[actuator.key]?.on
                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'"
            >
              <Power :size="17" />
              {{ actuatorStates[actuator.key]?.on ? 'Turn Off' : 'Turn On' }}
            </button>
          </div>

          <!-- Duty Control -->
          <div class="mt-6 border-t border-gray-100 pt-5">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-semibold text-gray-800">
                  Duty Level
                </p>

                <p class="mt-1 text-xs text-gray-500">
                  Adjust actuator output level
                </p>
              </div>

              <span class="text-xl font-bold text-gray-900 tabular-nums">
                {{ draftDuties[actuator.key] }}%
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              step="5"
              :value="draftDuties[actuator.key]"
              @input="draftDuties[actuator.key] = Number(($event.target as HTMLInputElement).value)"
              :disabled="powerDisabled(actuator.key)"
              class="mt-5 w-full cursor-pointer accent-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
            />

            <div class="mt-2 flex justify-between text-xs text-gray-400">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>

            <div class="mt-3 flex justify-end">
              <button
                type="button"
                @click="setDuty(actuator.key, draftDuties[actuator.key])"
                :disabled="applyDisabled(actuator.key)"
                class="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Apply Duty
              </button>
            </div>
          </div>

          <button
            v-if="actuatorStates[actuator.key]?.mode === 'automatic'"
            type="button"
            @click="takeManual(actuator.key)"
            :disabled="!canControl || actuatorBusy[actuator.key]"
            class="mt-4 w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
          >
            Take Manual Control
          </button>

          <p v-if="actuatorErrors[actuator.key]" class="mt-3 text-xs text-rose-600">
            {{ actuatorErrors[actuator.key] }}
          </p>

          <!-- Actuator Footer -->
          <div class="mt-6 flex items-center gap-2 rounded-xl bg-gray-50 p-3">
            <Zap
              :size="16"
              :class="actuatorStates[actuator.key]?.on ? 'text-emerald-600' : 'text-gray-400'"
            />

            <p class="text-xs text-gray-500">
              {{
                !actuatorStates[actuator.key]
                  ? 'Awaiting device state'
                  : actuatorStates[actuator.key]?.on
                    ? `Running at ${actuatorStates[actuator.key]?.duty}% duty level`
                    : 'Actuator is currently inactive'
              }}
            </p>
          </div>
        </article>
      </div>
    </section>

    <!-- Command History -->
    <section>
      <div class="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h4 class="text-lg font-bold text-gray-900">
            Command History
          </h4>

          <p class="mt-1 text-sm text-gray-500">
            Audit trail of commands sent to this device.
          </p>
        </div>

        <button
          type="button"
          @click="refreshCommands"
          :disabled="commandsLoading"
          class="flex w-fit items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw :size="16" />
          Refresh
        </button>
      </div>

      <div class="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div v-if="commandsLoading" class="flex items-center gap-2 p-6 text-sm text-gray-500">
          <RefreshCw :size="16" class="animate-spin text-emerald-600" />
          Loading commands...
        </div>

        <p v-else-if="commands.length === 0" class="p-6 text-sm text-gray-500">
          No commands yet.
        </p>

        <ul v-else class="divide-y divide-gray-100">
          <li v-for="command in commands" :key="command.id">
            <button
              type="button"
              @click="toggleCommand(command.id)"
              class="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-gray-50"
            >
              <div class="flex min-w-0 flex-wrap items-center gap-2">
                <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  {{ actionLabel(command.action) }}
                </span>

                <span
                  class="rounded-full px-3 py-1 text-xs font-semibold"
                  :class="statusBadgeClass(command.status)"
                >
                  {{ statusLabel(command.status) }}
                </span>

                <span class="text-xs text-gray-400">
                  {{ formatDateTime(command.created_at) }}
                </span>
              </div>

              <div class="flex shrink-0 items-center gap-3 text-xs text-gray-500">
                <span v-if="command.triggered_by === authStore.user?.id" class="font-medium text-gray-600">
                  You
                </span>

                <code v-else :title="command.triggered_by" class="max-w-32 truncate font-mono text-gray-500">
                  {{ command.triggered_by }}
                </code>

                <span class="text-gray-300">
                  {{ expandedIds.includes(command.id) ? '−' : '+' }}
                </span>
              </div>
            </button>

            <div
              v-if="expandedIds.includes(command.id)"
              class="border-t border-gray-100 bg-gray-50 px-5 py-4"
            >
              <p v-if="detailLoading[command.id]" class="flex items-center gap-2 text-xs text-gray-500">
                <RefreshCw :size="14" class="animate-spin" />
                Loading command details...
              </p>

              <p v-else-if="detailErrors[command.id]" class="text-xs text-rose-600">
                {{ detailErrors[command.id] }}
              </p>

              <template v-else-if="detailFor(command.id)">
                <dl class="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                  <div>
                    <dt class="text-xs font-medium text-gray-400">Action</dt>
                    <dd class="mt-1 text-sm text-gray-700">{{ payloadText(command.id, 'action') }}</dd>
                  </div>

                  <div>
                    <dt class="text-xs font-medium text-gray-400">Actuator</dt>
                    <dd class="mt-1 text-sm text-gray-700">{{ payloadText(command.id, 'actuator') }}</dd>
                  </div>

                  <div>
                    <dt class="text-xs font-medium text-gray-400">State</dt>
                    <dd class="mt-1 text-sm text-gray-700">{{ payloadText(command.id, 'state') }}</dd>
                  </div>

                  <div>
                    <dt class="text-xs font-medium text-gray-400">Duty</dt>
                    <dd class="mt-1 text-sm text-gray-700">{{ payloadText(command.id, 'duty') }}</dd>
                  </div>

                  <div>
                    <dt class="text-xs font-medium text-gray-400">Mode</dt>
                    <dd class="mt-1 text-sm text-gray-700">{{ payloadText(command.id, 'mode') }}</dd>
                  </div>

                  <div>
                    <dt class="text-xs font-medium text-gray-400">Command ID</dt>
                    <dd
                      class="mt-1 break-all font-mono text-xs text-gray-700"
                      :title="payloadText(command.id, 'command_id')"
                    >
                      {{ payloadText(command.id, 'command_id') }}
                    </dd>
                  </div>
                </dl>

                <div class="mt-4">
                  <p class="text-xs font-medium text-gray-400">Ack Result</p>

                  <pre
                    v-if="detailAck(command.id)"
                    class="mt-1 overflow-x-auto rounded-xl bg-white p-3 text-xs leading-5 text-gray-700 ring-1 ring-gray-200"
                  >{{ JSON.stringify(detailAck(command.id), null, 2) }}</pre>

                  <p v-else class="mt-1 text-xs text-gray-400">
                    Awaiting device acknowledgement
                  </p>
                </div>

                <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-gray-200 pt-3 text-xs">
                  <span class="text-gray-500">
                    Acked At: <span class="text-gray-700">{{ detailAckedAt(command.id) }}</span>
                  </span>

                  <span class="flex items-center gap-2 text-gray-500">
                    Status:
                    <span
                      class="rounded-full px-2 py-0.5 font-semibold"
                      :class="statusBadgeClass(detailStatus(command.id))"
                    >
                      {{ statusLabel(detailStatus(command.id)) }}
                    </span>
                  </span>
                </div>
              </template>
            </div>
          </li>
        </ul>

        <div
          v-if="!commandsLoading && commands.length > 0"
          class="flex flex-col items-center gap-2 border-t border-gray-100 px-5 py-4 sm:flex-row sm:justify-between"
        >
          <p class="text-xs text-gray-500">
            Showing {{ commands.length }} of {{ commandTotal }}
          </p>

          <button
            v-if="hasMoreCommands"
            type="button"
            @click="loadMoreCommands"
            :disabled="commandsLoadingMore"
            class="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Load more
          </button>
        </div>
      </div>

      <div v-if="commandsError" class="mt-2 flex items-center gap-2 text-xs text-rose-600">
        <span>{{ commandsError }}</span>
        <button type="button" @click="retryCommands" class="font-semibold underline">
          Retry
        </button>
      </div>
    </section>
  </div>
</template>
