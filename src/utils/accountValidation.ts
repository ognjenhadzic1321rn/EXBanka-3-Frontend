export function validateAccountNumber(broj: string): boolean {
  if (!/^\d{18}$/.test(broj)) return false

  const bankCode = broj.slice(0, 3)
  const validBank = bankCode === '111' || bankCode === '222' || bankCode === '333' || bankCode === '444'
  if (!validBank) return false

  // Checksum: (sum of all digits) % 11 == 0
  const sum = broj.split('').reduce((s, ch) => s + Number(ch), 0)
  return sum % 11 === 0
}
