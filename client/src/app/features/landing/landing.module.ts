import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { LandingComponent } from './landing.component';

const routes: Routes = [{ path: '', component: LandingComponent }];

@NgModule({
  declarations: [LandingComponent],
  imports: [CommonModule, RouterModule.forChild(routes), MatButtonModule]
})
export class LandingModule {}
