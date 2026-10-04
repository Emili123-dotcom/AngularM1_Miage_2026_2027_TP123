import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Intercepteur : il voit passer TOUTES les requêtes HttpClient.
 * 1. À l'aller : s'il y a un JWT, il ajoute "Authorization: Bearer <token>".
 *    La requête d'origine ne peut pas être modifiée, on travaille sur une copie (clone).
 * 2. Au retour : si l'API répond 401 sur une route protégée (token absent,
 *    invalide ou expiré), on déconnecte et on renvoie vers /login.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const token = auth.token();

  const authorizedRequest = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authorizedRequest).pipe(
    catchError((error: unknown) => {
      // Un 401 sur /api/auth/login = mauvais mot de passe : ce n'est pas un
      // token expiré, donc on ne redirige pas (le formulaire affiche le message).
      const isAuthRoute = request.url.includes('/api/auth/');

      if (error instanceof HttpErrorResponse && error.status === 401 && !isAuthRoute) {
        console.warn('[authInterceptor] 401 : token invalide ou expiré → /login');
        auth.logout();
      }

      // On relance l'erreur pour que le composant puisse aussi la traiter.
      return throwError(() => error);
    }),
  );
};