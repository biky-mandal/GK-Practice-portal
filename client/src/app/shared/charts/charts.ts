import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

export interface ChartSlice {
  label: string;
  value: number;
  color: string;
}

export interface ChartBar {
  label: string;
  value: number;
  color?: string;
  caption?: string;
}

const RADIUS = 38;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

@Component({
  selector: 'app-pie-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pie">
      <svg viewBox="0 0 100 100" role="img" [attr.aria-label]="title">
        <circle cx="50" cy="50" r="38" fill="none" stroke="#eef3f9" stroke-width="14" />
        <circle *ngFor="let s of segments" class="seg" cx="50" cy="50" r="38" fill="none" stroke-width="14" stroke-linecap="round"
          [attr.stroke]="s.color" [attr.stroke-dasharray]="s.dash + ' 400'"
          [attr.stroke-dashoffset]="s.offset" transform="rotate(-90 50 50)"><title>{{ s.label }}: {{ s.value }}</title></circle>
        <text x="50" y="49" text-anchor="middle" class="big">{{ total }}</text>
        <text x="50" y="61" text-anchor="middle" class="small">{{ centerLabel }}</text>
      </svg>
      <ul class="legend">
        <li *ngFor="let s of slices"><i [style.background]="s.color"></i>{{ s.label }}: <strong>{{ s.value }}</strong>
          <span class="pct">({{ total ? (s.value / total * 100 | number: '1.0-0') : 0 }}%)</span></li>
      </ul>
    </div>
  `,
  styles: [`
    .pie { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
    svg { width: 150px; height: 150px; flex: none; }
    .seg { transition: stroke-width 0.15s ease; cursor: pointer; }
    .seg:hover { stroke-width: 17; }
    .big { font-size: 16px; font-weight: 800; fill: #173b5b; }
    .small { font-size: 6px; fill: #6b8199; text-transform: uppercase; letter-spacing: 0.08em; }
    .legend { list-style: none; margin: 0; padding: 0; font-size: 0.88rem; color: #3d5670; }
    .legend li { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
    .legend i { width: 12px; height: 12px; border-radius: 4px; display: inline-block; }
    .pct { color: #6b8199; }
  `]
})
export class PieChartComponent {
  @Input() slices: ChartSlice[] = [];
  @Input() title = 'Chart';
  @Input() centerLabel = 'questions';

  readonly circumference = CIRCUMFERENCE;

  get total(): number {
    return this.slices.reduce((sum, slice) => sum + slice.value, 0);
  }

  get segments() {
    const total = this.total;
    if (!total) return [];
    const visible = this.slices.filter((slice) => slice.value > 0);
    const gap = visible.length > 1 ? 16 : 0;
    let used = 0;
    return visible.map((slice) => {
      const arc = (slice.value / total) * CIRCUMFERENCE;
      const segment = {
        color: slice.color,
        label: slice.label,
        value: slice.value,
        dash: Math.max(0.1, arc - gap),
        offset: -(used + gap / 2)
      };
      used += arc;
      return segment;
    });
  }
}

@Component({
  selector: 'app-line-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="!points.length" class="empty">No data yet.</div>
    <svg *ngIf="points.length" viewBox="0 0 320 170" class="line" role="img" [attr.aria-label]="title">
      <defs>
        <linearGradient [attr.id]="gid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#3a5fcd" stop-opacity="0.28" />
          <stop offset="100%" stop-color="#3a5fcd" stop-opacity="0" />
        </linearGradient>
      </defs>
      <g *ngFor="let t of ticks">
        <line [attr.x1]="left" x2="312" [attr.y1]="t.y" [attr.y2]="t.y" stroke="#e6edf5" stroke-dasharray="3 3" />
        <text x="26" [attr.y]="t.y + 3" text-anchor="end" class="tick">{{ t.value }}{{ unit }}</text>
      </g>
      <path [attr.d]="area" [attr.fill]="'url(#' + gid + ')'" />
      <path [attr.d]="path" fill="none" stroke="#3a5fcd" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      <g *ngFor="let p of points" class="pt">
        <circle [attr.cx]="p.x" [attr.cy]="p.y" r="4" fill="#fff" stroke="#3a5fcd" stroke-width="2.5"><title>{{ p.label }}: {{ p.value }}{{ unit }}</title></circle>
        <text [attr.x]="p.x" [attr.y]="p.y - 9" text-anchor="middle" class="val">{{ p.value }}{{ unit }}</text>
        <text [attr.x]="p.x" y="164" text-anchor="middle" class="tick">{{ p.short }}</text>
      </g>
    </svg>
  `,
  styles: [`
    .line { width: 100%; height: auto; display: block; }
    .tick { font-size: 8px; fill: #6b8199; }
    .val { font-size: 8px; font-weight: 700; fill: #173b5b; }
    .empty { color: #53657d; }
  `]
})
export class LineChartComponent {
  private static nextId = 0;
  @Input() bars: ChartBar[] = [];
  @Input() max = 100;
  @Input() unit = '%';
  @Input() title = 'Trend';

  readonly gid = `line-grad-${LineChartComponent.nextId++}`;
  readonly left = 32;
  private readonly top = 16;
  private readonly bottom = 140;

  private y(value: number): number {
    const ratio = this.max > 0 ? Math.min(1, Math.max(0, value / this.max)) : 0;
    return this.bottom - ratio * (this.bottom - this.top);
  }

  get ticks() {
    return [0, 50, 100].map((pct) => {
      const value = Math.round((this.max * pct) / 100);
      return { value, y: this.y(value) };
    });
  }

  get points() {
    const count = this.bars.length;
    const width = 312 - this.left - 16;
    return this.bars.map((bar, index) => ({
      label: bar.label,
      short: bar.label.replace('Test ', 'T'),
      value: bar.value,
      x: count === 1 ? this.left + width / 2 : this.left + 8 + (index * width) / (count - 1),
      y: this.y(bar.value)
    }));
  }

  get path(): string {
    return this.points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  }

  get area(): string {
    const pts = this.points;
    if (!pts.length) return '';
    return `${this.path} L${pts[pts.length - 1].x} ${this.bottom} L${pts[0].x} ${this.bottom} Z`;
  }
}

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="!bars.length" class="empty">No data yet.</div>
    <div *ngFor="let bar of bars" class="row">
      <div class="label" [title]="bar.label">{{ bar.label }}</div>
      <div class="track">
        <div class="fill" [style.width.%]="percent(bar.value)" [style.background]="bar.color || '#4b8bd6'"></div>
      </div>
      <div class="value">{{ bar.caption ?? bar.value + unit }}</div>
    </div>
  `,
  styles: [`
    .row { display: grid; grid-template-columns: 130px 1fr 48px; gap: 12px; align-items: center; margin: 12px 0; }
    .label { color: #3d5670; font-size: 0.88rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .track { background: #eef3f9; border-radius: 999px; height: 14px; overflow: hidden; }
    .fill { height: 100%; border-radius: 999px; min-width: 2px; transition: width 0.4s ease; }
    .value { font-weight: 700; color: #173b5b; font-size: 0.85rem; text-align: right; }
    .empty { color: #53657d; }
  `]
})
export class BarChartComponent {
  @Input() bars: ChartBar[] = [];
  @Input() max = 100;
  @Input() unit = '%';

  percent(value: number): number {
    return this.max > 0 ? Math.min(100, Math.max(0, (value / this.max) * 100)) : 0;
  }
}
