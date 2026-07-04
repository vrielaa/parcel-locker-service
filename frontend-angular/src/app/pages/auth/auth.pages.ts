import { Component, WritableSignal, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthStore } from '../../core/auth/auth.store';
import { apiMessage } from '../../core/utils/format';

const authCardClass = 'mx-auto grid w-full max-w-md gap-5 rounded-2xl border border-line bg-surface p-7 shadow-card';
const labelClass = 'grid gap-1.5 text-sm font-semibold text-foreground';
const inputClass = 'min-h-11 rounded-lg border border-line bg-field px-3 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/20';
const buttonClass = 'min-h-11 rounded-lg bg-brand px-4 text-sm font-bold text-white transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-55';
const secondaryLinkClass = 'font-semibold text-brand-strong no-underline hover:underline';

@Component({
  selector: 'app-login-page',
  imports: [RouterLink],
  template: `
    <main class="grid min-h-screen place-items-center bg-background px-4 py-10">
      <section [class]="authCardClass">
        <div>
          <p class="mb-2 text-xs font-bold uppercase text-muted">Parcel Locker 2.0</p>
          <h1 class="m-0 text-3xl leading-tight">Logowanie</h1>
          <p class="mt-2 text-sm leading-6 text-muted">Zaloguj się, żeby przejść do nowej wersji aplikacji.</p>
        </div>

        <form class="grid gap-4" (submit)="submit($event)">
          <label [class]="labelClass">
            Email
            <input [class]="inputClass" type="email" autocomplete="email" [value]="email()" (input)="setValue(email, $event)">
          </label>

          <label [class]="labelClass">
            Hasło
            <input [class]="inputClass" type="password" autocomplete="current-password" [value]="password()" (input)="setValue(password, $event)">
          </label>

          @if (message()) {
            <p class="m-0 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">{{ message() }}</p>
          }

          <button [class]="buttonClass" type="submit" [disabled]="submitting()">
            {{ submitting() ? 'Logowanie...' : 'Zaloguj się' }}
          </button>
        </form>

        <p class="m-0 text-sm text-muted">
          Nie masz konta?
          <a [class]="secondaryLinkClass" routerLink="/register">Zarejestruj się</a>
        </p>
      </section>
    </main>
  `
})
export class LoginPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly authCardClass = authCardClass;
  protected readonly labelClass = labelClass;
  protected readonly inputClass = inputClass;
  protected readonly buttonClass = buttonClass;
  protected readonly secondaryLinkClass = secondaryLinkClass;

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly submitting = signal(false);
  protected readonly message = signal('');

  protected setValue(target: WritableSignal<string>, event: Event) {
    target.set((event.target as HTMLInputElement).value);
    this.message.set('');
  }

  protected async submit(event: Event) {
    event.preventDefault();
    this.message.set('');

    if (!this.email().trim() || !this.password()) {
      this.message.set('Uzupełnij email i hasło.');
      return;
    }

    this.submitting.set(true);
    try {
      const data = await this.auth.login(this.email().trim(), this.password());
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
      await this.router.navigateByUrl(data.must_change_password ? '/change-password' : returnUrl);
    } catch (error) {
      this.password.set('');
      this.message.set(apiMessage(error, 'Nieprawidłowy email lub hasło.'));
    } finally {
      this.submitting.set(false);
    }
  }
}

@Component({
  selector: 'app-register-page',
  imports: [RouterLink],
  template: `
    <main class="grid min-h-screen place-items-center bg-background px-4 py-10">
      <section class="mx-auto grid w-full max-w-2xl gap-5 rounded-2xl border border-line bg-surface p-7 shadow-card">
        <div>
          <p class="mb-2 text-xs font-bold uppercase text-muted">Nowe konto klienta</p>
          <h1 class="m-0 text-3xl leading-tight">Rejestracja</h1>
        </div>

        <form class="grid gap-4" (submit)="submit($event)">
          <div class="grid gap-4 md:grid-cols-2">
            <label [class]="labelClass">Imię<input [class]="inputClass" [value]="firstName()" (input)="setValue(firstName, $event)"></label>
            <label [class]="labelClass">Nazwisko<input [class]="inputClass" [value]="lastName()" (input)="setValue(lastName, $event)"></label>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <label [class]="labelClass">Email<input [class]="inputClass" type="email" [value]="email()" (input)="setValue(email, $event)"></label>
            <label [class]="labelClass">Telefon<input [class]="inputClass" [value]="phone()" (input)="setValue(phone, $event)"></label>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <label [class]="labelClass">Hasło<input [class]="inputClass" type="password" [value]="password()" (input)="setValue(password, $event)"></label>
            <label [class]="labelClass">Powtórz hasło<input [class]="inputClass" type="password" [value]="password2()" (input)="setValue(password2, $event)"></label>
          </div>

          @if (message()) {
            <p class="m-0 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">{{ message() }}</p>
          }

          <button [class]="buttonClass" type="submit" [disabled]="submitting()">
            {{ submitting() ? 'Tworzenie konta...' : 'Utwórz konto' }}
          </button>
        </form>

        <p class="m-0 text-sm text-muted">
          Masz już konto?
          <a [class]="secondaryLinkClass" routerLink="/login">Wróć do logowania</a>
        </p>
      </section>
    </main>
  `
})
export class RegisterPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly labelClass = labelClass;
  protected readonly inputClass = inputClass;
  protected readonly buttonClass = buttonClass;
  protected readonly secondaryLinkClass = secondaryLinkClass;

  protected readonly firstName = signal('');
  protected readonly lastName = signal('');
  protected readonly email = signal('');
  protected readonly phone = signal('');
  protected readonly password = signal('');
  protected readonly password2 = signal('');
  protected readonly submitting = signal(false);
  protected readonly message = signal('');

  protected setValue(target: WritableSignal<string>, event: Event) {
    target.set((event.target as HTMLInputElement).value);
    this.message.set('');
  }

  protected async submit(event: Event) {
    event.preventDefault();
    this.message.set('');

    if (!this.firstName().trim() || !this.lastName().trim() || !this.email().trim()) {
      this.message.set('Uzupełnij imię, nazwisko i email.');
      return;
    }

    if (this.password().length < 8) {
      this.message.set('Hasło musi mieć min. 8 znaków.');
      return;
    }

    if (this.password() !== this.password2()) {
      this.message.set('Hasła nie są takie same.');
      return;
    }

    this.submitting.set(true);
    try {
      const data = await this.auth.register({
        imie: this.firstName().trim(),
        nazwisko: this.lastName().trim(),
        email: this.email().trim().toLowerCase(),
        telefon: this.phone().trim() || null,
        password: this.password(),
        password2: this.password2()
      });

      await this.router.navigateByUrl(data.must_change_password ? '/change-password' : '/dashboard');
    } catch (error) {
      this.message.set(apiMessage(error, 'Rejestracja nieudana.'));
    } finally {
      this.submitting.set(false);
    }
  }
}

@Component({
  selector: 'app-change-password-page',
  template: `
    <main class="grid min-h-screen place-items-center bg-background px-4 py-10">
      <section [class]="authCardClass">
        <div>
          <p class="mb-2 text-xs font-bold uppercase text-muted">Bezpieczeństwo</p>
          <h1 class="m-0 text-3xl leading-tight">Zmień hasło</h1>
        </div>

        <form class="grid gap-4" (submit)="submit($event)">
          <label [class]="labelClass">Aktualne hasło<input [class]="inputClass" type="password" [value]="currentPassword()" (input)="setValue(currentPassword, $event)"></label>
          <label [class]="labelClass">Nowe hasło<input [class]="inputClass" type="password" [value]="newPassword()" (input)="setValue(newPassword, $event)"></label>
          <label [class]="labelClass">Powtórz nowe hasło<input [class]="inputClass" type="password" [value]="newPassword2()" (input)="setValue(newPassword2, $event)"></label>

          @if (message()) {
            <p class="m-0 rounded-lg border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">{{ message() }}</p>
          }

          <button [class]="buttonClass" type="submit" [disabled]="submitting()">
            {{ submitting() ? 'Zapisywanie...' : 'Zmień hasło' }}
          </button>
        </form>
      </section>
    </main>
  `
})
export class ChangePasswordPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly authCardClass = authCardClass;
  protected readonly labelClass = labelClass;
  protected readonly inputClass = inputClass;
  protected readonly buttonClass = buttonClass;

  protected readonly currentPassword = signal('');
  protected readonly newPassword = signal('');
  protected readonly newPassword2 = signal('');
  protected readonly submitting = signal(false);
  protected readonly message = signal('');

  protected setValue(target: WritableSignal<string>, event: Event) {
    target.set((event.target as HTMLInputElement).value);
    this.message.set('');
  }

  protected async submit(event: Event) {
    event.preventDefault();
    this.message.set('');

    if (this.newPassword().length < 8) {
      this.message.set('Nowe hasło musi mieć min. 8 znaków.');
      return;
    }

    if (this.newPassword() !== this.newPassword2()) {
      this.message.set('Nowe hasła nie są takie same.');
      return;
    }

    this.submitting.set(true);
    try {
      await this.auth.changePassword(this.currentPassword(), this.newPassword());
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      this.message.set(apiMessage(error, 'Nie udało się zmienić hasła.'));
    } finally {
      this.submitting.set(false);
    }
  }
}
