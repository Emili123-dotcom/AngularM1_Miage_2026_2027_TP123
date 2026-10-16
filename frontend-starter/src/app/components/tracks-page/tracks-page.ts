import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';
import { httpErrorMessage } from '../../shared/utils/http-error-message';

/** Mêmes règles que le backend (backend/src/app.js : `allowed` et MAX_FILE_SIZE). */
const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 Mo

/** Les 4 états possibles d'un upload (Mission 6). */
export type UploadState = 'idle' | 'uploading' | 'success' | 'error';

/**
 * Page « Backing tracks » : bibliothèque paginée, upload avec progression,
 * lecture authentifiée et suppression.
 */
@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './tracks-page.html',
  styleUrl: './tracks-page.css',
})
export class TracksPageComponent {
  private readonly service = inject(TrackService);
  private readonly snackBar = inject(MatSnackBar);

  // ---------- Bibliothèque paginée (TP2) ----------
  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly total = signal(0);
  readonly limit = signal(5);
  readonly loading = signal(false);
  readonly error = signal('');

  // ---------- Upload avec progression (TP3 — Mission 6) ----------
  readonly title = new FormControl('', { nonNullable: true });
  readonly file = signal<File | null>(null);
  readonly uploadState = signal<UploadState>('idle');
  readonly progress = signal(0); // pourcentage de 0 à 100
  readonly uploading = computed(() => this.uploadState() === 'uploading');
  readonly uploadError = signal('');
  readonly uploadSuccess = signal('');

  // ---------- Lecture (TP2) ----------
  readonly audioUrl = signal('');
  readonly playing = signal<Track | null>(null);
  readonly loadingAudioId = signal('');
  readonly audioError = signal('');

  // ---------- Suppression (TP3 — Mission 5) ----------
  /** Id de la piste en cours de suppression : désactive son bouton (anti double clic). */
  readonly deletingId = signal('');

  constructor() {
    this.load();
    inject(DestroyRef).onDestroy(() => this.revokeAudioUrl());
  }

  // =====================================================================
  // Pagination serveur
  // =====================================================================

  /** Charge UNE page depuis le serveur : GET /api/tracks?page=...&limit=... */
  load(): void {
    this.loading.set(true);
    this.error.set('');

    this.service.list(this.page(), this.limit()).subscribe({
      next: (response) => {
        this.tracks.set(response.items);
        this.pages.set(response.pages);
        this.total.set(response.total);
        this.loading.set(false);

        // Page devenue vide (ex. après une suppression) → on recule d'une page.
        if (response.items.length === 0 && this.page() > 1) {
          this.go(this.page() - 1);
        }
      },
      error: (error: unknown) => {
        console.error('[TracksPage] Chargement impossible', error);
        this.loading.set(false);
        this.error.set(httpErrorMessage(error, 'Impossible de charger les pistes'));
      },
    });
  }

  go(page: number): void {
    if (page < 1 || page > this.pages()) return;
    this.page.set(page);
    this.load();
  }

  changeLimit(event: Event): void {
    this.limit.set(Number((event.target as HTMLSelectElement).value));
    this.page.set(1);
    this.load();
  }

  // =====================================================================
  // Mission 6 — Upload avec progression
  // =====================================================================

  choose(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.uploadSuccess.set('');
    this.uploadError.set(file ? this.validate(file) : '');
    this.uploadState.set('idle');
    this.progress.set(0);
    this.file.set(file);
  }

  /** Validation front (mêmes règles que le backend). Retourne '' si le fichier est valide. */
  private validate(file: File): string {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Format non accepté (${file.type || 'inconnu'}). Formats autorisés : MP3, WAV, OGG, M4A.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `Fichier trop volumineux (${this.formatSize(file.size)}). Maximum : 25 Mo.`;
    }
    return '';
  }

  /**
   * Contrairement à une requête classique (une seule valeur : la réponse),
   * l'upload avec progression émet PLUSIEURS événements :
   *   Sent → UploadProgress (×n) → Response.
   * On traite chaque type d'événement dans `next`.
   */
  upload(input: HTMLInputElement): void {
    const file = this.file();
    if (!file || this.uploading()) return; // empêche une seconde soumission

    const problem = this.validate(file);
    if (problem) {
      this.uploadError.set(problem);
      return;
    }

    this.uploadState.set('uploading');
    this.progress.set(0);
    this.uploadError.set('');
    this.uploadSuccess.set('');
    this.title.disable(); // contrôles désactivés pendant l'envoi
    const title = this.title.value.trim() || file.name;

    this.service.upload(file, title).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          // loaded = octets déjà envoyés, total = taille totale de la requête.
          const total = event.total ?? file.size;
          this.progress.set(Math.round((100 * event.loaded) / total));
        } else if (event.type === HttpEventType.Response) {
          const track = event.body;
          this.progress.set(100);
          this.uploadState.set('success');
          this.uploadSuccess.set(`« ${track?.title ?? title} » a bien été ajouté.`);
          this.title.enable();
          this.title.setValue('');
          this.file.set(null);
          input.value = '';
          this.page.set(1);
          this.load();
        }
      },
      error: (error: unknown) => {
        console.error('[TracksPage] Envoi impossible', error);
        this.uploadState.set('error');
        this.title.enable();
        this.uploadError.set(httpErrorMessage(error, 'Envoi impossible'));
      },
    });
  }

  // =====================================================================
  // Lecture authentifiée (TP2)
  // =====================================================================

  play(track: Track): void {
    this.loadingAudioId.set(track.id);
    this.audioError.set('');

    this.service.audio(track.id).subscribe({
      next: (blob) => {
        this.revokeAudioUrl();
        this.audioUrl.set(URL.createObjectURL(blob));
        this.playing.set(track);
        this.loadingAudioId.set('');
      },
      error: (error: unknown) => {
        console.error('[TracksPage] Lecture impossible', error);
        this.loadingAudioId.set('');
        this.audioError.set(httpErrorMessage(error, 'Impossible de récupérer ce morceau'));
      },
    });
  }

  onAudioError(): void {
    this.audioError.set('Le navigateur ne parvient pas à lire ce fichier audio (format non supporté ou fichier corrompu).');
  }

  private revokeAudioUrl(): void {
    const url = this.audioUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.audioUrl.set('');
    }
  }

  // =====================================================================
  // Mission 5 — Suppression
  // =====================================================================

  /**
   * card → TrackService.remove() → HttpClient → DELETE /api/tracks/:id
   * Le bouton est désactivé pendant la requête (deletingId) et un SnackBar
   * affiche le résultat. Dans tous les cas, la liste est rechargée depuis le serveur.
   */
  remove(track: Track): void {
    if (this.deletingId()) return; // une suppression est déjà en cours
    if (!confirm(`Supprimer « ${track.title} » ?`)) return;

    this.deletingId.set(track.id);

    this.service.remove(track.id).subscribe({
      next: () => {
        this.deletingId.set('');
        this.stopIfPlaying(track);
        this.snackBar.open(`« ${track.title} » a été supprimé.`, 'OK', { duration: 3000 });
        this.load();
      },
      error: (error: unknown) => {
        this.deletingId.set('');

        if (error instanceof HttpErrorResponse && error.status === 404) {
          // Cas prévu : la piste a déjà été supprimée (autre onglet) ou n'appartient pas à l'utilisateur.
          console.warn('[TracksPage] Piste introuvable (déjà supprimée ou pas à moi)', track.id);
          this.stopIfPlaying(track);
          this.snackBar.open('Cette piste n’existe plus ou ne vous appartient pas. La liste a été mise à jour.', 'OK', {
            duration: 5000,
          });
          this.load();
        } else {
          console.error('[TracksPage] Suppression impossible', error);
          this.snackBar.open(httpErrorMessage(error, 'Suppression impossible'), 'OK', { duration: 5000 });
        }
      },
    });
  }

  private stopIfPlaying(track: Track): void {
    if (this.playing()?.id === track.id) {
      this.revokeAudioUrl();
      this.playing.set(null);
    }
  }

  // =====================================================================
  // Affichage
  // =====================================================================

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
  }

  formatType(mimeType: string): string {
    const names: Record<string, string> = {
      'audio/mpeg': 'MP3',
      'audio/wav': 'WAV',
      'audio/x-wav': 'WAV',
      'audio/ogg': 'OGG',
      'audio/mp4': 'M4A',
      'audio/x-m4a': 'M4A',
    };
    return names[mimeType] ?? mimeType;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  }
}