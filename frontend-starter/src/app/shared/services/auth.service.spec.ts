import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('login() fait POST /api/auth/login avec {email, password} puis mémorise token et utilisateur', () => {
    service.login('demo@example.com', 'secret123').subscribe();

    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'demo@example.com', password: 'secret123' });

    req.flush({
      token: 'faux-jwt',
      user: { id: 'u1', name: 'Demo', email: 'demo@example.com', createdAt: '2026-01-01' },
    });

    expect(service.token()).toBe('faux-jwt');
    expect(service.currentUser()?.name).toBe('Demo');
    expect(localStorage.getItem('gpc_token')).toBe('faux-jwt');
  });
});