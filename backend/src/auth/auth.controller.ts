import { All, Controller, Req, Res } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import type { Request, Response } from 'express';
import { auth } from './auth.config';

/**
 * AuthController — ADR-029: Better Auth HTTP Handler
 *
 * Delegates all /api/auth/* routes to Better Auth via toNodeHandler.
 * Handles: sign-in, sign-up, sign-out, password reset, session management.
 *
 * Note: Better Auth handles its own request/response cycle.
 * NestJS body parser is disabled for this controller (see main.ts).
 */
@Controller('api/auth')
export class AuthController {
  private readonly handler = toNodeHandler(auth);

  @All('*')
  handleAuth(@Req() req: Request, @Res() res: Response): void {
    void this.handler(req, res);
  }
}
