import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';

/** Composant racine : en-tête, navigation et zone d'affichage des pages (router-outlet). */
@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent {
  readonly auth = inject(AuthService);

  constructor() {
    // Après un F5 : le token est relu depuis le localStorage, mais currentUser
    // repart à null. On recharge donc le profil pour réafficher le nom.
    if (this.auth.token() && !this.auth.currentUser()) {
      this.auth.profile().subscribe({
        next: (user) => console.debug('[App] Session restaurée', user.id),
        error: (error) => console.error('[App] Session non restaurée', error),
      });
    }
  }

  logout(): void {
    this.auth.logout();
  }
}