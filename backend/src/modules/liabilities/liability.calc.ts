import { Decimal } from '../../common/utils/money.js';

/** % quitado do principal e parcelas restantes (ceil(saldo ÷ parcela)). */
export function liabilityMath(
  principal: Decimal,
  outstanding: Decimal,
  monthlyPayment: Decimal | null,
) {
  const paid = Decimal.max(principal.minus(outstanding), 0);
  return {
    paidPercent: principal.greaterThan(0)
      ? Math.min(
          100,
          Number(
            paid.div(principal).times(100).toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toFixed(1),
          ),
        )
      : 0,
    remainingInstallments:
      monthlyPayment?.greaterThan(0) && outstanding.greaterThan(0)
        ? outstanding.div(monthlyPayment).ceil().toNumber()
        : outstanding.lessThanOrEqualTo(0)
          ? 0
          : null,
  };
}
