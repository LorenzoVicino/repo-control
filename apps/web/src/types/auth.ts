export type AuthSession = {
  // False when the server has no credentials configured, which is the default: the
  // dashboard then opens straight into the workspace and never shows the sign-in screen.
  authRequired: boolean;
  authenticated: boolean;
  username: string | null;
};

export type SignInCredentials = {
  username: string;
  password: string;
  remember: boolean;
};
