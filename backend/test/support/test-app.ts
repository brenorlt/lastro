import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { ModuleMetadata } from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import type { Response } from 'supertest';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { PasswordService } from '../../src/auth/password/password.service.js';
import { SessionService } from '../../src/auth/sessions/session.service.js';
import { AccessTokenService } from '../../src/auth/tokens/access-token.service.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import type { User } from '../../src/generated/prisma/client.js';
import {
  MAIL_TRANSPORT,
  type MailKind,
  type MailMessage,
  type MailTransport,
} from '../../src/modules/mail/mail.types.js';

export const TRUSTED_ORIGIN = 'http://localhost:3100';

/** Captura os e-mails em memória para os testes lerem os links. */
export class CapturingMailTransport implements MailTransport {
  readonly messages: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.messages.push(message);
    return Promise.resolve();
  }

  find(to: string, kind: MailKind): MailMessage[] {
    return this.messages.filter((m) => m.to === to && m.kind === kind);
  }

  lastToken(to: string, kind: MailKind): string {
    const message = this.find(to, kind).at(-1);
    if (!message?.link) throw new Error(`nenhum e-mail ${kind} para ${to}`);
    const token = new URL(message.link).searchParams.get('token');
    if (!token) throw new Error('link sem token');
    return token;
  }
}

export interface TestContext {
  app: NestExpressApplication;
  http: Server;
  mail: CapturingMailTransport;
  prisma: PrismaService;
  /** Prefixo único da execução: todos os e-mails de teste começam com ele. */
  emailPrefix: string;
  email(label: string): string;
  /** IP fictício único por chamada (rate limit é por IP). */
  ip(): string;
  createVerifiedUser(label: string, password?: string): Promise<User>;
  issueAccessToken(userId: string): Promise<{ accessToken: string; sessionId: string }>;
  cleanup(): Promise<void>;
}

export const DEFAULT_PASSWORD = 'senhaForte2026';

let ipCounter = 0;

export async function createTestApp(extra: ModuleMetadata = {}): Promise<TestContext> {
  const mail = new CapturingMailTransport();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, ...(extra.imports ?? [])],
    controllers: extra.controllers ?? [],
  })
    .overrideProvider(MAIL_TRANSPORT)
    .useValue(mail)
    .compile();

  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  const emailPrefix = `e2e-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}-`;
  const runOctet = randomBytes(1)[0];

  return {
    app,
    http: app.getHttpServer(),
    mail,
    prisma,
    emailPrefix,
    email: (label) => `${emailPrefix}${label}@lastro.test`,
    ip: () => {
      ipCounter += 1;
      return `10.${runOctet}.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`;
    },
    async createVerifiedUser(label, password = DEFAULT_PASSWORD) {
      const passwordHash = await app.get(PasswordService).hash(password);
      return prisma.user.create({
        data: {
          email: `${emailPrefix}${label}@lastro.test`,
          name: `Teste ${label}`,
          passwordHash,
          emailVerifiedAt: new Date(),
        },
      });
    },
    async issueAccessToken(userId) {
      const { session } = await app
        .get(SessionService)
        .create(userId, { ip: '127.0.0.1', userAgent: 'e2e' });
      const { accessToken } = await app.get(AccessTokenService).sign(userId, session.id);
      return { accessToken, sessionId: session.id };
    },
    async cleanup() {
      await prisma.securityEvent.deleteMany({ where: { email: { startsWith: emailPrefix } } });
      await prisma.user.deleteMany({ where: { email: { startsWith: emailPrefix } } });
      await app.close();
    },
  };
}

export interface ParsedCookie {
  name: string;
  value: string;
  attributes: Record<string, string | true>;
}

export function getCookie(res: Response, name: string): ParsedCookie | undefined {
  const header = res.headers['set-cookie'] as unknown;
  const list = Array.isArray(header)
    ? (header as string[])
    : typeof header === 'string'
      ? [header]
      : [];
  const raw = list.find((c) => c.startsWith(`${name}=`));
  if (!raw) return undefined;
  const [pair, ...attrs] = raw.split(';').map((p) => p.trim());
  const attributes: Record<string, string | true> = {};
  for (const attr of attrs) {
    const [key, ...rest] = attr.split('=');
    attributes[key.toLowerCase()] = rest.length ? rest.join('=') : true;
  }
  return { name, value: decodeURIComponent(pair.slice(name.length + 1)), attributes };
}

/** Cabeçalho Cookie com o refresh token. */
export const refreshCookie = (token: string) => `lastro_rt=${encodeURIComponent(token)}`;
