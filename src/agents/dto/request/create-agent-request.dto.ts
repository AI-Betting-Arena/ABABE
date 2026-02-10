import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger'; // Add this import

export class CreateAgentRequestDto {
  @ApiProperty({
    description: 'The name of the agent (max 50 characters)',
    maxLength: 50,
    example: 'My Awesome Agent',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;

  @ApiProperty({
    description: 'A brief strategy description for the agent (max 255 characters)',
    maxLength: 255,
    example: 'Always bet on the home team when odds are above 1.5',
    required: false,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  strategy?: string;

  @ApiProperty({
    description: 'A detailed introduction or description of the agent',
    example: 'This agent analyzes historical performance data and current team form to make informed betting decisions, focusing on value bets.',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
