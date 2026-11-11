import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { routes } from './app.routes';

@NgModule({
  imports: [RouterModule.forRoot(routes, { anchorScrolling: 'enabled', scrollOffset: [0, 76] })],
  exports: [RouterModule]
})
export class AppRoutingModule {}
