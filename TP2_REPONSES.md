# TP2 — Réponses

Étudiante : Emili MERAHI

## Mission 2 — Bibliothèque paginée

**Flux :** `TracksPageComponent.load()` → `TrackService.list(page, limit)` → `HttpClient.get('/api/tracks', { params: { page, limit } })` → `GET /api/tracks?page=...&limit=...` → Express (`Track.find().skip().limit()` + `countDocuments`) → MongoDB.

- **Signals** (`tracks-page.ts`) : `tracks`, `page`, `pages`, `total`, `limit`, `loading`, `error`.
- **Template** : `@for` pour les cards, `@empty` pour « Aucune piste », `@if` pour le chargement et les erreurs.
- **Précédent / Suivant** : désactivés aux bornes (`page() <= 1`, `page() >= pages()`).
- **Chaque changement de page** (et de « par page ») relance une **nouvelle requête HTTP** : on ne récupère jamais toutes les pistes pour les découper dans Angular. La découpe est faite par le serveur (`skip((page - 1) * limit).limit(limit)`).

## Mission 3 — Analyse de l'upload et de la lecture

### Où se trouve chaque étape ?

| Étape | Fichier | Méthode |
|---|---|---|
| Choix du fichier | `tracks-page.html` / `tracks-page.ts` | `<input type="file" (change)="choose($event)">` → `choose()` |
| Vérification front | `tracks-page.ts` | `validate()` (type MIME + 25 Mo) |
| Construction du `FormData` | `shared/services/track.service.ts` | `upload()` : `append('audio', file)` et `append('title', title)` |
| Appel HTTP d'upload | `track.service.ts` | `http.post('/api/tracks', body)` |
| Récupération du `Blob` | `track.service.ts` | `audio()` : `http.get(..., { responseType: 'blob' })` |
| Création de l'`ObjectURL` | `tracks-page.ts` | `play()` : `URL.createObjectURL(blob)` |
| Affectation au lecteur | `tracks-page.html` | `<audio [src]="audioUrl()" controls autoplay>` |
| Révocation de l'ancienne URL | `tracks-page.ts` | `revokeAudioUrl()`, appelée avant chaque nouveau morceau, à la suppression et à la destruction du composant (`DestroyRef.onDestroy`) |
| Ajout du JWT | `shared/interceptors/auth.interceptor.ts` | `request.clone({ setHeaders: { Authorization: 'Bearer …' } })` |

### Les deux flux

```text
UPLOAD :  composant (choose + upload) → TrackService.upload() → FormData {audio, title}
          → HttpClient.post → authInterceptor (+ Bearer) → POST /api/tracks
          → auth → Multer (upload.single("audio")) → fichier sur disque + métadonnées MongoDB → 201 Track

LECTURE : clic ▶ → TrackService.audio(id) → HttpClient.get(responseType 'blob') → authInterceptor (+ Bearer)
          → GET /api/tracks/:id/audio → res.sendFile() → Blob reçu
          → URL.createObjectURL(blob) → "blob:http://localhost:4200/…" → <audio src>
```

### Pourquoi ne pas mettre directement l'URL de l'API dans `<audio src>` ?

Avec `<audio src="/api/tracks/ID/audio">`, c'est **le navigateur** qui fait la requête lui-même, **sans passer par HttpClient**, donc **sans l'intercepteur** : l'en-tête `Authorization: Bearer …` n'est pas ajouté et le backend répond **401**. On télécharge donc le fichier avec HttpClient (JWT ajouté), puis on donne au lecteur une adresse locale `blob:` qui ne nécessite aucune authentification.

### Contrôles du backend (`backend/src/app.js`)

- `allowed` : liste des types MIME acceptés (`audio/mpeg`, `audio/wav`, `audio/x-wav`, `audio/ogg`, `audio/mp4`, `audio/x-m4a`), vérifiée dans le `fileFilter` de Multer.
- `MAX_FILE_SIZE = 25 * 1024 * 1024` : `limits.fileSize` de Multer.
- `upload.single("audio")` : lit le champ multipart `audio` ; `req.body.title` lit le champ `title`.
- `if (!req.file)` → `400 Fichier audio requis` ; format refusé ou fichier trop gros → `400` via le gestionnaire d'erreurs central.

Le frontend construit bien le `FormData` avec **exactement** `audio` et `title` (vérifié dans Network, onglet Payload).

### Validation frontend vs backend

La validation frontend (`validate()` dans `tracks-page.ts`, mêmes règles que le backend) **améliore l'expérience** : message immédiat, bouton désactivé, et pas d'envoi inutile de plusieurs Mo vers le serveur. Mais elle **ne remplace jamais** la validation backend : le code du navigateur peut être modifié ou contourné (DevTools, Postman, curl…). Seul le serveur est une barrière de sécurité fiable.

### Interface pendant l'envoi

- État de chargement : bouton « Envoi en cours… » (Signal `uploading`).
- Bouton désactivé pendant l'envoi, sans fichier ou si le fichier est invalide → pas de double soumission.
- Erreurs du serveur affichées (`uploadError`, message renvoyé par l'API).
- Message de succès (« « Morceau 3 » a bien été ajouté. »).
- Formulaire vidé (titre + champ fichier) et rechargement de la page 1.

### Cards et lecture

- Chaque piste est une card (`<li class="track-card">`, grille responsive `auto-fill, minmax(260px, 1fr)`) : titre, nom original, format (badge MP3), taille lisible (3,4 Mo), date d'ajout, boutons Lire et Supprimer avec `aria-label`.
- Morceau en cours : « En cours : … » et card entourée.
- Erreur audio : événement `(error)` du lecteur → message compréhensible.
- Bonus : suppression avec confirmation (`DELETE /api/tracks/:id` → 204) puis rafraîchissement de la liste.

### Blob, buffering et streaming

- **Téléchargement complet d'un `Blob`** : HttpClient attend la fin du téléchargement ; tout le fichier est alors en mémoire dans le navigateur avant la lecture.
- **Buffering du navigateur** : quand `<audio>` lit une URL HTTP, le navigateur télécharge par morceaux et peut commencer à jouer avant la fin (mémoire tampon).
- **Streaming côté serveur** : le serveur envoie le fichier progressivement depuis le disque, sans le charger en entier en mémoire.

## Questions sur mémoire, buffering et streaming

**1. Le backend envoie-t-il le fichier entier en mémoire ou progressivement depuis le disque ?**
Progressivement. `res.sendFile()` (Express) lit le fichier sur le disque sous forme de flux et l'envoie par morceaux ; le serveur ne charge pas tout le fichier en mémoire. Il sait aussi répondre aux requêtes partielles (en-tête `Range`).

**2. Avec `HttpClient` et `responseType: "blob"`, quand le composant reçoit-il le fichier ?**
Une seule fois, **à la fin du téléchargement complet** : l'Observable émet le `Blob` entier dans `next`. Pour un fichier de 6 Mo, les 6 Mo sont en mémoire avant que la lecture puisse commencer.

**3. Avec 100 morceaux, les 100 fichiers audio sont-ils chargés dès l'affichage de la liste ?**
Non. `load()` appelle seulement `GET /api/tracks?page=…&limit=…`, qui renvoie des **métadonnées JSON** (titre, taille, date…), et seulement pour la page affichée (5 par défaut). Un fichier audio n'est téléchargé que lorsqu'on clique sur ▶ (`play(track)` → `service.audio(track.id)`), et un seul à la fois : l'URL du morceau précédent est révoquée.

**4. Quelle différence avec 100 éléments `<audio>` utilisant directement une URL HTTP ?**
Le navigateur gérerait lui-même le streaming et le buffering (lecture qui démarre avant la fin du téléchargement) et pourrait précharger chaque morceau, d'où jusqu'à 100 requêtes et beaucoup de trafic. Surtout, ces requêtes n'auraient pas l'en-tête `Authorization` : avec notre API protégée par JWT, elles recevraient toutes une erreur **401**.

**5. Pourquoi l'URL créée par `URL.createObjectURL` doit-elle être révoquée ?**
Tant que l'URL `blob:` existe, le navigateur garde le `Blob` (le fichier entier) en mémoire. Sans `URL.revokeObjectURL()`, chaque morceau écouté s'accumulerait : c'est une **fuite mémoire**. On révoque donc l'ancienne URL avant chaque nouveau morceau et à la destruction du composant.

## Checkpoint Network

| Vérification | Résultat |
|---|---|
| Chaque changement de page modifie `page` | `tracks?page=1&limit=2` puis `tracks?page=2&limit=2` |
| Upload multipart avec `audio` et `title` | Payload → Form data : `audio (binary)`, `title: Morceau 3` → 201 |
| Lecture = flux audio | `GET /api/tracks/:id/audio` → 200, `Content-Type: audio/mpeg` |
| Fichier invalide | bloqué dès le front (« Format non accepté »), aucune requête envoyée ; le backend renverrait 400 si on contournait le front |
| Lecture réservée au propriétaire | côté backend, `Track.findOne({ _id, ownerId: req.auth.sub })` → 404 pour une piste d'un autre utilisateur ; la liste est filtrée par `ownerId` |
| Suppression (bonus) | `DELETE /api/tracks/:id` → 204, liste rechargée |

![Validation front](captures/tp2-validation-front.PNG)

![Upload multipart](captures/tp2-upload.PNG)

![Pagination serveur](captures/tp2-pagination.PNG)

![Lecture audio authentifiée](captures/tp2-lecture-audio.PNG)

![Suppression](captures/tp2-suppression.PNG)