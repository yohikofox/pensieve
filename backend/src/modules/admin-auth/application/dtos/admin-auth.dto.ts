import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}

export class ChangePasswordDto {
  @IsString()
  oldPassword!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

export class CreateAdminDto {
  @IsEmail()
  email!: string;

  @IsString()
  name!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
