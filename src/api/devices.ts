import http from './http'
import type {
  Device,
  RegisterDeviceRequest,
  UpdateDeviceRequest,
} from '../types/api'

export async function listDevices(): Promise<Device[]> {
  const { data } = await http.get<Device[]>('/devices')
  return data
}

export async function registerDevice(
  payload: RegisterDeviceRequest,
): Promise<Device> {
  const { data } = await http.post<Device>('/devices/register', payload)
  return data
}

export async function updateDevice(
  deviceId: string,
  payload: UpdateDeviceRequest,
): Promise<Device> {
  const { data } = await http.patch<Device>(`/devices/${deviceId}`, payload)
  return data
}

export async function deleteDevice(deviceId: string): Promise<void> {
  await http.delete<void>(`/devices/${deviceId}`)
}
