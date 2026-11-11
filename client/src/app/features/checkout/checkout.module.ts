import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { CheckoutComponent } from './checkout.component';

const routes: Routes = [{ path: '', component: CheckoutComponent }];

@NgModule({
  declarations: [CheckoutComponent],
  imports: [CommonModule, RouterModule.forChild(routes), MatButtonModule, MatSnackBarModule]
})
export class CheckoutModule {}
