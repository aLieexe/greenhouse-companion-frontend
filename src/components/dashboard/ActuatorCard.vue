<script setup lang="ts">
import { computed, ref, watch, type Component } from 'vue'
import { Power } from 'lucide-vue-next'

import type { ActuatorRuntimeState } from '../../types/api'

interface Props {
  title: string
  description: string
  icon: Component
  state: ActuatorRuntimeState | null
  busy?: boolean
  disabled?: boolean
  error?: string
}

const props = withDefaults(defineProps<Props>(), {
  busy: false,
  disabled: false,
  error: '',
})

const emit = defineEmits<{
  toggle: []
  'set-duty': [value: number]
  'take-manual': []
}>()

const draftDuty = ref(props.state?.duty ?? 0)

watch(() => props.state?.duty, (duty) => {
  if (duty !== undefined) {
    draftDuty.value = duty
  }
})

const modeLabel = computed(() => {
  if (props.state?.mode === 'manual') return 'Manual'
  if (props.state?.mode === 'automatic') return 'Automatic'
  return 'Unknown'
})

const powerLabel = computed(() => {
  if (!props.state) return 'Power: Unknown'
  return props.state.on ? 'Power: On' : 'Power: Off'
})

const controlsDisabled = computed(() => props.disabled || props.busy || !props.state)
const sliderDisabled = computed(() => controlsDisabled.value || props.state?.mode === 'automatic')
const applyDisabled = computed(() => sliderDisabled.value || draftDuty.value === props.state?.duty)
</script>

<template>
  <div class="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <div class="flex items-start justify-between">
      <div
        class="flex h-11 w-11 items-center justify-center rounded-xl"
        :class="state?.on
          ? 'bg-emerald-50 text-emerald-600'
          : 'bg-gray-100 text-gray-500'"
      >
        <component :is="icon" :size="22" />
      </div>

      <span
        class="rounded-full px-3 py-1 text-xs font-medium"
        :class="state?.mode === 'manual'
          ? 'bg-emerald-50 text-emerald-700'
          : state?.mode === 'automatic'
            ? 'bg-blue-50 text-blue-700'
            : 'bg-gray-100 text-gray-500'"
      >
        {{ modeLabel }}
      </span>
    </div>

    <div class="mt-5">
      <h3 class="font-semibold text-gray-900">
        {{ title }}
      </h3>

      <p class="mt-1 text-sm text-gray-500">
        {{ description }}
      </p>

      <p class="mt-2 text-xs text-gray-500">
        {{ powerLabel }}
      </p>
    </div>

    <div class="mt-5">
      <div class="flex items-center justify-between text-xs">
        <span class="font-medium text-gray-500">Duty cycle</span>
        <span class="font-semibold text-gray-700">{{ draftDuty }}%</span>
      </div>

      <input
        v-model.number="draftDuty"
        type="range"
        min="0"
        max="100"
        :disabled="sliderDisabled"
        class="mt-2 w-full accent-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>

    <div class="mt-4 space-y-2">
      <button
        v-if="state?.mode === 'automatic'"
        type="button"
        :disabled="controlsDisabled"
        @click="emit('take-manual')"
        class="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
      >
        Take Manual Control
      </button>

      <button
        type="button"
        :disabled="sliderDisabled"
        @click="emit('toggle')"
        class="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
        :class="state?.on
          ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          : 'bg-emerald-600 text-white hover:bg-emerald-700'"
      >
        <Power :size="16" />
        {{ state?.on ? 'Turn Off' : 'Turn On' }}
      </button>

      <button
        type="button"
        :disabled="applyDisabled"
        @click="emit('set-duty', draftDuty)"
        class="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Apply Duty
      </button>
    </div>

    <p v-if="error" class="mt-3 text-xs text-rose-600">
      {{ error }}
    </p>
  </div>
</template>
