// file định nghĩa và kiểm tra dữ liệu đầu vào cho chức năng create-order.
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { PaymentMethod } from '../../database/entities/enums';

export class CreateOrderDto {
  @IsOptional() @IsUUID() quoteId?: string;
  @IsOptional() @Matches(/^[a-f0-9]{64}$/) quoteHash?: string;
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;
}
