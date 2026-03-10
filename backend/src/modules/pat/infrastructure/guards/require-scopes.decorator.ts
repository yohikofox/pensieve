import { SetMetadata } from '@nestjs/common';
import type { PATScope } from './pat-scopes';

export const SCOPES_KEY = 'pat_required_scopes';

export const RequireScopes = (...scopes: PATScope[]) =>
  SetMetadata(SCOPES_KEY, scopes);
