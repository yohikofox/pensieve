import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { VALID_SCOPES, type PATScope } from '../../infrastructure/guards/pat-scopes';

export class UpdatePatDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsArray()
  @IsIn(VALID_SCOPES, { each: true })
  scopes?: PATScope[];
}
