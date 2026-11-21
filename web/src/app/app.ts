import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Overlays } from './core/ui';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Overlays],
  template: `<router-outlet /><app-overlays />`,
})
export class App {}
