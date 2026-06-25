export type User = Record<string, unknown> & {
  id?: string | number;
  userId?: string | number;
};

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: User;
};
