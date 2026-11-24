import type {
  LoginRequest,
  MessageResponse,
  RegisterRequest,
  RegisterResponse,
  User,
  UserContext,
} from "../types/api";
import http from "./http";

export async function login(credentials: LoginRequest): Promise<MessageResponse> {
  const { data } = await http.post<MessageResponse>("/auth/login", credentials);
  return data;
}

export async function register(credentials: RegisterRequest): Promise<RegisterResponse> {
  const { data } = await http.post<RegisterResponse>("/auth/register", credentials);
  return data;
}

export async function refresh(): Promise<MessageResponse> {
  const { data } = await http.post<MessageResponse>("/auth/refresh");
  return data;
}

export async function logout(): Promise<MessageResponse> {
  const { data } = await http.post<MessageResponse>("/auth/logout");
  return data;
}

export async function me(): Promise<User> {
  const { data } = await http.get<User>("/me");
  return data;
}

export async function check(): Promise<UserContext> {
  const { data } = await http.get<UserContext>("/auth/check");
  return data;
}
