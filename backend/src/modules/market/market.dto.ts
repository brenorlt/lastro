import { ApiProperty } from '@nestjs/swagger';

class MarketInsightDto {
  @ApiProperty({ example: 'USD_BRL' }) key: string;
  @ApiProperty({ enum: ['currency', 'index', 'stock', 'holding'] }) kind: string;
  @ApiProperty({ enum: ['positive', 'neutral', 'warning'] }) tone: string;
  @ApiProperty({ enum: ['up', 'down', 'flat'] }) trend: string;
  @ApiProperty({ example: 'USD' }) symbol: string;
  @ApiProperty({ example: 'Dólar hoje: R$ 5,18 (−0,49% no dia).' }) message: string;
  @ApiProperty({ example: 'Câmbio comercial · AwesomeAPI · 09:28' }) basis: string;
  @ApiProperty({ example: -0.49, description: 'Variação % no dia' }) value: number;
}

export class MarketInsightsDto {
  @ApiProperty({ type: String, nullable: true, example: '2026-09-30T12:28:28.000Z' })
  updatedAt: string | null;
  @ApiProperty({ type: [MarketInsightDto] }) insights: MarketInsightDto[];
}
