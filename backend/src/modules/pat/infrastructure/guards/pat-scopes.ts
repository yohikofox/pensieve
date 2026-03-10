export const VALID_SCOPES = [
  'captures:read',
  'thoughts:read',
  'ideas:read',
  'todos:read',
  'todos:write',
] as const;

export type PATScope = (typeof VALID_SCOPES)[number];
