import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard, notAdminGuard } from './core/auth.guard';
import { NotFoundComponent } from './shared/not-found.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadChildren: () => import('./features/landing/landing.module').then((m) => m.LandingModule),
    data: {
      seo: {
        title: "ADRE Exam Preparation 2026 | Mock Tests & Assam GK | Let's Crack ADRE",
        description: "Prepare for the Assam Direct Recruitment Examination with practice questions, mock tests, Assam GK and exam-focused learning resources on Let's Crack ADRE.",
        canonicalPath: '/',
        indexable: true,
        structuredData: 'website'
      }
    },
    canActivate: [notAdminGuard]
  },
  {
    path: 'checkout/:pack',
    loadChildren: () => import('./features/checkout/checkout.module').then((m) => m.CheckoutModule),
    data: { seo: { title: "Checkout | Let's Crack ADRE", description: 'Complete your ADRE practice pack purchase.', indexable: false } },
    canActivate: [authGuard, notAdminGuard]
  },
  {
    path: 'adre',
    loadChildren: () => import('./features/adre/adre.module').then((m) => m.AdreModule),
    data: {
      seo: {
        title: "ADRE 3.0 Syllabus, Exam Pattern & Practice Pack | Let's Crack ADRE",
        description: "Explore ADRE 3.0 exam-pattern information, expected subject topics, 10 previous year (PYQ) papers and the three Practice Test Series from Let's Crack ADRE.",
        canonicalPath: '/adre',
        indexable: true
      }
    },
    canActivate: [notAdminGuard]
  },
  {
    path: 'assam-police-forest',
    loadComponent: () => import('./features/police-forest/police-forest.component').then((m) => m.PoliceForestComponent),
    data: { seo: {
      title: "Assam Police and Forest Practice Tests & 10 Mocks | Let's Crack ADRE",
      description: 'Explore Assam Police and Forest preparation: Constable subject-wise practice and 10 full-length mocks with 100 MCQs, 50 marks and no negative marking.',
      canonicalPath: '/assam-police-forest',
      indexable: true
    } },
    canActivate: [notAdminGuard]
  },
  {
    path: 'login',
    loadChildren: () => import('./features/login/login.module').then((m) => m.LoginModule),
    data: { seo: { title: "Log in or Register | Let's Crack ADRE", description: "Log in or create a Let's Crack ADRE account to access practice.", indexable: false } },
    canActivate: [guestGuard]
  },
  {
    path: 'privacy-policy',
    loadChildren: () => import('./features/legal/privacy-policy.module').then((m) => m.PrivacyPolicyModule),
    data: {
      seo: {
        title: "Privacy Policy | Let's Crack ADRE",
        description: "Learn what information Let's Crack ADRE collects, how it is used, and how to request account deletion.",
        canonicalPath: '/privacy-policy',
        indexable: true
      }
    }
  },
  {
    path: 'delete-account',
    loadChildren: () => import('./features/legal/delete-account.module').then((m) => m.DeleteAccountModule),
    data: {
      seo: {
        title: "Delete Your Account | Let's Crack ADRE",
        description: "Request deletion of your Let's Crack ADRE account and associated learning data.",
        canonicalPath: '/delete-account',
        indexable: true
      }
    }
  },
  {
    path: 'dashboard',
    loadChildren: () => import('./features/dashboard/dashboard.module').then((m) => m.DashboardModule),
    data: { seo: { title: "Dashboard | Let's Crack ADRE", description: 'Your personal practice dashboard.', indexable: false } },
    canActivate: [notAdminGuard]
  },
  {
    path: 'practice/gk',
    loadChildren: () => import('./features/practice/practice.module').then((m) => m.PracticeModule),
    data: { seo: { title: "GK Practice | Let's Crack ADRE", description: 'Private General Knowledge practice session.', indexable: false } },
    canActivate: [authGuard, notAdminGuard]
  },
  {
    path: 'result/:attemptId',
    loadChildren: () => import('./features/result/result.module').then((m) => m.ResultModule),
    data: { seo: { title: "Practice Result | Let's Crack ADRE", description: 'Private result for your practice attempt.', indexable: false } },
    canActivate: [authGuard, notAdminGuard]
  },
  {
    path: 'profile',
    loadChildren: () => import('./features/profile/profile.module').then((m) => m.ProfileModule),
    data: { seo: { title: "Profile | Let's Crack ADRE", description: 'Your private account profile.', indexable: false } },
    canActivate: [authGuard, notAdminGuard]
  },
  {
    path: 'admin',
    loadChildren: () => import('./features/admin/admin.module').then((m) => m.AdminModule),
    data: { seo: { title: "Administration | Let's Crack ADRE", description: 'Private administration area.', indexable: false } },
    canActivate: [authGuard, adminGuard]
  },
  {
    path: '**',
    component: NotFoundComponent,
    data: { seo: { title: "Page Not Found | Let's Crack ADRE", description: 'The requested page could not be found.', indexable: false } }
  }
];
