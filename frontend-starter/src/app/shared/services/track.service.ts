import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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
   * `params` construit la query string : chaque changement de page déclenche
   * une NOUVELLE requête, on ne télécharge jamais toutes les pistes d'un coup.
   */
  list(page = 1, limit = 5): Observable<Page<Track>> {
    return this.http.get<Page<Track>>('/api/tracks', {
      params: { page, limit },
    });
  }

  /**
   * POST /api/tracks en multipart/form-data.
   * Les noms des champs doivent être EXACTEMENT ceux attendus par le backend :
   * `audio` (lu par Multer avec upload.single("audio")) et `title` (req.body.title).
   * On ne fixe pas le Content-Type : le navigateur l'ajoute avec la "boundary".
   */
  upload(file: File, title: string): Observable<Track> {
    const body = new FormData();
    body.append('audio', file);
    body.append('title', title);
    return this.http.post<Track>('/api/tracks', body);
  }

  /**
   * GET /api/tracks/:id/audio — lecture authentifiée.
   * responseType 'blob' : HttpClient télécharge tout le fichier, puis le composant
   * reçoit un Blob (données binaires en mémoire du navigateur).
   */
  audio(id: string): Observable<Blob> {
    return this.http.get(`/api/tracks/${id}/audio`, { responseType: 'blob' });
  }

  /** DELETE /api/tracks/:id — réponse 204 sans contenu (bonus du sujet). */
  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/tracks/${id}`);
  }
}