import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';
import { httpErrorMessage } from '../../shared/utils/http-error-message';

/** Mêmes règles que le backend (backend/src/app.js : `allowed` et MAX_FILE_SIZE). */
const ALLOWED_TYPES = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 Mo

/**
 * Page « Backing tracks » : bibliothèque paginée, upload et lecture authentifiée.
 * Tout l'état de la page est stocké dans des Signals : le template se met à jour tout seul.
 */
@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './tracks-page.html',
  styleUrl: './tracks-page.css',
})
export class TracksPageComponent {
  private readonly service = inject(TrackService);

  // ---------- Mission 2 : bibliothèque paginée ----------
  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly total = signal(0);
  readonly limit = signal(5);
  readonly loading = signal(false);
  readonly error = signal('');

  // ---------- Mission 3 : upload ----------
  readonly title = new FormControl('', { nonNullable: true });
  readonly file = signal<File | null>(null);
  readonly uploading = signal(false);
  readonly uploadError = signal('');
  readonly uploadSuccess = signal('');

  // ---------- Mission 3 : lecture ----------
  readonly audioUrl = signal('');
  readonly playing = signal<Track | null>(null);
  readonly loadingAudioId = signal('');
  readonly audioError = signal('');

  constructor() {
    this.load();

    // À la destruction du composant (on quitte la page), on libère l'ObjectURL
    // encore utilisée par le lecteur, sinon le Blob resterait en mémoire.
    inject(DestroyRef).onDestroy(() => this.revokeAudioUrl());
  }

  // =====================================================================
  // Mission 2 — Pagination serveur
  // =====================================================================

  /** Charge UNE page depuis le serveur : GET /api/tracks?page=...&limit=... */
  load(): void {
    this.loading.set(true);
    this.error.set('');

    this.service.list(this.page(), this.limit()).subscribe({
      next: (response) => {
        console.debug('[TracksPage] Page', response.page, '/', response.pages, ':', response.items.length, 'piste(s)');
        this.tracks.set(response.items);
        this.pages.set(response.pages);
        this.total.set(response.total);
        this.loading.set(false);

        // Si la page courante est devenue vide (ex. après une suppression), on recule d'une page.
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

  /** Change de page puis refait une requête HTTP (jamais de découpage local). */
  go(page: number): void {
    if (page < 1 || page > this.pages()) return;
    this.page.set(page);
    this.load();
  }

  /** Change le nombre de pistes par page et revient à la page 1. */
  changeLimit(event: Event): void {
    this.limit.set(Number((event.target as HTMLSelectElement).value));
    this.page.set(1);
    this.load();
  }

  // =====================================================================
  // Mission 3 — Upload
  // =====================================================================

  /** Choix du fichier : on le vérifie tout de suite pour prévenir l'utilisateur. */
  choose(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.uploadSuccess.set('');
    this.uploadError.set(file ? this.validate(file) : '');
    this.file.set(file);
    console.debug('[TracksPage] Fichier sélectionné', file?.name, file?.type, file?.size);
  }

  /**
   * Validation côté front : mêmes règles que le backend.
   * Elle évite d'envoyer 25 Mo pour rien et donne un message immédiat,
   * mais le backend revalide toujours (le front peut être contourné).
   * Retourne un message d'erreur, ou '' si le fichier est valide.
   */
  private validate(file: File): string {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Format non accepté (${file.type || 'inconnu'}). Formats autorisés : MP3, WAV, OGG, M4A.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `Fichier trop volumineux (${this.formatSize(file.size)}). Maximum : 25 Mo.`;
    }
    return '';
  }

  upload(input: HTMLInputElement): void {
    const file = this.file();
    // Empêche les doubles soumissions et les envois sans fichier.
    if (!file || this.uploading()) return;

    const problem = this.validate(file);
    if (problem) {
      this.uploadError.set(problem);
      return;
    }

    this.uploading.set(true);
    this.uploadError.set('');
    this.uploadSuccess.set('');
    const title = this.title.value.trim() || file.name;

    this.service.upload(file, title).subscribe({
      next: (track) => {
        console.debug('[TracksPage] Piste envoyée', track.id);
        this.uploading.set(false);
        this.uploadSuccess.set(`« ${track.title} » a bien été ajouté.`);
        // Vider le formulaire (y compris le champ fichier) et revenir à la page 1.
        this.title.setValue('');
        this.file.set(null);
        input.value = '';
        this.page.set(1);
        this.load();
      },
      error: (error: unknown) => {
        console.error('[TracksPage] Envoi impossible', error);
        this.uploading.set(false);
        this.uploadError.set(httpErrorMessage(error, 'Envoi impossible'));
      },
    });
  }

  // =====================================================================
  // Mission 3 — Lecture authentifiée
  // =====================================================================

  /**
   * On ne peut pas mettre directement /api/tracks/:id/audio dans <audio src> :
   * le navigateur ferait la requête lui-même, SANS passer par HttpClient,
   * donc sans l'intercepteur et sans le header Authorization → 401.
   * On télécharge donc le fichier avec HttpClient (JWT ajouté), on obtient un Blob,
   * puis URL.createObjectURL(blob) crée une adresse locale "blob:..." lisible par <audio>.
   */
  play(track: Track): void {
    this.loadingAudioId.set(track.id);
    this.audioError.set('');

    this.service.audio(track.id).subscribe({
      next: (blob) => {
        console.debug('[TracksPage] Audio reçu', track.id, blob.size, 'octets');
        this.revokeAudioUrl(); // libère l'ancien morceau avant d'en créer un nouveau
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

  /** Appelé par l'événement (error) de <audio> : fichier corrompu ou format non lisible. */
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
  // Bonus — Suppression
  // =====================================================================

  remove(track: Track): void {
    if (!confirm(`Supprimer « ${track.title} » ?`)) return;

    this.service.remove(track.id).subscribe({
      next: () => {
        console.debug('[TracksPage] Piste supprimée', track.id);
        if (this.playing()?.id === track.id) {
          this.revokeAudioUrl();
          this.playing.set(null);
        }
        this.load();
      },
      error: (error: unknown) => {
        console.error('[TracksPage] Suppression impossible', error);
        this.error.set(httpErrorMessage(error, 'Suppression impossible'));
      },
    });
  }

  // =====================================================================
  // Affichage
  // =====================================================================

  /** 3605337 → « 3,4 Mo » (le backend renvoie la taille en octets). */
  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1).replace('.', ',')} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
  }

  /** "audio/mpeg" → « MP3 ». */
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

  /** "2026-10-04T18:18:06.774Z" → « 04/10/2026 20:18 ». */
  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  }
}