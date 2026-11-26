import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BillingModule } from '../modules/billing/billing.module.js';
import { AuthCleanupService } from './auth-cleanup.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GoogleAuthController } from './oauth/google-auth.controller.js';
import { GoogleOAuthService } from './oauth/google-oauth.service.js';
import { PasswordService } from './password/password.service.js';
import { SecurityEventsService } from './security/security-events.service.js';
import { TrustedOriginGuard } from './security/trusted-origin.guard.js';
import { SessionService } from './sessions/session.service.js';
import { AccessTokenService } from './tokens/access-token.service.js';

/** Autenticação completa (ver README.md). Global para o JwtAuthGuard (APP_GUARD). */
@Global()
@Module({
  imports: [JwtModule.register({}), BillingModule],
  controllers: [AuthController, GoogleAuthController],
  providers: [
    AuthService,
    AuthCleanupService,
    AccessTokenService,
    GoogleOAuthService,
    PasswordService,
    SecurityEventsService,
    SessionService,
    TrustedOriginGuard,
  ],
  exports: [AccessTokenService, SessionService, SecurityEventsService, PasswordService],
})
export class AuthModule {}
