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
