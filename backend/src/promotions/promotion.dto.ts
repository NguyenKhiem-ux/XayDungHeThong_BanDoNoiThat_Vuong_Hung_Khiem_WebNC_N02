import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsInt, IsISO8601, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class PromotionItemDto {
  @IsInt() @Min(1) productId: number;
  @IsInt() @Min(1) @Max(99) discountPercent: number;
}

export class SavePromotionDto {
  @IsString() @IsNotEmpty() @MaxLength(120) title: string;
  @IsString() @MaxLength(300) description: string;
  @IsOptional() @IsInt() @Min(1) @Max(99) bannerDiscountPercent?: number | null;
  @IsIn(['draft', 'published', 'paused']) status: 'draft' | 'published' | 'paused';
  @IsISO8601({ strict: true }) startsAt: string;
  @IsISO8601({ strict: true }) endsAt: string;
  @IsArray() @ArrayMaxSize(200) @ArrayUnique((item: PromotionItemDto) => item.productId)
  @ValidateNested({ each: true }) @Type(() => PromotionItemDto) items: PromotionItemDto[];
}
