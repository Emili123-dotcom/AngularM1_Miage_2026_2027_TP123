import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { httpErrorMessage } from '../../shared/utils/http-error-message';

/**
 * Page de connexion.
 * Le composant gère l'interface (formulaire, messages, redirection) ;
 * l'appel HTTP est délégué à AuthService.
 */
@Component({
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Message d'erreur renvoyé par l'API (ex. « Identifiants incorrects »). */
  readonly error = signal('');
  /** Vrai pendant la requête : désactive le bouton pour éviter un double clic. */
  readonly submitting = signal(false);

  /** Formulaire réactif : champs + validateurs déclarés en TypeScript. Aucun mot de passe dans le code. */
  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  submit(): void {
    // Formulaire invalide → on affiche les erreurs de tous les champs et on n'envoie rien.
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set('');
    this.submitting.set(true);
    const { email, password } = this.form.getRawValue();

    this.auth.login(email, password).subscribe({
      next: () => {
        console.debug('[LoginPage] Connexion réussie');
        this.submitting.set(false);
        void this.router.navigateByUrl('/tracks');
      },
      error: (error: unknown) => {
        console.error('[LoginPage] Échec de connexion', error);
        this.submitting.set(false);
        this.error.set(httpErrorMessage(error, 'Erreur de connexion'));
      },
    });
  }
}