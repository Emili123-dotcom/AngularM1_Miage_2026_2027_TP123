import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../shared/services/auth.service';
import { httpErrorMessage } from '../../shared/utils/http-error-message';

/**
 * Page « Mon profil ».
 * - À l'ouverture : GET /api/users/me (le JWT est ajouté par l'intercepteur).
 * - À l'enregistrement : PUT /api/users/me { name }.
 * Le template lit auth.currentUser() : quand le Signal change, l'affichage
 * se met à jour tout seul (ici ET dans l'en-tête).
 */
@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
})
export class ProfilePageComponent {
  readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
  });

  constructor() {
    // Le profil est chargé automatiquement dès qu'on ouvre la page.
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');

    this.auth.profile().subscribe({
      next: (user) => {
        console.debug('[ProfilePage] Profil chargé', user.id);
        this.loading.set(false);
        this.form.setValue({ name: user.name });
      },
      error: (error: unknown) => {
        console.error('[ProfilePage] Chargement impossible', error);
        this.loading.set(false);
        this.error.set(httpErrorMessage(error, 'Impossible de charger le profil'));
      },
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set('');
    this.success.set('');

    this.auth.update(this.form.getRawValue().name.trim()).subscribe({
      next: (user) => {
        console.debug('[ProfilePage] Profil enregistré', user.id);
        this.saving.set(false);
        this.success.set('Nom mis à jour.');
        this.form.markAsPristine();
      },
      error: (error: unknown) => {
        console.error('[ProfilePage] Enregistrement impossible', error);
        this.saving.set(false);
        this.error.set(httpErrorMessage(error, 'Impossible d’enregistrer le profil'));
      },
    });
  }
}