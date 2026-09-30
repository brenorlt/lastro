import { normalizeSearch } from '../../common/utils/search-text.js';

/**
 * Chave de "mesmo estabelecimento": sem acentos, dígitos e pontuação, para que
 * "UBER *TRIP 12/09" e "UBER *TRIP 03/10" caiam na mesma chave.
 */
export function merchantKey(description: string): string {
  return normalizeSearch(description)
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type Rule = { type: 'INCOME' | 'EXPENSE'; category: string; terms: string[] };

/**
 * Palavras-chave comuns em extratos brasileiros → nome da categoria padrão. Só é usada quando o
 * histórico do usuário não sugere nada; a ordem importa ("amazon prime" antes de "amazon").
 */
const RULES: Rule[] = [
  {
    type: 'INCOME',
    category: 'Salário',
    terms: ['salario', 'folha de pagamento', 'pagto salario', 'credito salario'],
  },
  {
    type: 'INCOME',
    category: 'Rendimentos',
    terms: ['rendimento', 'rendimentos', 'rend pago', 'juros', 'remuneracao'],
  },
  {
    type: 'EXPENSE',
    category: 'Assinaturas',
    terms: [
      'netflix',
      'spotify',
      'amazon prime',
      'prime video',
      'disney',
      'hbo',
      'youtube premium',
      'apple com',
      'icloud',
      'google one',
      'deezer',
      'globoplay',
      'openai',
      'chatgpt',
      'paramount',
    ],
  },
  {
    type: 'EXPENSE',
    category: 'Alimentação',
    terms: [
      'ifood',
      'rappi',
      'restaurante',
      'lanchonete',
      'padaria',
      'supermercado',
      'mercado(?! livre| pago)',
      'carrefour',
      'pao de acucar',
      'assai',
      'atacadao',
      'burger',
      'mcdonalds',
      'subway',
      'pizzaria',
      'acougue',
      'hortifruti',
      'zaffari',
    ],
  },
  {
    type: 'EXPENSE',
    category: 'Transporte',
    terms: [
      'uber',
      'cabify',
      'posto',
      'combustivel',
      'ipiranga',
      'petrobras',
      'estacionamento',
      'sem parar',
      'conectcar',
      'veloe',
      'metro',
      'onibus',
      'pedagio',
    ],
  },
  {
    type: 'EXPENSE',
    category: 'Saúde',
    terms: [
      'farmacia',
      'drogaria',
      'droga raia',
      'drogasil',
      'pague menos',
      'hospital',
      'clinica',
      'laboratorio',
      'unimed',
      'amil',
      'odonto',
    ],
  },
  {
    type: 'EXPENSE',
    category: 'Moradia',
    terms: [
      'aluguel',
      'condominio',
      'energia',
      'enel',
      'cemig',
      'copel',
      'sabesp',
      'internet',
      'vivo',
      'claro',
    ],
  },
  {
    type: 'EXPENSE',
    category: 'Educação',
    terms: ['escola', 'faculdade', 'universidade', 'curso', 'udemy', 'alura', 'livraria'],
  },
  {
    type: 'EXPENSE',
    category: 'Lazer',
    terms: ['cinema', 'ingresso', 'sympla', 'steam', 'playstation', 'xbox', 'teatro'],
  },
  {
    type: 'EXPENSE',
    category: 'Compras',
    terms: [
      'amazon',
      'mercado livre',
      'mercadolivre',
      'shopee',
      'magalu',
      'magazine luiza',
      'americanas',
      'shein',
      'aliexpress',
      'renner',
      'riachuelo',
    ],
  },
  { type: 'EXPENSE', category: 'Impostos', terms: ['iof', 'ipva', 'iptu', 'darf', 'imposto'] },
];

const COMPILED = RULES.map((r) => ({
  ...r,
  pattern: new RegExp(`\\b(${r.terms.join('|')})\\b`),
}));

/** Nome da categoria padrão sugerida por palavra-chave, ou null. */
export function keywordCategory(description: string, type: 'INCOME' | 'EXPENSE'): string | null {
  const key = merchantKey(description);
  return COMPILED.find((r) => r.type === type && r.pattern.test(key))?.category ?? null;
}
