import { LockerCell, PackageRow, ParcelLocker, Role } from '../models/app.models';

export const roles: Role[] = ['ADMIN', 'OPERATOR', 'KURIER', 'KLIENT'];

export function normalizeRole(value: unknown): Role | null {
  const role = String(value || '').trim().toUpperCase();
  return roles.includes(role as Role) ? (role as Role) : null;
}

export function asArray<T>(value: unknown, key?: string): T[] {
  const maybe = key && value && typeof value === 'object'
    ? (value as Record<string, unknown>)[key]
    : value;

  return Array.isArray(maybe) ? maybe as T[] : [];
}

export function formatStatus(status: unknown) {
  const value = String(status || '').trim().toUpperCase();
  const map: Record<string, string> = {
    CZEKA_NA_ZATWIERDZENIE: 'Czeka na zatwierdzenie',
    NADANA: 'Nadana',
    W_DRODZE: 'W drodze',
    W_AUTOMACIE: 'W automacie',
    ODEBRANA: 'Odebrana',
    PRZETERMINOWANA: 'Przeterminowana',
    ANULOWANA: 'Anulowana',
    WOLNA: 'Wolna',
    ZAJETA: 'Zajęta',
    USZKODZONA: 'Uszkodzona',
    AKTYWNY: 'Aktywny',
    W_SERWISIE: 'W serwisie',
    NIEAKTYWNY: 'Nieaktywny'
  };

  return map[value] || value || '-';
}

export function formatDate(value: unknown) {
  if (!value) return '-';
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('pl-PL');
}

export function packageId(pkg: PackageRow | null | undefined) {
  return Number(pkg?.paczka_id ?? pkg?.id ?? 0);
}

export function lockerId(locker: LockerCell | null | undefined) {
  return Number(locker?.skrytka_id ?? locker?.id ?? 0);
}

export function lockerSize(locker: LockerCell | null | undefined) {
  return String(locker?.rozmiar_kod ?? locker?.rozmiar ?? locker?.kod ?? '').trim().toUpperCase() || '-';
}

export function lockerDimensions(locker: LockerCell | null | undefined) {
  const width = locker?.szerokosc_cm;
  const height = locker?.wysokosc_cm;
  const depth = locker?.glebokosc_cm;
  return width && height && depth ? `${width} x ${height} x ${depth} cm` : '';
}

export function parcelLockerId(parcelLocker: ParcelLocker | null | undefined) {
  return Number(parcelLocker?.automat_id ?? parcelLocker?.id ?? 0);
}

export function parcelLockerName(parcelLocker: ParcelLocker | null | undefined) {
  return String(parcelLocker?.nazwa ?? parcelLocker?.kod ?? parcelLocker?.['name'] ?? 'Automat');
}

export function parcelLockerAddress(parcelLocker: ParcelLocker | null | undefined) {
  return String(parcelLocker?.adres ?? parcelLocker?.['address'] ?? '');
}

export function packageDimensions(pkg: PackageRow | null | undefined) {
  const width = pkg?.szerokosc_cm;
  const height = pkg?.wysokosc_cm;
  const depth = pkg?.glebokosc_cm;
  return width && height && depth ? `${width} x ${height} x ${depth} cm` : '-';
}

export function packageTracking(pkg: PackageRow | null | undefined) {
  return String(pkg?.numer_tracking ?? `#${packageId(pkg)}`);
}

export function apiMessage(error: unknown, fallback = 'Operacja nie powiodła się.') {
  return error instanceof Error ? error.message : fallback;
}
