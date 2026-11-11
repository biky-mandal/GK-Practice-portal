import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterModule, RouterStateSnapshot } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { superAdminGuard } from '../../core/auth.guard';
import { AdminApi } from './admin.api';
import { AdminShellComponent } from './admin-pages';

describe('Simulation superadmin access', () => {
  let auth: jasmine.SpyObj<AuthService>;

  beforeEach(async () => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['isSuperAdmin', 'isAdmin']);
    const api = jasmine.createSpyObj<AdminApi>('AdminApi', ['get']);
    api.get.and.resolveTo({ open: 0 });
    await TestBed.configureTestingModule({
      declarations: [AdminShellComponent],
      imports: [CommonModule, RouterModule.forRoot([])],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: AdminApi, useValue: api }
      ]
    }).compileComponents();
  });

  const activate = () => TestBed.runInInjectionContext(() =>
    superAdminGuard(new ActivatedRouteSnapshot(), { url: '/admin/simulation' } as RouterStateSnapshot));

  it('allows superadmins and displays the simulation navigation entry', () => {
    auth.isSuperAdmin.and.returnValue(true);
    auth.isAdmin.and.returnValue(true);
    expect(activate()).toBeTrue();
    const fixture = TestBed.createComponent(AdminShellComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/admin/simulation"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/admin/simulation-shorts"]')).not.toBeNull();
  });

  it('redirects regular admins to the admin overview and hides the simulation entry', () => {
    auth.isSuperAdmin.and.returnValue(false);
    auth.isAdmin.and.returnValue(true);
    expect(activate()).toEqual(TestBed.inject(Router).createUrlTree(['/admin']));
    const fixture = TestBed.createComponent(AdminShellComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/admin/simulation"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/admin/simulation-shorts"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/admin/questions"]')).not.toBeNull();
  });

  it('denies non-admin users access to the simulation page', () => {
    auth.isSuperAdmin.and.returnValue(false);
    auth.isAdmin.and.returnValue(false);
    expect(activate()).toEqual(TestBed.inject(Router).createUrlTree(['/dashboard']));
  });

  it('collapses to accessible icons and expands back to the full sidebar', () => {
    auth.isSuperAdmin.and.returnValue(true);
    const fixture = TestBed.createComponent(AdminShellComponent);
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const layout = element.querySelector<HTMLElement>('.layout')!;
    const toggle = element.querySelector<HTMLButtonElement>('.sidebar-toggle')!;
    const heading = element.querySelector<HTMLElement>('.sidebar-heading')!;
    const labels = Array.from(element.querySelectorAll<HTMLElement>('.menu-label'));
    const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('.menu a'));

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-controls')).toBe('admin-menu');
    expect(layout.classList.contains('sidebar-collapsed')).toBeFalse();
    expect(getComputedStyle(heading).display).not.toBe('none');

    toggle.click();
    fixture.detectChanges();

    expect(layout.classList.contains('sidebar-collapsed')).toBeTrue();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Expand sidebar');
    expect(getComputedStyle(heading).display).toBe('none');
    expect(element.querySelectorAll('.menu a').length).toBe(16);
    labels.forEach(label => expect(getComputedStyle(label).display).toBe('none'));
    links.forEach(link => {
      expect(link.getAttribute('aria-label')).toBeTruthy();
      expect(link.title).toBeTruthy();
      expect(link.getAttribute('href')).toBeTruthy();
      expect(getComputedStyle(link.querySelector('.ico')!).display).not.toBe('none');
    });

    toggle.click();
    fixture.detectChanges();

    expect(layout.classList.contains('sidebar-collapsed')).toBeFalse();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Collapse sidebar');
    labels.forEach(label => expect(getComputedStyle(label).display).not.toBe('none'));
  });

  it('hides the flag count in icon-only mode but keeps it in the accessible label', () => {
    const fixture = TestBed.createComponent(AdminShellComponent);
    fixture.detectChanges();
    fixture.componentInstance.api.openFlags = 3;
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    const flags = element.querySelector<HTMLAnchorElement>('a[href="/admin/flags"]')!;
    const count = flags.querySelector<HTMLElement>('.count')!;
    expect(count.textContent).toBe('3');
    expect(getComputedStyle(count).display).not.toBe('none');

    element.querySelector<HTMLButtonElement>('.sidebar-toggle')!.click();
    fixture.detectChanges();

    expect(getComputedStyle(count).display).toBe('none');
    expect(flags.getAttribute('aria-label')).toBe('Question flags: 3 open');
    expect(flags.title).toBe('Question flags: 3 open');

    element.querySelector<HTMLButtonElement>('.sidebar-toggle')!.click();
    fixture.detectChanges();
    expect(getComputedStyle(count).display).not.toBe('none');
  });

  it('keeps superadmin links hidden while collapsed for regular admins', () => {
    auth.isSuperAdmin.and.returnValue(false);
    const fixture = TestBed.createComponent(AdminShellComponent);
    fixture.componentInstance.sidebarCollapsed = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[href="/admin/simulation"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/admin/simulation-shorts"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/admin/questions"]')).not.toBeNull();
  });
});
