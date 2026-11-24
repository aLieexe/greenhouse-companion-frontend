import { onScopeDispose, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import { refresh as refreshRequest } from '../api/auth'
import { buildTelemetrySocketUrl } from '../api/telemetry'
import type { Telemetry } from '../types/api'

export type TelemetrySocketStatus = 'connecting' | 'live' | 'reconnecting' | 'failed'

const MAX_RETRY_DELAY_MS = 15_000
const REFRESH_AFTER_ATTEMPTS = 3

export function useTelemetrySocket(deviceId: MaybeRefOrGetter<string>) {
  const status = ref<TelemetrySocketStatus>('connecting')
  const latest = ref<Telemetry | null>(null)

  let socket: WebSocket | null = null
  let retryTimer: ReturnType<typeof setTimeout> | null = null
  let attempts = 0
  let refreshed = false
  let disposed = false

  function clearRetry() {
    if (retryTimer !== null) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }

  function closeSocket() {
    if (!socket) return

    const current = socket
    socket = null
    current.onopen = null
    current.onmessage = null
    current.onerror = null
    current.onclose = null

    if (current.readyState === WebSocket.OPEN || current.readyState === WebSocket.CONNECTING) {
      current.close()
    }
  }

  function armRetry(delay: number) {
    if (disposed) return

    clearRetry()
    retryTimer = setTimeout(() => {
      retryTimer = null
      connect()
    }, delay)
  }

  function scheduleReconnect() {
    if (disposed) return

    clearRetry()
    attempts += 1
    status.value = 'reconnecting'

    const delay = Math.min(1000 * 2 ** (attempts - 1), MAX_RETRY_DELAY_MS)

    // The handshake cannot refresh the access cookie itself.
    if (attempts >= REFRESH_AFTER_ATTEMPTS && !refreshed) {
      refreshed = true

      refreshRequest()
        .catch(() => { status.value = 'failed' })
        .finally(() => armRetry(delay))
      return
    }

    armRetry(delay)
  }

  function connect() {
    if (disposed) return

    closeSocket()

    const id = toValue(deviceId)
    if (!id) return

    let ws: WebSocket
    try {
      ws = new WebSocket(buildTelemetrySocketUrl(id))
    } catch {
      scheduleReconnect()
      return
    }

    socket = ws

    ws.onopen = () => {
      if (socket !== ws || disposed) return

      attempts = 0
      refreshed = false
      status.value = 'live'
    }

    ws.onmessage = (event) => {
      if (socket !== ws || disposed || typeof event.data !== 'string') return

      try {
        const frame: unknown = JSON.parse(event.data)
        if (frame && typeof frame === 'object' && 'metrics' in frame) {
          latest.value = frame as Telemetry
        }
      } catch {
        // A malformed frame must not break the stream for later frames.
      }
    }

    ws.onerror = () => {
      if (socket !== ws || disposed) return
      ws.close()
    }

    ws.onclose = () => {
      if (socket !== ws || disposed) return

      socket = null
      scheduleReconnect()
    }
  }

  watch(() => toValue(deviceId), (id, previousId) => {
    if (id === previousId || disposed) return

    attempts = 0
    refreshed = false
    latest.value = null
    status.value = 'connecting'
    connect()
  })

  onScopeDispose(() => {
    disposed = true
    clearRetry()
    closeSocket()
  })

  connect()

  return { status, latest }
}
