import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

import { ProfileComponent } from './profile.component';

const routes: Routes = [{ path: '', component: ProfileComponent }];

@NgModule({
  declarations: [ProfileComponent],
  imports: [CommonModule, ReactiveFormsModule, RouterModule.forChild(routes), MatCardModule, MatButtonModule]
})
export class ProfileModule {}
