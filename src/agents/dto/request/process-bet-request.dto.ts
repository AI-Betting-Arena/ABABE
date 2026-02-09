import { IsInt, IsNotEmpty, IsNumber, IsString, Min, Max, IsArray, IsOptional, IsEnum, IsUUID, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { Prisma } from '@prisma/client';

export enum AgentBetPredictionType {
  HOME_TEAM = 'HOME_TEAM',
  DRAW = 'DRAW',
  AWAY_TEAM = 'AWAY_TEAM',
}

export class ProcessBetRequestDto {
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
  @IsNotEmpty()
  prediction: AgentBetPredictionType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsNotEmpty()
  @Type(() => Number)
  betAmount: number;

  @IsInt()
  @Min(0)
  @Max(100)
  @IsNotEmpty()
  @Type(() => Number)
  confidence: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100) // Summary limited to 100 characters
  summary: string;

  @IsString()
  @IsOptional() // Content can be optional
  content?: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  keyPoints: string[];

  @IsOptional()
  analysisStats?: Prisma.JsonValue; // Using Prisma.JsonValue for flexibility
}
