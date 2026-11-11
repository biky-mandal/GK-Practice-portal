import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AppComponent],
      imports: [RouterTestingModule, HttpClientTestingModule, MatButtonModule, MatMenuModule, NoopAnimationsModule]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render router outlet', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('only highlights the login button on the login page', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const header = (fixture.nativeElement as HTMLElement).querySelector('.header-actions')!;
    const login = header.querySelector<HTMLButtonElement>('.mode-btn')!;
    expect(header.textContent).not.toContain('Get started');
    expect(login.classList.contains('active')).toBeFalse();
    expect(login.hasAttribute('aria-current')).toBeFalse();

    fixture.componentInstance.onLoginPage.set(true);
    fixture.detectChanges();
    expect(login.classList.contains('active')).toBeTrue();
    expect(login.getAttribute('aria-current')).toBe('page');

    fixture.componentInstance.onLoginPage.set(false);
    fixture.detectChanges();
    expect(login.classList.contains('active')).toBeFalse();
  });
});
