import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { AdreComponent } from './adre.component';

const routes: Routes = [{ path: '', component: AdreComponent }];

@NgModule({
  declarations: [AdreComponent],
  imports: [CommonModule, RouterModule.forChild(routes), MatButtonModule]
})
export class AdreModule {}
