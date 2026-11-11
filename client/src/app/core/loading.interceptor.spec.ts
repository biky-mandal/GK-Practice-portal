import { TestBed } from '@angular/core/testing';
import { HTTP_INTERCEPTORS, HttpClient, HttpContext } from '@angular/common/http';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LoadingInterceptor } from './loading.interceptor';
import { LoadingService, SKIP_LOADING } from './loading.service';

describe('LoadingInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let loading: LoadingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [{ provide: HTTP_INTERCEPTORS, useClass: LoadingInterceptor, multi: true }]
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    loading = TestBed.inject(LoadingService);
  });

  it('stays active until every request has finished, including failures', () => {
    http.get('/api/a').subscribe();
    http.get('/api/b').subscribe({ error: () => undefined });
    expect(loading.active()).toBeTrue();
    backend.expectOne('/api/a').flush({});
    expect(loading.active()).toBeTrue();
    backend.expectOne('/api/b').flush('no', { status: 500, statusText: 'Server Error' });
    expect(loading.active()).toBeFalse();
  });

  it('stops counting a cancelled request', () => {
    const subscription = http.get('/api/slow').subscribe();
    expect(loading.active()).toBeTrue();
    subscription.unsubscribe();
    expect(loading.active()).toBeFalse();
  });

  it('ignores requests marked to skip the indicator', () => {
    http.get('/api/background', { context: new HttpContext().set(SKIP_LOADING, true) }).subscribe();
    expect(loading.active()).toBeFalse();
    backend.expectOne('/api/background').flush({});
  });

  it('tracks promise-based work', async () => {
    let finish!: () => void;
    const work = loading.track(new Promise<void>((resolve) => (finish = resolve)));
    expect(loading.active()).toBeTrue();
    finish();
    await work;
    expect(loading.active()).toBeFalse();
  });
});
