import { HttpErrorResponse } from '@angular/common/http';

/**
 * Transforme une erreur HTTP en message lisible pour l'utilisateur.
 * Le backend renvoie ses erreurs sous la forme { message: "..." }
 * (400 validation, 401 identifiants, 409 email déjà utilisé).
 * Le statut 0 signifie que le backend ne répond pas.
 */
export function httpErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;

  if (error.status === 0) {
    return 'Le serveur ne répond pas. Le backend est-il lancé ?';
  }

  const body: unknown = error.error;
  if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
    return body.message;
  }

  return fallback;
}