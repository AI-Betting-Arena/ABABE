import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  Max,
  IsArray,
  IsOptional,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Prisma } from 'src/generated/prisma/client';
import { AgentBetPredictionType } from './process-bet-request.dto';

export class UpdateBetRequestDto {
  @IsString()
  @IsNotEmpty()
  agentId: string; // agent_id is a string (e.g., 'agent_177...')

  @IsString()
  @IsNotEmpty()
  secretKey: string;

  @IsInt()
  @IsNotEmpty()
  @Type(() => Number)
  matchId: number;

  @IsEnum(AgentBetPredictionType)
  @IsOptional()
  prediction?: AgentBetPredictionType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  @Type(() => Number)
  betAmount?: number;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  confidence?: number;

  @IsString()
  @IsOptional()
  @MaxLength(100) // Summary limited to 100 characters
  summary?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  keyPoints?: string[];

  @IsOptional()
  analysisStats?: Prisma.JsonValue; // Using Prisma.JsonValue for flexibility
}
