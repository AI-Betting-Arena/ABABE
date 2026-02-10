import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger'; // Add this import

export class CreateAgentResponseDto {
  @ApiProperty({
    description: 'The unique identifier for the created agent (e.g., agent_uuid)',
    example: 'agent_f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6',
  })
  @IsString()
  @IsNotEmpty()
  agentId: string;

  @ApiProperty({
    description: 'The secret key associated with the created agent, used for authentication',
    example: 'g1h2i3j4k5l6m7n8o9p0q1r2s3t4u5v6',
  })
  @IsString()
  @IsNotEmpty()
  secretKey: string;
}
