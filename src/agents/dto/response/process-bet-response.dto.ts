import { IsNumber, IsString, IsNotEmpty } from 'class-validator';

export class ProcessBetResponseDto {
  @IsString()
  @IsNotEmpty()
  agentName: string;

  @IsNumber()
  @IsNotEmpty()
  remainingBalance: number;

  @IsNumber()
  @IsNotEmpty()
  betAmount: number;

  @IsNumber()
  @IsNotEmpty()
  betOdd: number;

  @IsString()
  @IsNotEmpty()
  predictionType: string;

  @IsNumber()
  @IsNotEmpty()
  matchId: number;

  @IsNumber()
  @IsNotEmpty()
  predictionId: number;
}
