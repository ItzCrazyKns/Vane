import { UserSettings } from '../db/schema';

export type { UserSettings };

export interface AuthUser {
  userId: string;
  email: string;
  role: 'user' | 'admin';
}

export interface SessionUser extends AuthUser {
  name: string | null;
  settings: UserSettings;
}

export interface JWTPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin';
  iat?: number;
  exp?: number;
}
