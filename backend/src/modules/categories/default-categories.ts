import type { CategoryType } from '../../generated/prisma/enums.js';

export interface DefaultCategory {
  name: string;
  type: CategoryType;
  /** Nome do ícone lucide (https://lucide.dev). */
  icon: string;
  color: string;
}

/** Categorias criadas para todo novo usuário. */
export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { type: 'INCOME', name: 'Salário', icon: 'briefcase', color: '#16A34A' },
  { type: 'INCOME', name: 'Freelance', icon: 'laptop', color: '#0EA5E9' },
  { type: 'INCOME', name: 'Investimentos', icon: 'trending-up', color: '#8B5CF6' },
  { type: 'INCOME', name: 'Rendimentos', icon: 'piggy-bank', color: '#14B8A6' },
  { type: 'INCOME', name: 'Outros', icon: 'circle-plus', color: '#64748B' },

  { type: 'EXPENSE', name: 'Moradia', icon: 'house', color: '#F97316' },
  { type: 'EXPENSE', name: 'Alimentação', icon: 'utensils', color: '#EF4444' },
  { type: 'EXPENSE', name: 'Transporte', icon: 'car', color: '#3B82F6' },
  { type: 'EXPENSE', name: 'Saúde', icon: 'heart-pulse', color: '#EC4899' },
  { type: 'EXPENSE', name: 'Educação', icon: 'graduation-cap', color: '#6366F1' },
  { type: 'EXPENSE', name: 'Lazer', icon: 'party-popper', color: '#EAB308' },
  { type: 'EXPENSE', name: 'Assinaturas', icon: 'repeat', color: '#A855F7' },
  { type: 'EXPENSE', name: 'Compras', icon: 'shopping-bag', color: '#F43F5E' },
  { type: 'EXPENSE', name: 'Impostos', icon: 'landmark', color: '#78716C' },
  { type: 'EXPENSE', name: 'Outros', icon: 'ellipsis', color: '#94A3B8' },
] as const;
