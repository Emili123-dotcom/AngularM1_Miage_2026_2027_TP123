import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Page } from '../models/page.model';
import { Track } from '../models/track.model';

/**
 * Toutes les opérations HTTP sur les pistes audio.
 * Le composant ne parle jamais directement à HttpClient : il passe par ce service.
 * Le JWT est ajouté automatiquement par authInterceptor sur chaque requête.
 */
@Injectable({ providedIn: 'root' })
export class TrackService {
  private readonly http = inject(HttpClient);

  /**
   * GET /api/tracks?page=...&limit=... — pagination CÔTÉ SERVEUR.
   * Chaque changement de page déclenche une NOUVELLE requête.
   */
  list(page = 1, limit = 5): Observable<Page<Track>> {
    return this.http.get<Page<Track>>('/api/tracks', {
      params: { page, limit },
    });
  }

  /**
   * POST /api/tracks en multipart/form-data, AVEC PROGRESSION (TP3).
   * - reportProgress: true → Angular émet des événements UploadProgress pendant l'envoi ;
   * - observe: 'events'    → on reçoit TOUS les événements HTTP (envoi, progression,
   *   réponse) et pas seulement la réponse finale.
   * L'Observable émet donc PLUSIEURS valeurs, puis la réponse (HttpResponse<Track>).
   */
  upload(file: File, title: string): Observable<HttpEvent<Track>> {
    const body = new FormData();
    body.append('audio', file);
    body.append('title', title);
    return this.http.post<Track>('/api/tracks', body, {
      reportProgress: true,
      observe: 'events',
    });
  }

  /** GET /api/tracks/:id/audio — le fichier complet est reçu sous forme de Blob. */
  audio(id: string): Observable<Blob> {
    return this.http.get(`/api/tracks/${id}/audio`, { responseType: 'blob' });
  }

  /**
   * DELETE /api/tracks/:id — réponse 204 sans contenu.
   * Le backend vérifie le JWT ET que la piste appartient à l'utilisateur :
   * sinon il répond 404 (« Piste inconnue »).
   */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/tracks/${id}`);
  }
}