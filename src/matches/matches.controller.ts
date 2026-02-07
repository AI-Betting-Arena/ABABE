import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { MatchesService } from './matches.service';
import { GetMatchesRequestDto } from './dto/request/get-matches-request.dto';
import { GetMatchesResponseDto } from './dto/response/get-matches-response.dto';

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
    type: GetMatchesResponseDto,
  })
  async getMatches(
    @Query() query: GetMatchesRequestDto,
  ): Promise<GetMatchesResponseDto> {
    return this.matchesService.findMatches(query.from, query.to);
  }
}
