import type {
  ActuatorStateResponse,
  CommandListResponse,
  CommandRequest,
  DeviceCommand,
} from "../types/api";
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

export async function listCommands(
  deviceId: string,
  { page = 1, limit = 20 }: { page?: number; limit?: number } = {},
): Promise<CommandListResponse> {
  const { data } = await http.get<CommandListResponse>(`/devices/${deviceId}/command`, {
    params: { page, limit },
  });
  return data;
}

export async function getCommand(
  deviceId: string,
  commandId: string,
): Promise<DeviceCommand> {
  const { data } = await http.get<DeviceCommand>(
    `/devices/${deviceId}/command/${commandId}`,
  );
  return data;
}
