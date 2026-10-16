import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => controller.verify());

  it('ajoute Authorization: Bearer <token> lorsqu’un token existe', () => {
    auth.token.set('faux-jwt');
    http.get('/api/users/me').subscribe();

    const req = controller.expectOne('/api/users/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer faux-jwt');
    req.flush({});
  });

  it('n’ajoute pas Authorization sans token', () => {
    auth.token.set(null);
    http.get('/api/health').subscribe();

    const req = controller.expectOne('/api/health');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ status: 'ok' });
  });
});