import { Module } from '@nestjs/common';
import { PredictionsService } from './predictions.service';
import { PredictionsController } from './predictions.controller';
import { PrismaService } from '../prisma.service'; // Assuming PrismaService is at the root of src

@Module({
  controllers: [PredictionsController],
  providers: [PredictionsService, PrismaService],
  exports: [PredictionsService], // If other modules need to use PredictionsService
})
export class PredictionsModule {}
