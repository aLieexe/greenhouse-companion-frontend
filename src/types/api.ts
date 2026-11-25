export interface MessageResponse {
  message: string
}

export interface User {
  id: string
  username: string
}

export interface UserContext {
  UserID: string
  Username: string
  CSRFToken?: string
}

export interface ApiError {
  errorCode: string
  message: string
  status: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface RegisterRequest {
  username: string
  password: string
}

export interface RegisterResponse {
  id: string
  username: string
}

export type DeviceStatus = 'unknown' | 'online' | 'offline'

export type DeviceRole = 'owner' | 'admin' | 'viewer'

export interface Device {
  id: string
  name: string
  hardware_id: string
  status: DeviceStatus
  role: DeviceRole
  created_at: string
}

export interface RegisterDeviceRequest {
  name: string
  hardware_id: string
}

export interface UpdateDeviceRequest {
  name: string
  hardware_id: string
}

export interface DeviceDetail {
  id: string
  hardware_id: string
  name: string
  created_at: string
  status: DeviceStatus
  role?: DeviceRole
  boot_id?: string
  current_ip?: string
  last_seen_at?: string
}

export type ActuatorKey = 'pump' | 'fan-1' | 'fan-2'

export type ActuatorMode = 'manual' | 'automatic'

export interface ActuatorRuntimeState {
  on: boolean
  duty: number
  mode: ActuatorMode
}

export interface ActuatorStateResponse {
  device_id: string
  actuators?: Partial<Record<ActuatorKey, ActuatorRuntimeState>>
  reported_at?: string
  received_at?: string
}

export interface TelemetryMetrics {
  ambient_temp_c?: number
  ambient_humidity?: number
  soil_temp_c?: number
  soil_moisture?: number
}

export interface TelemetryActuatorState {
  on: boolean
  duty: number
}

export interface Telemetry {
  device_id: string
  boot_id: string
  seq: number
  received_at: string
  metrics: TelemetryMetrics
  actuators?: Partial<Record<ActuatorKey, TelemetryActuatorState>>
}

export interface TelemetryListResponse {
  telemetry: Telemetry[]
  total_count: number
  page: number
  page_size: number
}

export interface SetActuatorCommand {
  action: 'set_actuator'
  actuator: ActuatorKey
  state: boolean
  duty?: number
  mode: ActuatorMode
}

export type CommandRequest = SetActuatorCommand

export interface DeviceCommand {
  id: string
  action: string
  status: string
  payload: Record<string, unknown>
  triggered_by: string
  triggered_by_name?: string
  created_at: string
  acked_at?: string
  ack_result?: Record<string, unknown>
}

export interface DeviceCommandSummary {
  id: string
  action: string
  status: string
  triggered_by: string
  triggered_by_name?: string
  created_at: string
}

export interface CommandListResponse {
  commands: DeviceCommandSummary[]
  total_count: number
  page: number
  page_size: number
}
