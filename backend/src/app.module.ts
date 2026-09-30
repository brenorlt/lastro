import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from './auth/auth.module.js';
import { validationExceptionFactory } from './common/validation/validation-exception.factory.js';
import { AppConfigService } from './config/app-config.service.js';
import { AppConfigModule } from './config/config.module.js';
import { buildLoggerParams } from './config/logger.config.js';
import { PrismaModule } from './database/prisma.module.js';
import { AllExceptionsFilter } from './filters/all-exceptions.filter.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { SubscriptionGuard } from './guards/subscription.guard.js';
import { ResponseInterceptor } from './interceptors/response.interceptor.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { CategoriesModule } from './modules/categories/categories.module.js';
import { AssetsModule } from './modules/assets/assets.module.js';
import { BudgetsModule } from './modules/budgets/budgets.module.js';
import { InvestmentsModule } from './modules/investments/investments.module.js';
import { LiabilitiesModule } from './modules/liabilities/liabilities.module.js';
import { NetWorthModule } from './modules/net-worth/net-worth.module.js';
import { PlanningModule } from './modules/planning/planning.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { CardsModule } from './modules/cards/cards.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { EmergencyFundModule } from './modules/emergency-fund/emergency-fund.module.js';
import { GoalsModule } from './modules/goals/goals.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { ImportsModule } from './modules/imports/imports.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MailModule } from './modules/mail/mail.module.js';
import { MarketModule } from './modules/market/market.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { SearchModule } from './modules/search/search.module.js';
import { TagsModule } from './modules/tags/tags.module.js';
import { TransactionsModule } from './modules/transactions/transactions.module.js';

@Module({
  imports: [
    AppConfigModule,
    LoggerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: buildLoggerParams,
    }),
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [{ ttl: config.get('THROTTLE_TTL'), limit: config.get('THROTTLE_LIMIT') }],
      }),
    }),
    PrismaModule,
    MailModule,
    AuthModule,
    HealthModule,
    BillingModule,
    UsersModule,
    AdminModule,
    AccountsModule,
    CategoriesModule,
    TagsModule,
    TransactionsModule,
    ImportsModule,
    CardsModule,
    SearchModule,
    NotificationsModule,
    BudgetsModule,
    GoalsModule,
    EmergencyFundModule,
    InvestmentsModule,
    AssetsModule,
    LiabilitiesModule,
    NetWorthModule,
    PlanningModule,
    ReportsModule,
    DashboardModule,
    MarketModule,
  ],
  providers: [
    // Ordem importa: rate limit antes da autenticação, cobrança depois (precisa de request.user).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: SubscriptionGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
        exceptionFactory: validationExceptionFactory,
      }),
    },
  ],
})
export class AppModule {}
