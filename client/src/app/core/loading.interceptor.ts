import { Injectable, inject } from '@angular/core';
import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Observable, finalize } from 'rxjs';
import { LoadingService, SKIP_LOADING } from './loading.service';

@Injectable()
export class LoadingInterceptor implements HttpInterceptor {
  private readonly loading = inject(LoadingService);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (req.context.get(SKIP_LOADING)) return next.handle(req);
    this.loading.start();
    return next.handle(req).pipe(finalize(() => this.loading.stop()));
  }
}
