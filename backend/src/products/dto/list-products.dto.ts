// file khai báo dữ liệu query cho danh sách sản phẩm: tìm kiếm, lọc giá, sắp xếp và phân trang.
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const PRODUCT_SORTS = ['newest', 'price-asc', 'price-desc', 'name'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];
export const MAX_PAGE_SIZE = 48;

export class ListProductsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  // Có page thì API trả { items, total, page, limit }; không có thì trả toàn bộ mảng như cũ (trang admin dùng).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;

  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort?: ProductSort;

  // Lọc theo giá đang bán (đã áp khuyến mãi), giống giá hiển thị trên thẻ sản phẩm.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;
}
