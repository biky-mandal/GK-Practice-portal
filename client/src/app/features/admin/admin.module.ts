import { CommonModule } from '@angular/common';
import { MathTextDirective } from '../../shared/math-text.directive';
import { MathToolsComponent } from '../../shared/math-tools.component';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';

import { AdminComponent } from './admin.component';
import { AdminCategoriesComponent } from './admin-categories.component';
import {
  AdminFlagsComponent,
  AdminMessagesComponent,
  AdminOverviewComponent,
  AdminPricingComponent,
  AdminPurchasesComponent,
  AdminReviewsComponent,
  AdminSettingsComponent,
  AdminShellComponent,
  AdminTestsComponent
} from './admin-pages';
import { AdminQuestionsComponent } from './admin-questions.component';
import { ReferenceImageUploadComponent } from './reference-image-upload.component';
import { AdminSimulationComponent } from './admin-simulation.component';
import { AdminUsersComponent } from './admin-users.component';
import { AdminPackagesComponent } from './admin-packages.component';
import { superAdminGuard } from '../../core/auth.guard';

const routes: Routes = [
  {
    path: '',
    component: AdminShellComponent,
    children: [
      { path: '', component: AdminOverviewComponent },
      { path: 'questions', component: AdminQuestionsComponent },
      { path: 'categories', component: AdminCategoriesComponent },
      { path: 'exams', component: AdminCategoriesComponent, data: { manageExams: true } },
      { path: 'upload', component: AdminComponent },
      { path: 'users', component: AdminUsersComponent },
      { path: 'purchases', component: AdminPurchasesComponent },
      { path: 'messages', component: AdminMessagesComponent },
      { path: 'flags', component: AdminFlagsComponent },
      { path: 'reviews', component: AdminReviewsComponent },
      { path: 'pricing', component: AdminPricingComponent },
      { path: 'packages', component: AdminPackagesComponent },
      { path: 'tests', component: AdminTestsComponent },
      { path: 'simulation', component: AdminSimulationComponent, canActivate: [superAdminGuard] },
      { path: 'simulation-shorts', component: AdminSimulationComponent, canActivate: [superAdminGuard], data: { portrait: true } },
      { path: 'settings', component: AdminSettingsComponent }
    ]
  }
];

@NgModule({
  declarations: [
    AdminComponent,
    AdminCategoriesComponent,
    AdminShellComponent,
    AdminOverviewComponent,
    AdminQuestionsComponent,
    AdminUsersComponent,
    AdminPurchasesComponent,
    AdminMessagesComponent,
    AdminFlagsComponent,
    AdminReviewsComponent,
    AdminPricingComponent,
    AdminPackagesComponent,
    AdminTestsComponent,
    AdminSimulationComponent,
    AdminSettingsComponent
  ],
  imports: [CommonModule,
    MathTextDirective, MathToolsComponent, ReferenceImageUploadComponent, FormsModule, RouterModule.forChild(routes), MatCardModule, MatButtonModule, MatSnackBarModule, MatDialogModule]
})
export class AdminModule {}
