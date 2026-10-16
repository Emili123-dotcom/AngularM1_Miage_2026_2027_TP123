import { TestBed } from '@angular/core/testing';
import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TracksPageComponent } from './tracks-page';

const track = {
  id: 't1',
  title: 'Morceau 1',
  originalName: 'song1.mp3',
  mimeType: 'audio/mpeg',
  size: 3_600_000,
  createdAt: '2026-10-08T10:00:00Z',
};

/** Répond à la requête de liste lancée par le composant (constructeur ou rechargement). */
function flushList(http: HttpTestingController, items = [track]) {
  http
    .expectOne((r) => r.url === '/api/tracks' && r.method === 'GET')
    .flush({ items, page: 1, limit: 5, total: items.length, pages: 1 });
}

describe('TracksPageComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TracksPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
  });

  it('la suppression appelle DELETE /api/tracks/:id puis recharge la liste', () => {
    const component = TestBed.createComponent(TracksPageComponent).componentInstance;
    flushList(http);
    vi.spyOn(window, 'confirm').mockReturnValue(true); // l'utilisateur clique sur OK

    component.remove(track);
    expect(component.deletingId()).toBe('t1'); // bouton bloqué pendant la requête

    const req = http.expectOne('/api/tracks/t1');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(component.deletingId()).toBe('');
    flushList(http, []); // la liste est bien rechargée (nouvelle requête GET)
    expect(component.tracks()).toEqual([]);
  });

  it('une piste déjà supprimée (404) recharge la liste sans planter', () => {
    const component = TestBed.createComponent(TracksPageComponent).componentInstance;
    flushList(http);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.remove(track);
    http
      .expectOne('/api/tracks/t1')
      .flush({ message: 'Piste inconnue' }, { status: 404, statusText: 'Not Found' });

    expect(component.deletingId()).toBe('');
    flushList(http, []);
  });

  it('l’upload met à jour la progression puis traite l’erreur du serveur', () => {
    const component = TestBed.createComponent(TracksPageComponent).componentInstance;
    flushList(http);

    const file = new File(['abc'], 'song.mp3', { type: 'audio/mpeg' });
    component.file.set(file);
    component.upload(document.createElement('input'));
    expect(component.uploadState()).toBe('uploading');

    const req = http.expectOne((r) => r.url === '/api/tracks' && r.method === 'POST');
    req.event({ type: HttpEventType.UploadProgress, loaded: 40, total: 100 });
    expect(component.progress()).toBe(40);

    // Une seconde soumission pendant l'envoi est ignorée.
    component.upload(document.createElement('input'));
    http.expectNone((r) => r.url === '/api/tracks' && r.method === 'POST');

    req.flush({ message: 'Format audio non accepté' }, { status: 400, statusText: 'Bad Request' });
    expect(component.uploadState()).toBe('error');
    expect(component.uploadError()).toBe('Format audio non accepté');
  });

  it('affiche une erreur si le chargement de la liste échoue', () => {
    const component = TestBed.createComponent(TracksPageComponent).componentInstance;
    http
      .expectOne((r) => r.url === '/api/tracks')
      .flush({ message: 'Erreur serveur' }, { status: 500, statusText: 'Server Error' });

    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('Erreur serveur');
  });
});