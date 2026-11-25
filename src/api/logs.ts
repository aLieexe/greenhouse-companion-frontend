import type { LogListResponse } from "../types/api";
import http from "./http";

interface LogQuery {
  page?: number;
  limit?: number;
  boot_id?: string;
  severity?: string;
  uptime_s?: number;
  code?: string;
}

export async function listLogs(
  deviceId: string,
  {
    page = 1,
    limit = 20,
    boot_id,
    severity,
    uptime_s,
    code,
  }: LogQuery = {},
): Promise<LogListResponse> {
  const { data } = await http.get<LogListResponse>(`/devices/${deviceId}/logs`, {
    params: {
      page,
      limit,
      boot_id,
      severity,
      uptime_s,
      code,
    },
  });
  return data;
}
