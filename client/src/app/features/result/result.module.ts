import { CommonModule } from '@angular/common';
import { MathTextDirective } from '../../shared/math-text.directive';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { BarChartComponent, PieChartComponent } from '../../shared/charts/charts';

import { ResultComponent } from './result.component';

const routes: Routes = [{ path: '', component: ResultComponent }];

@NgModule({
  declarations: [ResultComponent],
  imports: [
    CommonModule,
    MathTextDirective,
    RouterModule.forChild(routes),
    MatCardModule,
    MatButtonModule,
    PieChartComponent,
    BarChartComponent  ]
})
export class ResultModule {}
