import type { TelemetryListResponse } from "../types/api";
import http from "./http";

interface TelemetryQuery {
  page?: number;
  limit?: number;
  boot_id?: string;
  seq_from?: number;
  seq_to?: number;
  received_from?: string;
  received_to?: string;
}

export async function listTelemetry(
  deviceId: string,
  {
    page = 1,
    limit = 20,
    boot_id,
    seq_from,
    seq_to,
    received_from,
    received_to,
  }: TelemetryQuery = {},
): Promise<TelemetryListResponse> {
  const { data } = await http.get<TelemetryListResponse>(
    `/devices/${deviceId}/telemetry`,
    {
      params: {
        page,
        limit,
        boot_id,
        seq_from,
        seq_to,
        received_from,
        received_to,
      },
    },
  );
  return data;
}

export function buildTelemetrySocketUrl(deviceId: string): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  const origin = configured
    ? configured.trim().replace(/^http:/, "ws:").replace(/^https:/, "wss:")
    : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;

  return `${origin.replace(/\/$/, "")}/devices/${deviceId}/telemetry/ws`;
}
