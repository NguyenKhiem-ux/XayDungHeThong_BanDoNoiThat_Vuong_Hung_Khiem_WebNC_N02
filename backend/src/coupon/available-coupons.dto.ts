import { IsInt, IsOptional, Min } from 'class-validator';

export class AvailableCouponsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  productId?: number;
}
