import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { BudgetsModule } from '../budgets/budgets.module.js';
import { CardsModule } from '../cards/cards.module.js';
import { CategoriesModule } from '../categories/categories.module.js';
import { DashboardModule } from '../dashboard/dashboard.module.js';
import { EmergencyFundModule } from '../emergency-fund/emergency-fund.module.js';
import { GoalsModule } from '../goals/goals.module.js';
import { NetWorthModule } from '../net-worth/net-worth.module.js';
import { TransactionsModule } from '../transactions/transactions.module.js';
import { AppOAuthController } from './app-oauth.controller.js';
import { AppOAuthService } from './app-oauth.service.js';
import { McpController } from './mcp.controller.js';
import { McpToolsFactory } from './mcp-tools.js';

/** Apps conectados: OAuth 2.1 (Lastro como servidor de autorização) + servidor MCP em /api/mcp. */
@Module({
  imports: [
    AuthModule,
    AccountsModule,
    BudgetsModule,
    CardsModule,
    CategoriesModule,
    DashboardModule,
    EmergencyFundModule,
    GoalsModule,
    NetWorthModule,
    TransactionsModule,
  ],
  controllers: [AppOAuthController, McpController],
  providers: [AppOAuthService, McpToolsFactory],
  exports: [AppOAuthService],
})
export class ConnectModule {}
