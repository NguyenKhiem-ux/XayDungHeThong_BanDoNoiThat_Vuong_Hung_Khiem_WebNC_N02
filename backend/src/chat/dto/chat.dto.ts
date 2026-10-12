import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

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
}
