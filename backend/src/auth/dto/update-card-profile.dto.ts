import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class UpdateCardProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  holder: string;

  @IsIn(['DOMESTIC', 'INTERNATIONAL'])
  type: 'DOMESTIC' | 'INTERNATIONAL';

  @IsString()
  @MaxLength(40)
  provider: string;

  @Matches(/^\d{4}$/)
  last4: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  expMonth: number;

  @Type(() => Number)
  @IsInt()
  @Min(new Date().getFullYear())
  @Max(2100)
  expYear: number;

  @IsOptional()
  @Matches(/^\d{6}$/)
  pin?: string;
}
