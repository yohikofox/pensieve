import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * User interface (matches Supabase user structure)
 */
export interface User {
  id: string;
  email: string;
  [key: string]: any;
}

/**
 * Decorator to extract the current authenticated user from the request
 *
 * Requires SupabaseAuthGuard or similar authentication guard
 *
 * @example
 * @Get()
 * @UseGuards(SupabaseAuthGuard)
 * async myEndpoint(@CurrentUser() user: User) {
 *   console.log(user.id, user.email);
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
