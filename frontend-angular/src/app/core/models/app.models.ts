export type Role = 'ADMIN' | 'OPERATOR' | 'KURIER' | 'KLIENT';

export interface AppUser {
  app_user_id: number;
  email: string;
  rola?: Role;
  role?: Role;
  klient_id?: number | null;
  clientId?: number | null;
  pracownik_id?: number | null;
  employeeId?: number | null;
  must_change_password?: boolean;
}

export interface AuthResponse {
  ok: boolean;
  token: string;
  role?: Role;
  rola?: Role;
  must_change_password?: boolean;
}

export interface MeResponse {
  ok: boolean;
  user: AppUser;
}

export interface ApiOk {
  ok: boolean;
  error?: string;
  message?: string;
}

export interface ParcelLocker {
  automat_id?: number;
  id?: number;
  nazwa?: string;
  kod?: string;
  adres?: string;
  miasto?: string;
  status?: string;
  [key: string]: unknown;
}

export interface LockerCell {
  skrytka_id?: number;
  id?: number;
  automat_id?: number;
  wiersz?: number;
  kolumna?: number;
  status?: string;
  rozmiar_kod?: string;
  kod?: string;
  [key: string]: unknown;
}

export interface PackageRow {
  paczka_id?: number;
  id?: number;
  numer_tracking?: string;
  status?: string;
  data_nadania?: string;
  termin_odbioru?: string | null;
  data_odbioru?: string | null;
  nadawca_id?: number;
  odbiorca_id?: number;
  nadawca_email?: string;
  odbiorca_email?: string;
  szerokosc_cm?: number;
  wysokosc_cm?: number;
  glebokosc_cm?: number;
  docelowy_automat_id?: number;
  docelowy_automat_nazwa?: string;
  docelowy_automat_adres?: string;
  docelowy_automat_miasto?: string;
  docelowy_automat_label?: string;
  automat_nazwa?: string;
  automat_adres?: string;
  skrytka_id?: number | null;
  [key: string]: unknown;
}

export interface PackageEvent {
  zdarzenie_id?: number;
  typ?: string;
  czas?: string;
  opis?: string;
}

export interface UserRow {
  app_user_id?: number;
  email?: string;
  rola?: Role;
  must_change_password?: boolean;
  klient_id?: number | null;
  klient_imie?: string | null;
  klient_nazwisko?: string | null;
  pracownik_id?: number | null;
  pracownik_imie?: string | null;
  pracownik_nazwisko?: string | null;
  pracownik_rola?: string | null;
}

export interface FaultyLockerRow {
  automat_id?: number;
  nazwa?: string;
  adres?: string;
  miasto?: string;
  faulty_lockers_count?: number | string;
  faulty_lockers_ids?: number[];
}
