export function fmtEur(amount: number): string {
  return amount.toFixed(2).replace('.', ',') + ' €'
}

export function fmtDate(ts: string): string {
  try {
    return new Date(ts).toLocaleDateString('fi-FI')
  } catch {
    return ts
  }
}
