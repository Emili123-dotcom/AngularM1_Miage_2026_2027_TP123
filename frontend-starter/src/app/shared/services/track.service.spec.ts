import { TestBed } from '@angular/core/testing';
import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TrackService } from './track.service';

describe('TrackService', () => {
  let service: TrackService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TrackService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list() transmet page et limit en paramètres de GET /api/tracks', () => {
    let total = -1;
    service.list(2, 5).subscribe((page) => (total = page.total));

    const req = http.expectOne((r) => r.url === '/api/tracks');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('5');

    req.flush({ items: [], page: 2, limit: 5, total: 7, pages: 2 });
    expect(total).toBe(7);
  });

  it('remove() appelle DELETE /api/tracks/:id', () => {
    let done = false;
    service.remove('abc123').subscribe(() => (done = true));

    const req = http.expectOne('/api/tracks/abc123');
    expect(req.request.method).toBe('DELETE');

    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(done).toBe(true);
  });

  it('upload() envoie un FormData {audio, title} et émet les événements de progression', () => {
    const file = new File(['abc'], 'song.mp3', { type: 'audio/mpeg' });
    const types: HttpEventType[] = [];
    service.upload(file, 'Mon titre').subscribe((event) => types.push(event.type));

    const req = http.expectOne('/api/tracks');
    expect(req.request.method).toBe('POST');
    expect(req.request.reportProgress).toBe(true);

    const body = req.request.body as FormData;
    expect((body.get('audio') as File).name).toBe('song.mp3');
    expect(body.get('title')).toBe('Mon titre');

    req.event({ type: HttpEventType.UploadProgress, loaded: 50, total: 100 });
    req.flush({ id: 't1', title: 'Mon titre' }, { status: 201, statusText: 'Created' });

    expect(types).toContain(HttpEventType.UploadProgress);
    expect(types).toContain(HttpEventType.Response);
  });
});