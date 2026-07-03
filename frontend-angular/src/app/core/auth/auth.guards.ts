import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthStore } from './auth.store';
import { Role } from '../models/app.models';

export const authGuard: CanActivateFn = async (route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const user = await auth.ensureUser();

  if (!user) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  const isChangePasswordRoute = route.routeConfig?.path === 'change-password';
  if (user.must_change_password && !isChangePasswordRoute) {
    return router.createUrlTree(['/change-password']);
  }

  return true;
};

export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const user = await auth.ensureUser();
  return user ? router.createUrlTree(['/dashboard']) : true;
};

export const roleGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const roles = (route.data['roles'] || []) as readonly Role[];

  await auth.ensureUser();
  return roles.length === 0 || auth.hasAnyRole(roles) ? true : router.createUrlTree(['/dashboard']);
};
