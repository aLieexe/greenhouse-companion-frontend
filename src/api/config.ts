import type {
  ConfigResponse,
  ConfigVersionListResponse,
  ConfigVersionResponse,
  UpdateConfigRequest,
} from "../types/api";
import http from "./http";

export interface UpdateConfigResult {
  status: number;
  data: ConfigResponse;
}

export async function getConfig(deviceId: string): Promise<ConfigResponse> {
  const { data } = await http.get<ConfigResponse>(`/devices/${deviceId}/config`);
  return data;
}

export async function updateConfig(
  deviceId: string,
  payload: UpdateConfigRequest,
): Promise<UpdateConfigResult> {
  const { status, data } = await http.put<ConfigResponse>(
    `/devices/${deviceId}/config`,
    payload,
  );
  return { status, data };
}

export async function listConfigVersions(
  deviceId: string,
  { page = 1, limit = 50 }: { page?: number; limit?: number } = {},
): Promise<ConfigVersionListResponse> {
  const { data } = await http.get<ConfigVersionListResponse>(
    `/devices/${deviceId}/config/versions`,
    { params: { page, limit } },
  );
  return data;
}

export async function getConfigVersion(
  deviceId: string,
  version: number,
): Promise<ConfigVersionResponse> {
  const { data } = await http.get<ConfigVersionResponse>(
    `/devices/${deviceId}/config/versions/${version}`,
  );
  return data;
}
