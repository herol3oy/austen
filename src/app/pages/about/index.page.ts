import { Component } from '@angular/core';

import { HeaderComponent } from '../../components/header/header.component';

@Component({
  standalone: true,
  imports: [HeaderComponent],
  templateUrl: './index.page.html',
})
export default class AboutPageComponent {}
