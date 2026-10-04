import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { httpErrorMessage } from '../../shared/utils/http-error-message';

/**
 * Page d'inscription.
 * Les validateurs reprennent les règles du backend :
 * nom ≥ 2 caractères, email valide, mot de passe ≥ 8 caractères.
 */
@Component({
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register-page.html',
  styleUrl: './register-page.css',
})
export class RegisterPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly error = signal('');
  readonly submitting = signal(false);

  readonly form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.error.set('');
    this.submitting.set(true);
    const { name, email, password } = this.form.getRawValue();

    this.auth.register(name.trim(), email, password).subscribe({
      next: () => {
        console.debug('[RegisterPage] Inscription réussie');
        this.submitting.set(false);
        void this.router.navigateByUrl('/profile');
      },
      error: (error: unknown) => {
        // 409 = email déjà utilisé, 400 = données invalides
        console.error('[RegisterPage] Échec de l’inscription', error);
        this.submitting.set(false);
        this.error.set(httpErrorMessage(error, 'Erreur d’inscription'));
      },
    });
  }
}