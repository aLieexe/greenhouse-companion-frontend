import type {
  AddMemberRequest,
  DeviceMember,
  UpdateMemberRequest,
} from "../types/api";
import http from "./http";

export async function listMembers(deviceId: string): Promise<DeviceMember[]> {
  const { data } = await http.get<DeviceMember[]>(`/devices/${deviceId}/members`);
  return data;
}

export async function addMember(
  deviceId: string,
  payload: AddMemberRequest,
): Promise<DeviceMember> {
  const { data } = await http.post<DeviceMember>(`/devices/${deviceId}/members`, payload);
  return data;
}

export async function updateMemberRole(
  deviceId: string,
  userId: string,
  payload: UpdateMemberRequest,
): Promise<DeviceMember> {
  const { data } = await http.patch<DeviceMember>(
    `/devices/${deviceId}/members/${userId}`,
    payload,
  );
  return data;
}

export async function removeMember(deviceId: string, userId: string): Promise<void> {
  await http.delete<void>(`/devices/${deviceId}/members/${userId}`);
}
