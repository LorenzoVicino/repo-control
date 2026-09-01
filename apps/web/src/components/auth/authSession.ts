import { useQuery } from "@tanstack/react-query";
import { fetchAuthSession } from "../../api/auth";
import type { AuthSession } from "../../types/auth";

export const AUTH_SESSION_QUERY_KEY = ["auth-session"] as const;

export const SIGNED_OUT_SESSION: AuthSession = {
  authRequired: true,
  authenticated: false,
  username: null
};

// One shared read of the sign-in state: the application shell chooses between the sign-in
// screen and the dashboard from it, and the session menu names the signed-in user from the
// same cached answer. It only changes when the user signs in or out, or when the API
// reports a lapsed session, so it is never refetched on its own.
export function useAuthSession() {
  return useQuery<AuthSession>({
    queryKey: AUTH_SESSION_QUERY_KEY,
    queryFn: fetchAuthSession,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY
  });
}
