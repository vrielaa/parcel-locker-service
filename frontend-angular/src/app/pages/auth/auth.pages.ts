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
  templateUrl: './login.page.html'
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
  templateUrl: './register.page.html'
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
  templateUrl: './change-password.page.html'
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
