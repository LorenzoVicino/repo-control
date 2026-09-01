import type { AuthSession, SignInCredentials } from "../types/auth";
import { jsonRequest, requestJson } from "./http";

export function fetchAuthSession(): Promise<AuthSession> {
  return requestJson("/api/auth/session", "Unable to read the sign-in state");
}

export function signIn(credentials: SignInCredentials): Promise<AuthSession> {
  return requestJson("/api/auth/login", "Unable to sign in", jsonRequest("POST", credentials));
}

export function signOut(): Promise<AuthSession> {
  return requestJson("/api/auth/logout", "Unable to sign out", { method: "POST" });
}

export function fetchApiHealth(): Promise<{ ok: boolean }> {
  return requestJson("/api/health", "The local API is not answering");
}
