import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  standalone: true,
  imports: [RouterLink],
  template: `
    <main>
      <h1>Page not found</h1>
      <p>The page you requested does not exist.</p>
      <a routerLink="/">Return to the home page</a>
    </main>
  `
})
export class NotFoundComponent {}
