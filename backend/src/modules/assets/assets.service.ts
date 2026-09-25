import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app.exception.js';
import { ErrorCode } from '../../common/errors/error-codes.js';
import { fromDbDate, toDbDate } from '../../common/utils/date-only.js';
import { Decimal, toDecimal, toMoneyString } from '../../common/utils/money.js';
import { rejectNulls } from '../../common/validation/reject-nulls.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Asset } from '../../generated/prisma/client.js';
import type { AssetDto, CreateAssetDto, UpdateAssetDto } from './asset.dto.js';

function toDto(a: Asset): AssetDto {
  return {
    id: a.id,
    name: a.name,
    type: a.type,
    value: toMoneyString(a.value),
    acquiredAt: a.acquiredAt ? fromDbDate(a.acquiredAt) : null,
    notes: a.notes,
    updatedAt: a.updatedAt.toISOString(),
  };
}

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const rows = await this.prisma.asset.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ value: 'desc' }, { createdAt: 'asc' }],
    });
    const byType = new Map<string, Decimal>();
    for (const r of rows) byType.set(r.type, (byType.get(r.type) ?? new Decimal(0)).plus(r.value));
    return {
      data: rows.map(toDto),
      meta: {
        total: toMoneyString(rows.reduce((a, r) => a.plus(r.value), new Decimal(0))),
        count: rows.length,
        byType: [...byType.entries()].map(([type, total]) => ({
          type,
          total: toMoneyString(total),
        })),
      },
    };
  }

  async get(userId: string, id: string): Promise<AssetDto> {
    return toDto(await this.findOwned(userId, id));
  }

  async create(userId: string, dto: CreateAssetDto): Promise<AssetDto> {
    const row = await this.prisma.asset.create({
      data: {
        userId,
        name: dto.name,
        type: dto.type,
        value: toDecimal(dto.value),
        acquiredAt: dto.acquiredAt ? toDbDate(dto.acquiredAt) : null,
        notes: dto.notes ?? null,
      },
    });
    return toDto(row);
  }

  async update(userId: string, id: string, dto: UpdateAssetDto): Promise<AssetDto> {
    rejectNulls(dto, ['name', 'type', 'value']);
    await this.findOwned(userId, id);
    const row = await this.prisma.asset.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        value: dto.value ? toDecimal(dto.value) : undefined,
        acquiredAt:
          dto.acquiredAt === undefined
            ? undefined
            : dto.acquiredAt
              ? toDbDate(dto.acquiredAt)
              : null,
        notes: dto.notes === undefined ? undefined : dto.notes,
      },
    });
    return toDto(row);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.findOwned(userId, id);
    await this.prisma.asset.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async findOwned(userId: string, id: string): Promise<Asset> {
    const row = await this.prisma.asset.findFirst({ where: { id, userId, deletedAt: null } });
    if (!row) throw new AppException(ErrorCode.ASSET_NOT_FOUND);
    return row;
  }
}
