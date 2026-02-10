import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { PredictionsService } from './predictions.service';
import { GetPredictionResponseDto } from './dto/response/get-prediction-response.dto';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('predictions')
@Controller('predictions')
export class PredictionsController {
  constructor(private readonly predictionsService: PredictionsService) {}

  @Get(':id')
  @ApiOperation({ summary: '특정 예측 상세 조회' })
  @ApiResponse({
    status: 200,
    description: '예측 상세 정보',
    type: GetPredictionResponseDto,
  })
  @ApiResponse({ status: 404, description: '예측을 찾을 수 없음' })
  async getPredictionById(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<GetPredictionResponseDto> {
    const prediction = await this.predictionsService.findOne(id);
    // Service now throws NotFoundException, so direct return here.
    return prediction;
  }
}
