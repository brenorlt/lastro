const UNIT_SECONDS: Record<string, number> = {
  ms: 0.001,
  s: 1,
  m: 60,
  h: 3600,
  d: 86_400,
  w: 604_800,
  y: 31_557_600,
};

/** Converte "15m", "30d", "900" (segundos) em segundos inteiros. */
export function durationToSeconds(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d|w|y)?$/.exec(value.trim());
  if (!match) throw new Error(`Duração inválida: ${value}`);
  const amount = Number(match[1]);
  const unit = match[2] ?? 's';
  return Math.floor(amount * UNIT_SECONDS[unit]);
}
