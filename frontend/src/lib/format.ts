export function fmtEur(amount: number, currencySymbol: string): string {
  return amount.toFixed(2).replace('.', ',') + ' ' + currencySymbol
}

export function fmtDate(ts: string): string {
  try {
    return new Date(ts).toLocaleDateString('fi-FI')
  } catch {
    return ts
  }
}
