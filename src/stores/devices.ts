import { defineStore } from 'pinia'
import { ref } from 'vue'

import { listDevices } from '../api/devices'
import { getApiError } from '../api/http'
import type { Device } from '../types/api'

export const useDevicesStore = defineStore('devices', () => {
  const devices = ref<Device[]>([])
  const loading = ref(false)
  const error = ref('')
  const loaded = ref(false)

  let inFlight: Promise<void> | null = null

  async function refresh(): Promise<void> {
    loading.value = true
    error.value = ''

    try {
      devices.value = await listDevices()
      loaded.value = true
    } catch (err) {
      error.value = getApiError(err)
    } finally {
      loading.value = false
    }
  }

  async function ensureLoaded(): Promise<void> {
    if (loaded.value) {
      return
    }

    if (!inFlight) {
      inFlight = refresh().finally(() => {
        inFlight = null
      })
    }

    await inFlight
  }

  function deviceById(id: string): Device | undefined {
    return devices.value.find((device) => device.id === id)
  }

  return {
    devices,
    loading,
    error,
    loaded,
    ensureLoaded,
    refresh,
    deviceById,
  }
})
