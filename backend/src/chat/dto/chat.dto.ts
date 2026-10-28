import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { CHAT_ACTIONS, ChatActionType } from '../chat.types';
import { UpdateAddressDto } from '../../addresses/dto/address.dto';
import { PaymentMethod } from '../../database/entities/enums';

export class ChatCartItemDto {
  @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER)
  productId!: number;
  @IsInt() @Min(1) @Max(9999)
  quantity!: number;
}

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

  @IsOptional() @IsInt() @Min(1) @Max(Number.MAX_SAFE_INTEGER)
  orderId?: number;

  @IsOptional() @IsString() @MaxLength(100)
  code?: string;

  @IsOptional() @IsString() @Matches(/^[a-zA-Z0-9_-]{1,100}$/)
  confirmationId?: string;

  @IsOptional() @ValidateNested() @Type(() => UpdateAddressDto)
  address?: UpdateAddressDto;

  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(20)
  @ValidateNested({ each: true }) @Type(() => ChatCartItemDto)
  items?: ChatCartItemDto[];

  @IsOptional() @IsString() @Matches(/^[a-zA-Z0-9_-]{1,100}$/)
  checkoutId?: string;

  @IsOptional() @IsString() @Matches(/^[a-f0-9]{64}$/)
  quoteHash?: string;

  @IsOptional() @IsIn(Object.values(PaymentMethod))
  paymentMethod?: PaymentMethod;
}
