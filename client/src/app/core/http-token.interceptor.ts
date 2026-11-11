import { Injectable, Injector } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable()
export class HttpTokenInterceptor implements HttpInterceptor {
  // AuthService is resolved lazily: it depends on HttpClient, which depends on this interceptor.
  constructor(private readonly injector: Injector) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const auth = this.injector.get(AuthService);
    if (!req.url.startsWith(auth.apiBase)) {
      return next.handle(req);
    }

    const withAuth = (request: HttpRequest<unknown>) => {
      const token = auth.getToken();
      return request.clone({
        withCredentials: true,
        setHeaders: { 'X-Requested-With': 'XMLHttpRequest', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
    };

    const isAuthCall = req.url.startsWith(`${auth.apiBase}/auth/`);

    return next.handle(withAuth(req)).pipe(
      catchError((error: unknown) => {
        // An expired access token is renewed once from the refresh cookie, then the request is retried.
        if (error instanceof HttpErrorResponse && error.status === 401 && !isAuthCall) {
          return from(auth.refreshSession()).pipe(
            switchMap((refreshed) => (refreshed ? next.handle(withAuth(req)) : throwError(() => error)))
          );
        }
        return throwError(() => error);
      })
    );
  }
}
