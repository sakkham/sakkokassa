export function fmtEur(amount: number): string {
  return amount.toFixed(2).replace('.', ',') + ' €'
}
