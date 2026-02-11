import { ApiProperty } from '@nestjs/swagger';
import { Match, MatchStatus, Team, League } from 'src/generated/prisma/client';
import { TeamInfoResponseDto } from 'src/common/dto/response/team-info-response.dto';
import { LeagueInfoResponseDto } from 'src/common/dto/response/league-info-response.dto';

export class MatchInfoForPredictionResponseDto {
  @ApiProperty({ description: 'Match unique ID', example: 101 })
  id: number;

  @ApiProperty({ description: 'UTC date and time of the match', example: '2026-02-15T18:30:00.000Z' })
  utcDate: Date;

  @ApiProperty({ description: 'Status of the match', enum: MatchStatus, example: MatchStatus.BETTING_CLOSED })
  status: MatchStatus;

  @ApiProperty({ description: 'Matchday number', example: 25 })
  matchday: number;

  @ApiProperty({ type: TeamInfoResponseDto, description: 'Home team information' })
  homeTeam: TeamInfoResponseDto;

  @ApiProperty({ type: TeamInfoResponseDto, description: 'Away team information' })
  awayTeam: TeamInfoResponseDto;

  @ApiProperty({ description: 'Score of the home team', example: 3, nullable: true })
  homeScore: number | null;

  @ApiProperty({ description: 'Score of the away team', example: 1, nullable: true })
  awayScore: number | null;

  @ApiProperty({ description: 'Winner of the match (HOME_TEAM, AWAY_TEAM, DRAW)', example: 'HOME_TEAM', nullable: true })
  winner: string | null;

  @ApiProperty({ description: 'Odds for home team win', example: 1.55 })
  oddsHome: number;

  @ApiProperty({ description: 'Odds for draw', example: 3.80 })
  oddsDraw: number;

  @ApiProperty({ description: 'Odds for away team win', example: 6.20 })
  oddsAway: number;

  @ApiProperty({ type: LeagueInfoResponseDto, description: 'League information for this match' })
  league: LeagueInfoResponseDto;

  static fromPrisma(match: Match & { homeTeam: Team; awayTeam: Team; season: { league: League } }): MatchInfoForPredictionResponseDto {
    const dto = new MatchInfoForPredictionResponseDto();
    dto.id = match.id;
    dto.utcDate = match.utcDate;
    dto.status = match.status;
    dto.matchday = match.matchday;
    dto.homeTeam = TeamInfoResponseDto.fromPrisma(match.homeTeam);
    dto.awayTeam = TeamInfoResponseDto.fromPrisma(match.awayTeam);
    dto.homeScore = match.homeScore;
    dto.awayScore = match.awayScore;
    dto.winner = match.winner;
    dto.oddsHome = match.oddsHome.toNumber();
    dto.oddsDraw = match.oddsDraw.toNumber();
    dto.oddsAway = match.oddsAway.toNumber();
    dto.league = LeagueInfoResponseDto.fromPrisma(match.season.league);
    return dto;
  }
}
