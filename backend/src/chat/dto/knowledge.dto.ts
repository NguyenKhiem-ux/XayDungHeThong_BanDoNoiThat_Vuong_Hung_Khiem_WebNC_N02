import { PartialType } from '@nestjs/mapped-types';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { KnowledgeStatus } from '../../database/entities/chatbot-knowledge.entity';
import { CHAT_INTENTS, ChatIntent, RiskLevel } from '../chat.types';

export class CreateKnowledgeDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  question: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(8000)
  answer: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @MaxLength(1000)
  keywords?: string;
}

export class UpdateKnowledgeDto extends PartialType(CreateKnowledgeDto, { skipNullProperties: false }) {}

export class ListKnowledgeDto {
  @Transform(({ value }) => value === 'pending' ? KnowledgeStatus.PENDING : value)
  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(KnowledgeStatus)
  status?: KnowledgeStatus;

  @ValidateIf((_object, value) => value !== undefined)
  @IsEnum(RiskLevel)
  risk?: RiskLevel;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(CHAT_INTENTS)
  intent?: ChatIntent;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100000)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
