import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { DeleteAccountComponent } from './delete-account.component';

const routes: Routes = [{ path: '', component: DeleteAccountComponent }];

@NgModule({
  declarations: [DeleteAccountComponent],
  imports: [CommonModule, ReactiveFormsModule, RouterModule.forChild(routes)]
})
export class DeleteAccountModule {}
