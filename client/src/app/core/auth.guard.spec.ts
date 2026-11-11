import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';
import { routes } from '../app.routes';

@Component({ standalone: true, template: '' })
class TestPageComponent {}

describe('public dashboard and practice authentication', () => {
  let router: Router;
  let authenticated: boolean;

  beforeEach(() => {
    authenticated = false;
    TestBed.configureTestingModule({
      imports: [TestPageComponent, RouterTestingModule.withRoutes([
        { path: 'practice/gk', component: TestPageComponent, canActivate: [authGuard] },
        { path: 'login', component: TestPageComponent }
      ])],
      providers: [{ provide: AuthService, useValue: { isAuthenticated: () => authenticated } }]
    });
    router = TestBed.inject(Router);
  });

  it('does not require authentication to browse the dashboard', () => {
    expect(routes.find((route) => route.path === 'dashboard')?.canActivate).not.toContain(authGuard);
  });

  it('requires login and preserves the exact selected free attempt', async () => {
    const target = '/practice/gk?new=1&categories=Assam%20Polity&exam=police-forest';
    await router.navigateByUrl(target);
    const login = router.parseUrl(router.url);
    expect(login.root.children['primary'].segments.map((segment) => segment.path)).toEqual(['login']);
    expect(login.queryParams['returnUrl']).toBe(target);
  });

  it('allows authenticated learners to enter practice', async () => {
    authenticated = true;
    await router.navigateByUrl('/practice/gk?new=1&mock=1');
    expect(router.url).toBe('/practice/gk?new=1&mock=1');
  });
});
