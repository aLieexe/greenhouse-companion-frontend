import type { ActuatorStateResponse, CommandRequest, DeviceCommand } from "../types/api";
import http from "./http";

export async function getActuatorState(deviceId: string): Promise<ActuatorStateResponse> {
  const { data } = await http.get<ActuatorStateResponse>(`/devices/${deviceId}/actuator`);
  return data;
}

export async function sendCommand(
  deviceId: string,
  payload: CommandRequest,
): Promise<DeviceCommand> {
  const { data } = await http.post<DeviceCommand>(`/devices/${deviceId}/command`, payload);
  return data;
}
