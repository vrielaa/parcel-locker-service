import { Component, inject, signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthStore } from '../../core/auth/auth.store';
import { apiMessage } from '../../core/utils/format';

interface LoginFormModel {
  email: string;
  password: string;
}

interface RegisterFormModel {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  password2: string;
}

interface ChangePasswordFormModel {
  currentPassword: string;
  newPassword: string;
  newPassword2: string;
}


@Component({
  selector: 'app-login-page',
  imports: [FormField, RouterLink],
  templateUrl: './login.page.html'
})
export class LoginPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly loginModel = signal<LoginFormModel>({
    email: '',
    password: ''
  });
  protected readonly loginForm = form(this.loginModel);
  protected readonly submitting = signal(false);
  protected readonly message = signal('');

  protected async submit(event: Event) {
    event.preventDefault();
    this.message.set('');
    const credentials = this.loginModel();

    if (!credentials.email.trim() || !credentials.password) {
      this.message.set('Uzupełnij email i hasło.');
      return;
    }

    this.submitting.set(true);
    try {
      const data = await this.auth.login(credentials.email.trim(), credentials.password);
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
      await this.router.navigateByUrl(data.must_change_password ? '/change-password' : returnUrl);
    } catch (error) {
      this.loginForm.password().value.set('');
      this.message.set(apiMessage(error, 'Nieprawidłowy email lub hasło.'));
    } finally {
      this.submitting.set(false);
    }
  }
}

@Component({
  selector: 'app-register-page',
  imports: [FormField, RouterLink],
  templateUrl: './register.page.html'
})
export class RegisterPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly registerModel = signal<RegisterFormModel>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    password2: ''
  });
  protected readonly registerForm = form(this.registerModel);
  protected readonly submitting = signal(false);
  protected readonly message = signal('');

  protected async submit(event: Event) {
    event.preventDefault();
    this.message.set('');
    const data = this.registerModel();

    if (!data.firstName.trim() || !data.lastName.trim() || !data.email.trim()) {
      this.message.set('Uzupełnij imię, nazwisko i email.');
      return;
    }

    if (data.password.length < 8) {
      this.message.set('Hasło musi mieć min. 8 znaków.');
      return;
    }

    if (data.password !== data.password2) {
      this.message.set('Hasła nie są takie same.');
      return;
    }

    this.submitting.set(true);
    try {
      const response = await this.auth.register({
        imie: data.firstName.trim(),
        nazwisko: data.lastName.trim(),
        email: data.email.trim().toLowerCase(),
        telefon: data.phone.trim() || null,
        password: data.password,
        password2: data.password2
      });

      await this.router.navigateByUrl(response.must_change_password ? '/change-password' : '/dashboard');
    } catch (error) {
      this.message.set(apiMessage(error, 'Rejestracja nieudana.'));
    } finally {
      this.submitting.set(false);
    }
  }
}

@Component({
  selector: 'app-change-password-page',
  imports: [FormField],
  templateUrl: './change-password.page.html'
})
export class ChangePasswordPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly changePasswordModel = signal<ChangePasswordFormModel>({
    currentPassword: '',
    newPassword: '',
    newPassword2: ''
  });
  protected readonly changePasswordForm = form(this.changePasswordModel);
  protected readonly submitting = signal(false);
  protected readonly message = signal('');

  protected async submit(event: Event) {
    event.preventDefault();
    this.message.set('');
    const data = this.changePasswordModel();

    if (data.newPassword.length < 8) {
      this.message.set('Nowe hasło musi mieć min. 8 znaków.');
      return;
    }

    if (data.newPassword !== data.newPassword2) {
      this.message.set('Nowe hasła nie są takie same.');
      return;
    }

    this.submitting.set(true);
    try {
      await this.auth.changePassword(data.currentPassword, data.newPassword);
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      this.message.set(apiMessage(error, 'Nie udało się zmienić hasła.'));
    } finally {
      this.submitting.set(false);
    }
  }
}
