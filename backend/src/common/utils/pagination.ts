import type { PaginationMeta } from '../types/http.js';

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

/** Converte page/pageSize em skip/take do Prisma. */
export function toPrismaPagination({ page, pageSize }: PaginationParams): {
  skip: number;
  take: number;
} {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

/**
 * Monta o retorno paginado. O ResponseInterceptor reconhece `{ data, meta }`
 * e o transforma em `{ success: true, data, meta }`.
 */
export function paginate<T>(items: T[], total: number, params: PaginationParams): Paginated<T> {
  const totalPages = total === 0 ? 0 : Math.ceil(total / params.pageSize);
  return {
    data: items,
    meta: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPreviousPage: params.page > 1 && totalPages > 0,
    },
  };
}
