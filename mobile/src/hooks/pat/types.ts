/**
 * Types PAT (Personal Access Token) — Mobile
 * Story 27.2
 */

export type PatStatus = 'active' | 'expired' | 'revoked';

export interface Pat {
  id: string;
  name: string;
  prefix: string;       // ex: "pns_aBcDeFgH" — 12 chars
  scopes: string[];
  expiresAt: string;    // ISO date
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface PatWithToken {
  token: string;        // affiché UNE seule fois — jamais stocké
  pat: Pat;
}

export interface CreatePatDto {
  name: string;
  scopes: string[];
  expiresInDays: number;
}

export interface UpdatePatDto {
  name: string;
  scopes: string[];
}

export interface RenewPatDto {
  expiresInDays: number;
}

export const PAT_SCOPES = [
  'captures:read',
  'thoughts:read',
  'ideas:read',
  'todos:read',
  'todos:write',
] as const;

export type PatScope = (typeof PAT_SCOPES)[number];
