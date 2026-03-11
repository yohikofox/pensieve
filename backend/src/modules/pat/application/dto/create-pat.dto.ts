import {
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  VALID_SCOPES,
  type PATScope,
} from '../../infrastructure/guards/pat-scopes';

export class CreatePatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsArray()
  @IsIn(VALID_SCOPES, { each: true })
  scopes!: PATScope[];

  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays!: number;
}
