# Rapport d'usage de l'IA - TP1

Étudiante : Emili MERAHI

## Outil utilisé

- Assistant : Claude (Anthropic), utilisé comme guide pas à pas : il expliquait chaque étape et fournissait le code, que j'ai moi-même collé dans les fichiers, enregistré et testé dans le navigateur.
- Modèle : Claude Opus
- Consommation de tokens : non affichée dans l'interface utilisée.

## Préparation

- **Objectif** : configurer MongoDB Atlas, le fichier `backend/.env`, lancer le backend et le frontend.
- **Ce que j'ai fait** : réutilisation de mon cluster Atlas existant, réinitialisation du mot de passe de l'utilisateur de base, accès réseau `0.0.0.0/0`, construction de l'URI avec le nom de base `guitar-practice-cloud`.
- **Problèmes rencontrés** :
  - PowerShell bloquait `npm` (politique d'exécution des scripts) → passage au terminal Git Bash.
  - Dans `.env`, la clé `MONGODB_URI=` était écrite deux fois → corrigé.
  - La touche F12 éteint mon PC → ouverture des DevTools par clic droit → « Inspecter ».
- **Vérifications** : `GET /api/health` → `{"status":"ok"}` ; terminal backend : « Connecté à MongoDB Atlas » et « Compte de démonstration créé » ; upload et lecture de `song1.mp3` et `song2.mp3`.
- **Point de vigilance** : j'ai transmis par erreur le mot de passe de la base à l'assistant ; je dois le changer dans Atlas (Database Access → Edit Password) et mettre à jour `.env`.

## Mission 0 — Cartographie

- **Objectif** : repérer composant racine, routes, HttpClient, modèles/services/pages, intercepteur JWT.
- **Prompt principal** : « aide-moi à faire le TP1 étape par étape ».
- **Plan proposé par l'agent** : lire `main.ts`, puis `routes.ts`, puis `shared/` (services, intercepteur, guard), puis écrire la cartographie et le schéma du flux de connexion.
- **Vérifications** : j'ai ouvert chaque fichier cité ; j'ai testé la redirection d'une adresse inconnue vers `/tracks` (route `**`).
- **Résultat** : voir [TP1_REPONSES.md](TP1_REPONSES.md).

## Mission 1 — Inscription, connexion et profil

- **Objectif** : formulaires réactifs validés, appels register/login, stockage du JWT, Signal `currentUser`, redirections, déconnexion, profil, gestion du 401.
- **Plan proposé par l'agent** (une étape = un fichier, testée avant de passer à la suivante) :
  1. `shared/utils/http-error-message.ts` (nouveau) : transformer une erreur HTTP en message lisible.
  2. `AuthService` : ajout de `isAuthenticated` (`computed`) et redirection vers `/login` dans `logout()`.
  3. Page connexion : validations, messages d'erreur, bouton désactivé pendant l'envoi.
  4. En-tête (`app`) : nom de l'utilisateur + bouton « Se déconnecter », menu selon l'état connecté, profil rechargé après F5.
  5. Page inscription : validations alignées sur le backend (nom ≥ 2, email, mot de passe ≥ 8).
  6. Page profil : chargement automatique de `/api/users/me`, modification du nom, message de succès.
  7. `authInterceptor` : en cas de 401 sur une route protégée → déconnexion + `/login`.
- **Propositions écartées / points de vigilance** :
  - Le starter pré-remplissait `demo@example.com` / `Demo1234!` dans le code du formulaire : retiré (pas de mot de passe dans le code Angular).
  - Rediriger vers `/login` sur tous les 401 aurait empêché d'afficher « Identifiants incorrects » : exception pour `/api/auth/*`.
  - Les captures Network ne montrent ni le mot de passe (onglet Payload) ni le token (onglet Response du login, en-tête Authorization coupé).
- **Fichiers modifiés** (backend non modifié) :
  - `frontend-starter/src/app/shared/utils/http-error-message.ts` (nouveau)
  - `frontend-starter/src/app/shared/services/auth.service.ts`
  - `frontend-starter/src/app/shared/interceptors/auth.interceptor.ts`
  - `frontend-starter/src/app/components/app/app.ts` et `app.html`
  - `frontend-starter/src/app/components/login-page/login-page.ts` et `.html`
  - `frontend-starter/src/app/components/register-page/register-page.ts` et `.html`
  - `frontend-starter/src/app/components/profile-page/profile-page.ts` et `.html`
- **Tests réalisés** :
  - Connexion : champs vides → messages ; mauvais mot de passe → « Identifiants incorrects » (401) ; bon mot de passe → `/tracks`.
  - Déconnexion → `/login`, token supprimé du localStorage.
  - Inscription : mot de passe trop court → message ; `demo@example.com` → « Email déjà utilisé » (409) ; nouveau compte → `/profile`.
  - Profil : nom chargé automatiquement ; modification → « Nom mis à jour. » et nom changé dans l'en-tête.
  - Token remplacé par `abc` dans le localStorage + F5 → retour automatique sur `/login`.
- **Preuves** :
  - ![Connexion refusée](captures/tp1-login-401.PNG)
  - ![Connexion réussie](captures/tp1-login-200.PNG)
  - ![Profil](captures/tp1-users-me.PNG)
  - ![Authorization présent](captures/tp1-users-me-authorization.PNG)
- **Ce que je sais maintenant expliquer sans l'agent** :
  - le trajet d'une requête de connexion : composant → service → HttpClient → intercepteur → proxy → Express → MongoDB ;
  - le rôle de l'intercepteur (ajout du `Bearer` et gestion du 401) et du guard (protection des routes) ;
  - pourquoi `tap()` dans le service : mémoriser token et utilisateur sans bloquer la réponse ;
  - la différence entre Signal (réactif, en mémoire) et localStorage (persistant, non réactif) ;
  - pourquoi le composant ne fait jamais d'appel HTTP directement.