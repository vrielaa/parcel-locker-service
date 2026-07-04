export const pageClass = 'grid gap-6';
export const panelClass = 'rounded-2xl border border-line bg-surface p-6 shadow-card';
export const subtlePanelClass = 'rounded-xl border border-line bg-background p-4';
export const buttonClass = 'min-h-10 rounded-lg bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50';
export const ghostButtonClass = 'min-h-10 rounded-lg border border-line bg-surface px-4 text-sm font-bold text-foreground transition hover:border-brand hover:text-brand-strong disabled:cursor-not-allowed disabled:opacity-50';
export const dangerButtonClass = 'min-h-10 rounded-lg border border-danger/50 bg-danger px-4 text-sm font-bold text-ink-text transition hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-50';
export const inputClass = 'min-h-10 rounded-lg border border-line bg-field px-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20';
export const labelClass = 'grid gap-1.5 text-sm font-semibold text-foreground';

export function getValue(event: Event) {
  return (event.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value;
}

export function numberValue(value: string) {
  const parsed = Number(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function statusTone(status: unknown) {
  const value = String(status || '').toUpperCase();
  if (['AKTYWNY', 'WOLNA', 'ODEBRANA'].includes(value)) return 'bg-success/10 text-success';
  if (['NADANA', 'W_DRODZE', 'W_AUTOMACIE'].includes(value)) return 'bg-brand-soft text-brand-strong';
  if (['CZEKA_NA_ZATWIERDZENIE', 'W_SERWISIE'].includes(value)) return 'bg-warning/10 text-warning';
  if (['USZKODZONA', 'NIEAKTYWNY', 'ANULOWANA', 'PRZETERMINOWANA'].includes(value)) return 'bg-danger/10 text-danger';
  return 'bg-background text-muted';
}
