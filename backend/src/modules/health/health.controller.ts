import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator.js';
import { AppConfigService } from '../../config/app-config.service.js';
import { PrismaHealthIndicator } from './prisma.health-indicator.js';

@ApiTags('health')
@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly config: AppConfigService,
  ) {}

  @Get()
  @HealthCheck({ swaggerDocumentation: false })
  @ApiOperation({ summary: 'Readiness: verifica dependências (banco de dados)' })
  @ApiOkResponse({ description: 'Serviço saudável' })
  @ApiServiceUnavailableResponse({ description: 'Alguma dependência está indisponível' })
  async check() {
    const result = await this.health.check([() => this.prismaIndicator.pingCheck('database')]);
    return {
      status: result.status,
      uptime: Math.round(process.uptime()),
      version: this.config.version,
      environment: this.config.nodeEnv,
      checks: result.details,
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness: o processo está de pé' })
  @ApiOkResponse({ description: 'Processo ativo' })
  live() {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }
}
