import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideRouter([])] });
  });

  /** Exécute le guard dans le contexte d'injection Angular (inject() y est autorisé). */
  const runGuard = () =>
    TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));

  it('redirige vers /login un utilisateur sans token', () => {
    TestBed.inject(AuthService).token.set(null);
    const result = runGuard();

    expect(result instanceof UrlTree).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('laisse passer un utilisateur avec token', () => {
    TestBed.inject(AuthService).token.set('faux-jwt');
    expect(runGuard()).toBe(true);
  });
});