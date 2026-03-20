/**
 * Calculate business days (Mon-Fri) in a given month/year.
 * Ignores holidays — only skips weekends.
 */
export function getBusinessDaysInMonth(year?: number, month?: number): number {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth(); // 0-indexed
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(y, m, d).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

/**
 * Calculate total monthly cost for a collaborator.
 */
export function calcularCustoMensal(
  salarioBase: number,
  vtDiario: number,
  vrDiario: number,
  diasUteis?: number,
): number {
  const du = diasUteis ?? getBusinessDaysInMonth();
  return salarioBase + (vtDiario + vrDiario) * du;
}
