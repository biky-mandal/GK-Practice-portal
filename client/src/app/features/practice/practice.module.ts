import { CommonModule } from '@angular/common';
import { MathTextDirective } from '../../shared/math-text.directive';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { PracticeComponent } from './practice.component';

const routes: Routes = [{ path: '', component: PracticeComponent }];

@NgModule({
  declarations: [PracticeComponent],
  imports: [
    CommonModule,
    MathTextDirective,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    MatCardModule,
    MatButtonModule,
    MatRadioModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ]
})
export class PracticeModule {}
