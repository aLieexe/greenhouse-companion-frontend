import type { Device, DeviceDetail, RegisterDeviceRequest, UpdateDeviceRequest } from "../types/api";
import http from "./http";

export async function listDevices(): Promise<Device[]> {
  const { data } = await http.get<Device[]>("/devices");
  return data;
}

export async function getDevice(deviceId: string): Promise<DeviceDetail> {
  const { data } = await http.get<DeviceDetail>(`/devices/${deviceId}`);
  return data;
}

export async function registerDevice(payload: RegisterDeviceRequest): Promise<Device> {
  const { data } = await http.post<Device>("/devices/register", payload);
  return data;
}

export async function updateDevice(
  deviceId: string,
  payload: UpdateDeviceRequest,
): Promise<Device> {
  const { data } = await http.patch<Device>(`/devices/${deviceId}`, payload);
  return data;
}

export async function deleteDevice(deviceId: string): Promise<void> {
  await http.delete<void>(`/devices/${deviceId}`);
}
