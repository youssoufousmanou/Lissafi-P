export function formatCurrency(amount?: number | null) {
  const safeAmount = Number.isFinite(amount) ? Number(amount) : 0;

  return new Intl.NumberFormat('fr-CM', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: 'currency',
    currency: 'XAF',
    currencyDisplay: 'code',
  })
    .format(safeAmount)
    .replace('XAF', 'FCFA')
    .trim();
}
