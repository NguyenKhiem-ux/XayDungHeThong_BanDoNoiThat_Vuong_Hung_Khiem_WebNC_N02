import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { CHAT_ACTIONS, ChatActionType } from '../chat.types';

export class ChatDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'message phải là chuỗi' })
  @IsNotEmpty({ message: 'message không được để trống' })
  @MaxLength(1000, { message: 'message không được dài quá 1000 ký tự' })
  message!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{1,100}$/)
  sessionId?: string;

  @IsOptional()
  @IsIn(CHAT_ACTIONS)
  action?: ChatActionType;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  productId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999)
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  addressId?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{1,100}$/)
  requestId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_-]{1,100}$/)
  reviewId?: string;
}
