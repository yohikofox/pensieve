import { IsString, MinLength, Matches } from 'class-validator';

/**
 * DTO for admin force-reset of a user's password via Better Auth admin API
 * Story 8.18: Admin Reset Password
 */
export class ResetUserPasswordDto {
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(/[A-Z]/, {
    message: 'Password must contain at least one uppercase letter',
  })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  newPassword!: string;
}
