import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { BarChartComponent, LineChartComponent, PieChartComponent } from '../../shared/charts/charts';

import { DashboardComponent } from './dashboard.component';

const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'item/:pack', component: DashboardComponent }
];

@NgModule({
  declarations: [DashboardComponent],
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    MatCardModule,
    MatSnackBarModule,
    MatButtonModule,
    MatTableModule,
    MatProgressSpinnerModule,
    PieChartComponent,
    LineChartComponent,
    BarChartComponent  ]
})
export class DashboardModule {}
