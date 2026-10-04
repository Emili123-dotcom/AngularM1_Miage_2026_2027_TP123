import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthResponse } from '../models/auth-response.model';
import { User } from '../models/user.model';

/** Clé du token dans le localStorage du navigateur (survit au F5). */
const TOKEN_KEY = 'gpc_token';

/**
 * Service unique (singleton) qui gère l'authentification et le profil.
 * Les composants ne parlent JAMAIS directement à HttpClient : ils passent par ici.
 * Flux : composant → AuthService → HttpClient → intercepteur → API Express → MongoDB
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  /** Utilisateur connecté, ou null. Signal = l'affichage se met à jour tout seul. */
  readonly currentUser = signal<User | null>(null);

  /** JWT courant, relu depuis le localStorage au démarrage. Ne jamais l'afficher dans la console. */
  readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  /** computed() : valeur calculée automatiquement à partir du Signal token. */
  readonly isAuthenticated = computed(() => this.token() !== null);

  /** POST /api/auth/login — route publique. Réponse 200 { token, user }. */
  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>('/api/auth/login', { email, password })
      .pipe(tap((response) => this.storeAuthentication(response)));
  }

  /** POST /api/auth/register — route publique. Réponse 201 { token, user }. */
  register(name: string, email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>('/api/auth/register', { name, email, password })
      .pipe(tap((response) => this.storeAuthentication(response)));
  }

  /** GET /api/users/me — route protégée (le JWT est ajouté par l'intercepteur). */
  profile(): Observable<User> {
    return this.http
      .get<User>('/api/users/me')
      .pipe(tap((user) => this.currentUser.set(user)));
  }

  /** PUT /api/users/me { name } — route protégée. */
  update(name: string): Observable<User> {
    return this.http
      .put<User>('/api/users/me', { name })
      .pipe(tap((user) => this.currentUser.set(user)));
  }

  /**
   * Déconnexion locale : le backend ne garde pas de session (JWT = stateless),
   * il suffit d'effacer le token côté navigateur et de vider les Signals.
   */
  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.token.set(null);
    this.currentUser.set(null);
    void this.router.navigateByUrl('/login');
  }

  /** Mémorise le token (localStorage + Signal) et l'utilisateur (Signal). */
  private storeAuthentication(response: AuthResponse): void {
    localStorage.setItem(TOKEN_KEY, response.token);
    this.token.set(response.token);
    this.currentUser.set(response.user);
    console.debug('[AuthService] Connexion mémorisée pour', response.user.id);
  }
}