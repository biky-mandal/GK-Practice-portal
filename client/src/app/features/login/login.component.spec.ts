import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/auth.service';
import { LoginComponent } from './login.component';

describe('login return destination', () => {
  const setup = async (returnUrl: string, role = 'user') => {
    await TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: [RouterTestingModule],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({ returnUrl }) } } },
        { provide: AuthService, useValue: { login: jasmine.createSpy('login').and.resolveTo({ role }) } },
        { provide: MatSnackBar, useValue: { open: jasmine.createSpy('open') } }
      ]
    }).overrideComponent(LoginComponent, { set: { template: '' } }).compileComponents();
    const router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
    const component = TestBed.createComponent(LoginComponent).componentInstance;
    component.form.patchValue({ email: 'learner@example.com', password: 'password' });
    await component.submit();
    return router;
  };

  it('returns a learner to the selected free attempt after login', async () => {
    const destination = '/practice/gk?new=1&mock=1';
    expect((await setup(destination)).navigateByUrl).toHaveBeenCalledWith(destination);
  });

  for (const destination of ['https://example.com', '//example.com', '/\\example.com']) {
    it(`rejects a non-local return destination: ${destination}`, async () => {
      expect((await setup(destination)).navigateByUrl).toHaveBeenCalledWith('/dashboard');
    });
  }

  it('keeps admins in the admin area', async () => {
    expect((await setup('/practice/gk?mock=1', 'admin')).navigateByUrl).toHaveBeenCalledWith('/admin');
  });
});
