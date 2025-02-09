import { injectLoad } from "@analogjs/router";
import { Component } from "@angular/core";
import { toSignal } from '@angular/core/rxjs-interop';

import type { load } from './countries.server';

@Component({
  selector: 'app-countries-page',
  template: `
    <h2>Countries</h2>

    @for(country of data().countries; track country) {
      {{ country.name }} <br />
    }
  `,
  styles: `
    form { 
      display: flex;
      padding: 4px;
      flex-direction: column;
    }
  `
})
export default class CountriesPage {
  data = toSignal(injectLoad<typeof load>(), { requireSync: true });
}
