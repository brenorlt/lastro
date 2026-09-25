import { randomBytes } from 'node:crypto';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { type Algorithm, hash, verify } from '@node-rs/argon2';
import { AppConfigService } from '../../config/app-config.service.js';

// `Algorithm` é um const enum ambiente (inacessível com isolatedModules); 2 = Argon2id.
const ARGON2ID = 2 as Algorithm;

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash = '';

  constructor(private readonly config: AppConfigService) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hash(randomBytes(32).toString('base64url'));
  }

  private get options() {
    return {
      algorithm: ARGON2ID,
      memoryCost: this.config.get('ARGON2_MEMORY_COST'),
      timeCost: this.config.get('ARGON2_TIME_COST'),
      parallelism: this.config.get('ARGON2_PARALLELISM'),
    };
  }

  hash(password: string): Promise<string> {
    return hash(password, this.options);
  }

  async verify(passwordHash: string, password: string): Promise<boolean> {
    try {
      return await verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  /** Verificação descartável para igualar o tempo de resposta quando o e-mail não existe. */
  async verifyDummy(password: string): Promise<void> {
    if (!this.dummyHash) this.dummyHash = await this.hash('lastro-dummy-password-1');
    await this.verify(this.dummyHash, password);
  }

  /** True se o hash foi gerado com parâmetros diferentes dos atuais (rehash no próximo login). */
  needsRehash(passwordHash: string): boolean {
    const match = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(passwordHash);
    if (!match) return true;
    const [, m, t, p] = match.map(Number);
    const o = this.options;
    return m !== o.memoryCost || t !== o.timeCost || p !== o.parallelism;
  }
}
