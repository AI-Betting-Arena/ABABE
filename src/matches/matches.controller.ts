import { Controller, Get, Query, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiParam, ApiOkResponse } from '@nestjs/swagger';
import { MatchesService } from './matches.service';
import { GetMatchesRequestDto } from './dto/request/get-matches-request.dto';
import { MatchDetailResponseDto } from './dto/response/match-detail-response.dto';
import { GetMatchPredictionResponseDto } from './dto/response/get-match-predictions-response.dto';
import { LeagueMatchesDto } from './dto/response/league-matches.dto'; // New import

@ApiTags('matches')
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get()
  @ApiOperation({
    summary: '경기 목록 조회',
    description: '지정한 날짜 범위 내의 경기 목록을 조회합니다.',
  })
  @ApiQuery({
    name: 'from',
    required: true,
    type: String,
    example: '2026-02-09',
    description: '조회 시작 날짜 (YYYY-MM-DD)',
    schema: { default: '2026-02-09' },
  })
  @ApiQuery({
    name: 'to',
    required: true,
    type: String,
    example: '2026-02-15',
    description: '조회 종료 날짜 (YYYY-MM-DD)',
    schema: { default: '2026-02-15' },
  })
  @ApiResponse({
    status: 200,
    description: '경기 목록',
    type: [LeagueMatchesDto], // Updated type to array of LeagueMatchesDto
  })
  async getMatches(
    @Query() query: GetMatchesRequestDto,
  ): Promise<LeagueMatchesDto[]> { // Updated return type
    return this.matchesService.findMatches(query.from, query.to);
  }

  @Get(':id')
  @ApiOperation({
    summary: '단일 경기 상세 조회',
    description: 'ID를 통해 단일 경기 상세 정보를 조회합니다.',
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: Number,
    description: '경기의 고유 ID',
  })
  @ApiResponse({
    status: 200,
    description: '경기 상세 정보',
    type: MatchDetailResponseDto,
  })
  @ApiResponse({ status: 404, description: '경기를 찾을 수 없습니다.' })
  async getMatchById(
    @Param('id') id: number,
  ): Promise<MatchDetailResponseDto> {
    return this.matchesService.getMatchById(id);
  }

  @Get(':id/predictions')
  @ApiOperation({
    summary: '특정 경기의 AI 예측 목록 조회',
    description: '주어진 경기 ID에 대한 모든 AI 에이전트의 예측 및 분석 결과를 조회합니다.',
  })
  @ApiParam({
    name: 'id',
    required: true,
    type: Number,
    description: '경기의 고유 ID',
  })
  @ApiOkResponse({
    description: 'AI 예측 목록 반환',
    type: [GetMatchPredictionResponseDto], // Array of predictions
  })
  async getMatchPredictions(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<GetMatchPredictionResponseDto[]> {
    return this.matchesService.getMatchPredictions(id);
  }
}
