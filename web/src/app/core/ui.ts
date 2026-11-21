import { Component, Injectable, computed, input, signal } from '@angular/core';

const IC: Record<string, string> = {
  plane: 'M2 13l8-2 4-7h2l-1.5 7H21l1 2-7.5 1L16 21h-2l-4-6-8-2z', city: 'M3 21V9l6-3v15M9 21V3h8v18M17 21v-9h4v9M2 21h20M12 7h2M12 11h2M12 15h2',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z', road: 'M8 3 4 21M16 3l4 18M12 4v3M12 11v3M12 18v2', brief: 'M3 8h18v12H3zM8 8V5h8v3M3 13h18',
  group: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3 3-5 6-5s6 2 6 5M16 5a3 3 0 0 1 0 6M18 15c2 .5 3 2 3 5', shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  tag: 'M3 12V3h9l9 9-9 9zM7.5 7.5h.01', headset: 'M4 14v-2a8 8 0 0 1 16 0v2M4 14h3v5H4zM17 14h3v5h-3zM20 19c0 1.5-2 2-5 2', check: 'M5 12l4 4 10-10',
  pin: 'M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12zM12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  bag: 'M6 8h12v13H6zM9 8V4h6v4M9 12v5M15 12v5', swap: 'M7 4v16M7 4 3 8M7 4l4 4M17 20V4M17 20l-4-4M17 20l4-4', x: 'M6 6l12 12M18 6 6 18', menu: 'M4 7h16M4 12h16M4 17h16',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z', mail: 'M3 6h18v12H3zM3 7l9 6 9-6', chat: 'M4 5h16v11H8l-4 4z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z', list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', kan: 'M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z',
  car: 'M3 16v-4l2-5h14l2 5v4zM3 16h18v2H3zM7 18v2M17 18v2M6.5 13h.01M17.5 13h.01', id: 'M3 5h18v14H3zM8 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM5 16c0-2 1.5-3 3-3s3 1 3 3M14 9h4M14 13h4',
  money: 'M3 6h18v12H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 9v.01M18 15v.01', ticket: 'M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4zM14 7v10',
  doc: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h7', brush: 'M14 4l6 6-8 8H6v-6zM4 20h4', inbox: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 2h6l1-2h5',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12l2-1-1-3-2 .2-1.3-1.5.3-2-3-1-1 2h-2l-1-2-3 1 .3 2L6 7.2 4 7 3 10l2 1v2l-2 1 1 3 2-.2 1.3 1.5-.3 2 3 1 1-2h2l1 2 3-1-.3-2 1.3-1.5 2 .2 1-3-2-1z',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM6 15V9a4 4 0 0 1 4-4h4M18 9v6a4 4 0 0 1-4 4h-4', users: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c0-3 3-5 6-5s6 2 6 5M17 11a3 3 0 1 0 0-6M21 20c0-2.5-1.5-4.3-4-4.8',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14', logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
};

@Component({
  selector: 'app-icon',
  template: `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="d()" /></svg>`,
  styles: [':host{display:inline-flex}'],
})
export class Icon { name = input('check'); d = computed(() => IC[this.name()] || IC['check']); }

const BODY: Record<string, { b: string; w: string[] }> = {
  sedan: { b: 'M12 62Q12 51 26 49L60 46L80 31Q86 27 94 27L128 27Q138 27 146 35L160 47L182 51Q190 53 190 62L190 66Q190 70 186 70L16 70Q12 70 12 66Z', w: ['M85 32Q89 30 95 30L110 30L110 46L68 46Z', 'M115 30L128 30Q136 30 142 37L150 46L115 46Z'] },
  ev: { b: 'M12 62Q12 51 28 48L62 45L84 30Q90 26 98 26L126 26Q140 26 150 36L162 46L182 51Q190 54 190 62L190 66Q190 70 186 70L16 70Q12 70 12 66Z', w: ['M89 31Q93 29 99 29L112 29L112 45L70 45Z', 'M117 29L126 29Q138 29 146 38L152 45L117 45Z'] },
  lux: { b: 'M8 62Q8 52 22 50L66 47L88 31Q94 27 102 27L136 27Q146 27 154 35L166 47L186 51Q194 53 194 62L194 66Q194 70 190 70L12 70Q8 70 8 66Z', w: ['M93 32Q97 30 103 30L118 30L118 46L74 46Z', 'M123 30L136 30Q144 30 150 37L157 46L123 46Z'] },
  suv: { b: 'M12 64Q12 46 28 44L50 42L62 22Q65 18 72 18L150 18Q158 18 162 26L172 42L184 46Q190 48 190 58L190 66Q190 70 186 70L16 70Q12 70 12 66Z', w: ['M68 24L104 24L104 41L58 41Z', 'M109 24L150 24Q155 24 158 30L163 41L109 41Z'] },
  van: { b: 'M12 66L12 42Q12 36 18 34L40 23Q46 14 56 14L180 14Q190 14 190 24L190 66Q190 70 186 70L16 70Q12 70 12 66Z', w: ['M44 32L58 20L80 20L80 38L36 38Z', 'M86 20L130 20L130 38L86 38Z', 'M136 20L182 20L182 38L136 38Z'] },
  bus: { b: 'M10 66L10 26Q10 12 24 12L182 12Q192 12 192 22L192 66Q192 70 188 70L14 70Q10 70 10 66Z', w: ['M16 20L44 20L44 40L14 40L14 26Q14 20 16 20Z', 'M50 20L84 20L84 40L50 40Z', 'M90 20L124 20L124 40L90 40Z', 'M130 20L164 20L164 40L130 40Z', 'M170 20L186 20L186 40L170 40Z'] },
};

/** Side-view vehicle drawing, used in the fleet list and booking flow. */
@Component({
  selector: 'app-car',
  template: `<svg class="carsvg" viewBox="0 0 204 90" aria-hidden="true">
    <ellipse cx="101" cy="80" rx="94" ry="5" fill="#000" opacity=".16" />
    <path [attr.d]="shape().b" [attr.fill]="color()" />
    <path d="M18 56L186 58" stroke="#fff" stroke-opacity=".35" stroke-width="1.5" />
    @for (w of shape().w; track $index) { <path [attr.d]="w" fill="#cfe3f3" opacity=".92" /> }
    <path d="M184 56h6v5h-6z" fill="#ffe9a8" /><path d="M12 56h5v5h-5z" fill="#e5484d" />
    @for (x of wheels(); track $index) { <circle [attr.cx]="x" cy="70" r="13" fill="#1b1d21" /><circle [attr.cx]="x" cy="70" r="5.5" fill="#b8bcc3" /> }
  </svg>`,
  styles: [':host{display:block}svg{width:100%;height:auto;display:block}'],
})
export class Car {
  type = input('sedan'); color = input('#23262B');
  shape = computed(() => BODY[this.type()] || BODY['sedan']);
  wheels = computed(() => (this.type() === 'bus' ? [46, 160] : [52, 152]));
}

@Component({
  selector: 'app-badge',
  template: `<span class="badge" [class]="'badge s-' + value().replace(' ', '-')">{{ label() || value() }}</span>`,
})
export class Badge { value = input(''); label = input(''); }

@Component({
  selector: 'app-mark',
  template: `<span class="mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="18" r="2.2"/><circle cx="18" cy="6" r="2.2"/><path d="M6 15.5V10a4 4 0 0 1 4-4h5.5"/></svg></span>`,
})
export class Mark {}

/* ---------- toast + confirm ---------- */
@Injectable({ providedIn: 'root' })
export class Ui {
  readonly toastMsg = signal('');
  readonly confirmState = signal<{ title: string; message: string; yes: string; danger: boolean; resolve: (v: boolean) => void } | null>(null);
  private t: any;
  toast(m: string) { this.toastMsg.set(m); clearTimeout(this.t); this.t = setTimeout(() => this.toastMsg.set(''), 3000); }
  confirm(message: string, yes = 'Confirm', danger = true, title = 'Are you sure?'): Promise<boolean> {
    return new Promise((resolve) => this.confirmState.set({ title, message, yes, danger, resolve }));
  }
  answer(v: boolean) { const s = this.confirmState(); this.confirmState.set(null); s?.resolve(v); }
}

@Component({
  selector: 'app-overlays',
  template: `
    @if (ui.confirmState(); as c) {
      <div class="md" (click)="ui.answer(false)">
        <div class="md-c" role="alertdialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="md-h"><h3>{{ c.title }}</h3></div>
          <p>{{ c.message }}</p>
          <div class="md-f"><button class="btn ghost" (click)="ui.answer(false)">Cancel</button><button class="btn" [class.danger]="c.danger" [class.dark]="!c.danger" (click)="ui.answer(true)">{{ c.yes }}</button></div>
        </div>
      </div>
    }
    @if (ui.toastMsg()) { <div class="toast" role="status">{{ ui.toastMsg() }}</div> }
  `,
})
export class Overlays { constructor(public ui: Ui) {} }
