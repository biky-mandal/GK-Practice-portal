import { Component, OnInit, inject } from '@angular/core';
import { AdminApi, Page } from './admin.api';
import { ADMIN_STYLES } from './admin-styles';
import { AuthService } from '../../core/auth.service';

interface LineChart {
  title: string;
  max: number;
  days: string[];
  step: number;
  hover: number | null;
  hoverX: number;
  hoverPct: number;
  series: Array<{ label: string; values: number[]; color: string; ys: number[]; hidden: boolean; last: number; points: string; area: string }>;
}

interface PriceRow {
  pack: string;
  name: string;
  price: number;
  originalPrice?: number | null;
  enabled: boolean;
}

@Component({
  selector: 'app-admin-shell',
  template: `
    <div class="layout" [class.sidebar-collapsed]="sidebarCollapsed">
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-heading">
            <div class="eyebrow">Admin</div>
            <h1>Control Panel</h1>
          </div>
          <button type="button" class="sidebar-toggle" (click)="sidebarCollapsed = !sidebarCollapsed"
            [attr.aria-expanded]="!sidebarCollapsed" aria-controls="admin-menu"
            [attr.aria-label]="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
            [title]="sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path [attr.d]="sidebarCollapsed ? 'M9 6l6 6-6 6' : 'M15 6l-6 6 6 6'"></path>
            </svg>
          </button>
        </div>
        <nav id="admin-menu" class="menu" aria-label="Admin navigation">
          <a routerLink="/admin" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" aria-label="Overview" title="Overview"><span class="ico" aria-hidden="true">📊</span><span class="menu-label">Overview</span></a>
          <a routerLink="/admin/questions" routerLinkActive="active" aria-label="Questions" title="Questions"><span class="ico" aria-hidden="true">❓</span><span class="menu-label">Questions</span></a>
          <a routerLink="/admin/categories" routerLinkActive="active" aria-label="Subjects" title="Subjects"><span class="ico" aria-hidden="true">🗂️</span><span class="menu-label">Subjects</span></a>
          <a routerLink="/admin/exams" routerLinkActive="active" aria-label="Exams" title="Exams"><span class="ico" aria-hidden="true">E</span><span class="menu-label">Exams</span></a>
          <a routerLink="/admin/upload" routerLinkActive="active" aria-label="Upload" title="Upload"><span class="ico" aria-hidden="true">⬆️</span><span class="menu-label">Upload</span></a>
          <a routerLink="/admin/users" routerLinkActive="active" aria-label="Users" title="Users"><span class="ico" aria-hidden="true">👥</span><span class="menu-label">Users</span></a>
          <a routerLink="/admin/purchases" routerLinkActive="active" aria-label="Purchases" title="Purchases"><span class="ico" aria-hidden="true">💳</span><span class="menu-label">Purchases</span></a>
          <a routerLink="/admin/messages" routerLinkActive="active" aria-label="Messages" title="Messages"><span class="ico" aria-hidden="true">✉️</span><span class="menu-label">Messages</span></a>
          <a routerLink="/admin/flags" routerLinkActive="active" [attr.aria-label]="api.openFlags > 0 ? 'Question flags: ' + api.openFlags + ' open' : 'Question flags'" [title]="api.openFlags > 0 ? 'Question flags: ' + api.openFlags + ' open' : 'Question flags'"><span class="ico" aria-hidden="true">🚩</span><span class="menu-label">Question flags</span><span class="count" *ngIf="api.openFlags > 0">{{ api.openFlags }}</span></a>
          <a routerLink="/admin/reviews" routerLinkActive="active" aria-label="Reviews" title="Reviews"><span class="ico" aria-hidden="true">⭐</span><span class="menu-label">Reviews</span></a>
          <a routerLink="/admin/pricing" routerLinkActive="active" aria-label="Pricing" title="Pricing"><span class="ico" aria-hidden="true">🏷️</span><span class="menu-label">Pricing</span></a>
          <a routerLink="/admin/packages" routerLinkActive="active" aria-label="Packages" title="Packages"><span class="ico" aria-hidden="true">P</span><span class="menu-label">Packages</span></a>
          <a routerLink="/admin/tests" routerLinkActive="active" aria-label="Tests" title="Tests"><span class="ico" aria-hidden="true">📝</span><span class="menu-label">Tests</span></a>
          <a *ngIf="auth.isSuperAdmin()" routerLink="/admin/simulation" routerLinkActive="active" aria-label="Simulation" title="Simulation"><span class="ico" aria-hidden="true">⏱️</span><span class="menu-label">Simulation</span></a>
          <a *ngIf="auth.isSuperAdmin()" routerLink="/admin/simulation-shorts" routerLinkActive="active" aria-label="Shorts Simulation" title="Shorts Simulation"><span class="ico" aria-hidden="true">9:16</span><span class="menu-label">Shorts Simulation</span></a>
          <a routerLink="/admin/settings" routerLinkActive="active" aria-label="Settings" title="Settings"><span class="ico" aria-hidden="true">⚙️</span><span class="menu-label">Settings</span></a>
        </nav>
      </aside>
      <main class="content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; }
    .layout { display: grid; grid-template-columns: 260px minmax(0, 1fr); width: 100%; min-height: calc(100vh - 96px); }
    .sidebar { background: #fff; border-right: 1px solid #e1e8f0; padding: 32px 20px; position: sticky; top: 96px; align-self: start; height: calc(100vh - 96px); overflow-y: auto; }
    .sidebar-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 28px; }
    .sidebar-toggle { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 36px; width: 36px; height: 36px; padding: 0; border: 1px solid #e1e8f0; border-radius: 8px; background: #fff; color: #173b5b; cursor: pointer; }
    .sidebar-toggle:hover { background: #eef4fb; }
    .sidebar-toggle:focus-visible, .menu a:focus-visible { outline: 2px solid #4b72a4; outline-offset: 2px; }
    .eyebrow { color: #4b72a4; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 700; padding: 0 12px; }
    h1 { margin: 4px 0 0; padding: 0 12px; color: #12304d; font-size: 1.35rem; font-weight: 700; }
    .menu { display: flex; flex-direction: column; gap: 6px; }
    .menu a { display: flex; align-items: center; gap: 12px; text-decoration: none; padding: 12px 14px; border-radius: 8px; color: #3d5670; font-weight: 600; transition: background 0.15s ease; }
    .menu a:hover { background: #eef4fb; }
    .menu a.active { background: #173b5b; color: #fff; }
    .ico { width: 22px; flex: 0 0 22px; text-align: center; }
    .count { margin-left: auto; min-width: 22px; padding: 1px 7px; border-radius: 999px; background: #e5484d; color: #fff; font-size: 0.75rem; font-weight: 700; text-align: center; }
    .content { padding: 0 1rem 40px; min-width: 0; width: 100%; }
    @media (max-width: 860px) {
      .layout { grid-template-columns: 1fr; }
      .sidebar { position: static; height: auto; border-right: 0; border-bottom: 1px solid #e1e8f0; padding: 16px; }
      .menu { flex-direction: row; flex-wrap: wrap; }
      .content { padding: 0 1rem 24px; }
    }
    .layout.sidebar-collapsed { grid-template-columns: 76px minmax(0, 1fr); }
    .sidebar-collapsed .sidebar { position: sticky; top: 96px; height: calc(100vh - 96px); padding: 20px 10px; border-right: 1px solid #e1e8f0; border-bottom: 0; }
    .sidebar-collapsed .sidebar-header { justify-content: center; }
    .sidebar-collapsed .sidebar-heading, .sidebar-collapsed .menu-label, .sidebar-collapsed .count { display: none; }
    .sidebar-collapsed .menu { flex-direction: column; flex-wrap: nowrap; }
    .sidebar-collapsed .menu a { justify-content: center; padding: 12px 0; gap: 0; }
  `]
})
export class AdminShellComponent implements OnInit {
  readonly api = inject(AdminApi);
  readonly auth = inject(AuthService);
  sidebarCollapsed = false;

  ngOnInit() {
    this.api.get('/flags', { pageSize: 1, status: 'open' }).then((d) => (this.api.openFlags = d.open ?? 0)).catch(() => undefined);
  }
}

@Component({
  selector: 'app-admin-overview',
  template: `
    <div class="grid3" *ngIf="stats as s">
      <section class="panel">
        <header class="head blue"><div><div class="label">Users</div><div class="num">{{ s.users.total }}</div></div><span class="emoji">👥</span></header>
        <div class="body"><ng-container *ngTemplateOutlet="donut; context: { $implicit: userSlices(s) }"></ng-container></div>
      </section>
      <section class="panel">
        <header class="head teal"><div><div class="label">Test attempts</div><div class="num">{{ s.attempts.total }}</div></div><span class="emoji">📝</span></header>
        <div class="body">
          <ng-container *ngTemplateOutlet="donut; context: { $implicit: attemptSlices(s) }"></ng-container>
          <div class="sub">Started today</div>
          <ng-container *ngTemplateOutlet="bars; context: { $implicit: todaySlices(s) }"></ng-container>
        </div>
      </section>
      <section class="panel">
        <header class="head amber"><div><div class="label">Revenue</div><div class="num">₹{{ s.revenue.total }}</div></div><span class="emoji">💰</span></header>
        <div class="body">
          <div class="sub">{{ s.revenue.purchases }} purchases</div>
          <ng-container *ngTemplateOutlet="bars; context: { $implicit: revenueSlices(s) }"></ng-container>
        </div>
      </section>
    </div>

    <section class="panel wide" *ngIf="stats as s">
      <header class="head soft">
        <div><div class="label">Questions by category</div><div class="num">{{ s.questions.total }}</div></div>
        <div class="pills"><span class="pill ok">{{ s.questions.active }} active</span><span class="pill bad" *ngIf="s.questions.total - s.questions.active">{{ s.questions.total - s.questions.active }} inactive</span></div>
      </header>
      <div class="body">
        <div class="bar-row wide" *ngFor="let p of categoryBars(s)" [title]="p.label + ': ' + p.value">
          <span class="bar-label">{{ p.label }}</span>
          <span class="bar-track"><span class="bar-fill" [style.width.%]="p.pct" [style.background]="p.gradient"></span></span>
          <b>{{ p.value }}</b>
        </div>
        <p class="muted" *ngIf="!categoryBars(s).length">No categorised questions yet.</p>
      </div>
    </section>

    <div class="grid2" *ngIf="charts.length">
      <section class="panel" *ngFor="let c of charts">
        <header class="head plain"><div class="label dark">{{ c.title }}</div></header>
        <div class="body">
          <div class="wrap" (mouseleave)="c.hover = null">
            <svg viewBox="0 0 320 150" class="line" role="img" [attr.aria-label]="c.title" #svg (mousemove)="move($event, c, svg)" (touchmove)="move($event.touches[0], c, svg)">
              <line *ngFor="let g of [0, 1, 2, 3]" x1="0" x2="320" [attr.y1]="10 + g * 40" [attr.y2]="10 + g * 40" stroke="#e6edf5" stroke-width="1"></line>
              <ng-container *ngFor="let s of c.series">
                <ng-container *ngIf="!s.hidden">
                  <polygon [attr.points]="s.area" [attr.fill]="s.color" fill-opacity="0.12"></polygon>
                  <polyline [attr.points]="s.points" fill="none" [attr.stroke]="s.color" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></polyline>
                </ng-container>
              </ng-container>
              <ng-container *ngIf="c.hover !== null">
                <line [attr.x1]="c.hoverX" [attr.x2]="c.hoverX" y1="10" y2="130" stroke="#8aa4c8" stroke-dasharray="3 3"></line>
                <ng-container *ngFor="let s of c.series">
                  <circle *ngIf="!s.hidden" [attr.cx]="c.hoverX" [attr.cy]="s.ys[c.hover]" r="4" [attr.fill]="s.color" stroke="#fff" stroke-width="1.5"></circle>
                </ng-container>
              </ng-container>
            </svg>
            <div class="tip" *ngIf="c.hover !== null" [style.left.%]="c.hoverPct" [style.transform]="c.hoverPct > 70 ? 'translateX(-100%)' : c.hoverPct < 30 ? 'none' : 'translateX(-50%)'">
              <b>{{ c.days[c.hover] }}</b>
              <div *ngFor="let s of c.series"><ng-container *ngIf="!s.hidden"><i [style.background]="s.color"></i>{{ s.label }}: {{ s.values[c.hover] }}</ng-container></div>
            </div>
          </div>
          <div class="axis"><span>{{ c.days[0] | slice: 5 }}</span><span>max {{ c.max }}</span><span>{{ c.days[c.days.length - 1] | slice: 5 }}</span></div>
          <ul class="legend inline">
            <li *ngFor="let s of c.series" class="toggle" [class.off]="s.hidden" (click)="s.hidden = !s.hidden" title="Click to show or hide"><i [style.background]="s.color"></i>{{ s.label }}: <b>{{ s.last }}</b></li>
          </ul>
          <p class="muted" *ngIf="!c.series.length">No data yet.</p>
        </div>
      </section>
    </div>

    <ng-template #donut let-slices>
      <div class="chart">
        <svg viewBox="0 0 100 100" class="donut" role="img">
          <circle cx="50" cy="50" r="38" fill="none" stroke="#eef3f9" stroke-width="14"></circle>
          <ng-container *ngFor="let p of slices">
            <circle *ngIf="p.value > 0" class="seg" cx="50" cy="50" r="38" fill="none" stroke-width="14" stroke-linecap="round" transform="rotate(-90 50 50)"
              [attr.stroke]="p.color" [attr.stroke-dasharray]="p.len + ' 400'" [attr.stroke-dashoffset]="p.off"><title>{{ p.label }}: {{ p.value }}</title></circle>
          </ng-container>
          <text x="50" y="48" text-anchor="middle" class="d-num">{{ sum(slices) }}</text>
          <text x="50" y="61" text-anchor="middle" class="d-cap">total</text>
        </svg>
        <ul class="legend">
          <li *ngFor="let p of slices"><i [style.background]="p.color"></i>{{ p.label }}: <b>{{ p.value }}</b> <span class="muted">({{ p.pct | number: '1.0-0' }}%)</span></li>
        </ul>
      </div>
    </ng-template>
    <ng-template #bars let-slices>
      <div class="bar-row" *ngFor="let p of slices">
        <span class="bar-label">{{ p.label }}</span>
        <span class="bar-track"><span class="bar-fill" [style.width.%]="p.pct" [style.background]="p.gradient"></span></span>
        <b>{{ p.display ?? p.value }}</b>
      </div>
      <p class="muted" *ngIf="!slices.length">No data yet.</p>
    </ng-template>
    <p class="error" *ngIf="error">{{ error }}</p>
  `,
  styles: [ADMIN_STYLES, `
    .grid3 { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 20px; }
    .grid2 { display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: 20px; margin-bottom: 20px; }
    .panel { background: #fff; border: 1px solid #e1e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 2px 6px rgba(16, 42, 67, 0.06), 0 10px 28px rgba(16, 42, 67, 0.06); }
    .panel.wide { margin-bottom: 20px; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 18px 22px; color: #fff; }
    .head.blue { background: linear-gradient(135deg, #3a5fcd, #5b8def); }
    .head.teal { background: linear-gradient(135deg, #1f8a84, #45b6b0); }
    .head.amber { background: linear-gradient(135deg, #d98a14, #f2b84b); }
    .head.soft { background: #eef4fb; color: #173b5b; border-bottom: 1px solid #e1e8f0; }
    .head.soft .num { font-size: 1.8rem; }
    .head.plain { background: #f4f7fb; color: #173b5b; padding: 14px 22px; border-bottom: 1px solid #e6edf5; }
    .label { font-size: 0.8rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.9; }
    .label.dark { opacity: 1; color: #173b5b; font-size: 0.85rem; }
    .num { font-size: 2.2rem; font-weight: 800; line-height: 1.1; }
    .emoji { font-size: 2rem; background: rgba(255, 255, 255, 0.22); border-radius: 14px; width: 54px; height: 54px; display: inline-flex; align-items: center; justify-content: center; }
    .pills { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; align-self: center; }
    .pill { border-radius: 999px; padding: 2px 10px; font-size: 0.75rem; font-weight: 600; line-height: 1.5; background: #dcf5e6; color: #1f7a46; }
    .pill.bad { background: #fde4e4; color: #b3261e; }
    .bar-row.wide .bar-fill { background: #9dbbe6 !important; }
    .body { padding: 20px 22px 22px; }
    .sub { margin: 16px 0 8px; font-size: 0.75rem; font-weight: 700; color: #4b72a4; text-transform: uppercase; letter-spacing: 0.06em; }
    .chart { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; }
    .donut { width: 150px; height: 150px; flex: none; }
    .seg { transition: stroke-width 0.15s ease; cursor: pointer; }
    .seg:hover { stroke-width: 17; }
    .d-num { font-size: 16px; font-weight: 800; fill: #173b5b; }
    .d-cap { font-size: 6px; fill: #6b8199; text-transform: uppercase; letter-spacing: 0.08em; }
    .legend { list-style: none; margin: 0; padding: 0; font-size: 0.88rem; color: #3d5670; }
    .legend li { display: flex; align-items: center; gap: 8px; margin: 6px 0; }
    .legend i { width: 12px; height: 12px; border-radius: 4px; display: inline-block; }
    .legend.inline { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 10px; }
    .wrap { position: relative; }
    .line { width: 100%; height: auto; display: block; cursor: crosshair; }
    .tip { position: absolute; top: 4px; z-index: 2; pointer-events: none; background: #173b5b; color: #fff; padding: 8px 12px; border-radius: 10px; font-size: 0.78rem; white-space: nowrap; box-shadow: 0 6px 16px rgba(16, 42, 67, 0.3); }
    .tip i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }
    .toggle { cursor: pointer; user-select: none; padding: 2px 10px; border-radius: 999px; background: #f4f7fb; }
    .toggle.off { opacity: 0.4; text-decoration: line-through; }
    .axis { display: flex; justify-content: space-between; font-size: 0.75rem; color: #6b8199; margin-top: 4px; }
    .bar-row { display: grid; grid-template-columns: 110px 1fr auto; align-items: center; gap: 12px; margin: 10px 0; font-size: 0.88rem; color: #3d5670; }
    .bar-row.wide { grid-template-columns: 240px 1fr 48px; }
    .bar-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bar-track { background: #eef3f9; height: 14px; border-radius: 999px; display: block; overflow: hidden; }
    .bar-fill { display: block; height: 100%; min-width: 6px; border-radius: 999px; transition: width 0.4s ease; }
    @media (max-width: 640px) { .bar-row.wide { grid-template-columns: 120px 1fr 40px; } .grid2 { grid-template-columns: 1fr; } }
  `]
})
export class AdminOverviewComponent implements OnInit {
  private readonly api = inject(AdminApi);
  stats: any = null;
  charts: LineChart[] = [];
  error = '';

  async ngOnInit() {
    this.api.get('/stats/trends').then((t) => (this.charts = this.buildCharts(t))).catch(() => undefined);
    try {
      this.stats = await this.api.get('/stats');
    } catch (e) {
      this.error = this.api.message(e);
    }
  }

  // Each chart is scaled to its own maximum so every series stays visible.
  private buildCharts(t: any): LineChart[] {
    const palette = ['#3a5fcd', '#2a8576', '#7a4fc9', '#e8a64d', '#e5645f', '#4fb3e8', '#d96aa7', '#6f8aa6'];
    const make = (title: string, series: Array<{ label: string; values: number[]; color: string }>): LineChart => {
      const max = Math.max(1, ...series.flatMap((s) => s.values));
      const step = t.days.length > 1 ? 320 / (t.days.length - 1) : 0;
      return {
        title,
        max,
        days: t.days,
        step,
        hover: null,
        hoverX: 0,
        hoverPct: 0,
        series: series.map((s) => {
          const ys = s.values.map((v) => 130 - (v / max) * 120);
          return { ...s, ys, hidden: false, last: s.values[s.values.length - 1] ?? 0, points: ys.map((y, i) => `${(i * step).toFixed(1)},${y.toFixed(1)}`).join(' '), area: ys.length ? `0,130 ${ys.map((y, i) => `${(i * step).toFixed(1)},${y.toFixed(1)}`).join(' ')} ${((ys.length - 1) * step).toFixed(1)},130` : '' };
        })
      };
    };
    const adminTime: Array<{ name: string; minutes: number[] }> = t.adminTime ?? [];
    return [
      make('Users growth (last 30 days)', [{ label: 'Total users', values: t.newUsers, color: palette[0] }]),
      make('Revenue growth (₹, last 30 days)', [{ label: 'Total revenue', values: t.revenue, color: palette[1] }]),
      make('Learner activity (last 30 days)', [
        { label: 'Minutes practised', values: t.minutesSpent, color: palette[2] },
        { label: 'Active users', values: t.activeUsers, color: palette[3] },
        { label: 'Tests started', values: t.attempts, color: palette[4] }
      ]),
      make('Admin time on the portal (minutes per day)', adminTime.map((a, i) => ({ label: a.name, values: a.minutes, color: palette[i % palette.length] })))
    ];
  }

  move(event: { clientX: number }, chart: LineChart, svg: Element) {
    const rect = svg.getBoundingClientRect();
    if (!rect.width || chart.days.length < 1) return;
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const index = Math.round(fraction * (chart.days.length - 1));
    chart.hover = index;
    chart.hoverX = index * chart.step;
    chart.hoverPct = chart.days.length > 1 ? (index / (chart.days.length - 1)) * 100 : 0;
  }
  private build(items: Array<{ label: string; value: number; color: string; display?: string }>, relativeToMax = false) {
    const circumference = 2 * Math.PI * 38;
    const total = items.reduce((sum, item) => sum + item.value, 0);
    const max = Math.max(...items.map((item) => item.value), 0);
    const gap = !relativeToMax && items.filter((item) => item.value > 0).length > 1 ? 16 : 0;
    let start = 0;
    return items.map((item) => {
      const pct = relativeToMax ? (max ? (item.value / max) * 100 : 0) : total ? (item.value / total) * 100 : 0;
      const arc = (pct / 100) * circumference;
      const slice = {
        ...item,
        pct,
        start,
        len: Math.max(0.1, arc - gap),
        off: -(((start / 100) * circumference) + gap / 2),
        gradient: `linear-gradient(90deg, ${item.color}, ${item.color}cc)`
      };
      start += pct;
      return slice;
    });
  }

  sum(slices: Array<{ value: number }>) {
    return slices.reduce((total, slice) => total + slice.value, 0);
  }
  userSlices(s: any) {
    return this.build([
      { label: 'Admins', value: s.users.admins, color: '#7a4fc9' },
      { label: 'Paying', value: s.users.payers, color: '#2a8576' },
      { label: 'Free', value: s.users.guests, color: '#8aa4c8' }
    ]);
  }

  categoryBars(s: any) {
    const rows: Array<{ name: string; count: number }> = s.questions.byCategory ?? [];
    return this.build(rows.map((row, i) => ({ label: row.name, value: row.count, color: ['#3a5fcd', '#2a8576', '#7a4fc9', '#e8a64d', '#e5645f', '#4fb3e8', '#d96aa7', '#6f8aa6'][i % 8] })), true);
  }

  attemptSlices(s: any) {
    return this.build([
      { label: 'Completed', value: s.attempts.completed, color: '#2a8576' },
      { label: 'Not completed', value: s.attempts.total - s.attempts.completed, color: '#e8a64d' }
    ]);
  }

  todaySlices(s: any) {
    return this.build([{ label: 'Today', value: s.attempts.today, color: '#3a5fcd' }, { label: 'All time', value: s.attempts.total, color: '#8aa4c8' }], true);
  }

  revenueSlices(s: any) {
    const purchases = s.revenue.purchases;
    return this.build([
      { label: 'Revenue', value: s.revenue.total, color: '#2a8576', display: '₹' + s.revenue.total },
      { label: 'Avg / purchase', value: purchases ? Math.round(s.revenue.total / purchases) : 0, color: '#e8a64d', display: '₹' + (purchases ? Math.round(s.revenue.total / purchases) : 0) }
    ], true);
  }
}

@Component({
  selector: 'app-admin-pricing',
  template: `
    <div class="card">
      <h2>Test Series pricing</h2>
      <p class="muted">Offer price is what customers pay. Set an original price higher than the offer price to show it struck through with a discount badge; leave it empty for no offer. Disabled Test Series cannot be bought.</p>
      <div class="scroll">
        <table>
          <tr><th>Test Series</th><th>Original price (₹)</th><th>Offer price (₹)</th><th>On sale</th><th></th></tr>
          <tr *ngFor="let p of prices">
            <td>{{ p.name }}</td>
            <td><input type="number" min="0" max="100000" placeholder="None" [(ngModel)]="p.originalPrice" style="width: 120px" /></td>
            <td><input type="number" min="0" max="100000" [(ngModel)]="p.price" style="width: 120px" /></td>
            <td><input type="checkbox" [(ngModel)]="p.enabled" /></td>
            <td><button class="btn primary small" (click)="save(p)">Save</button></td>
          </tr>
        </table>
      </div>
      <p class="ok" *ngIf="saved">{{ saved }}</p>
      <p class="error" *ngIf="error">{{ error }}</p>
    </div>
  `,
  styles: [ADMIN_STYLES]
})
export class AdminPricingComponent implements OnInit {
  private readonly api = inject(AdminApi);
  prices: Array<PriceRow> = [];
  saved = '';
  error = '';
 
  async ngOnInit() {
    this.prices = await this.api.get('/pricing').catch(() => []);
  }
 
  async save(p: PriceRow) {
    this.saved = this.error = '';
    const original = p.originalPrice === null || p.originalPrice === undefined || (p.originalPrice as unknown) === '' ? null : Number(p.originalPrice);
    try {
      this.prices = await this.api.send('put', '/pricing', { pack: p.pack, price: Number(p.price), originalPrice: original, enabled: p.enabled });
      this.saved = 'Price saved.';
    } catch (e) {
      this.error = this.api.message(e, 'Could not save the price.');
    }
  }
}

@Component({
  selector: 'app-admin-purchases',
  template: `
    <div class="card">
      <h2>Purchases</h2>
      <p class="muted">Total revenue: <strong>₹{{ data?.revenue ?? 0 }}</strong> from {{ data?.total ?? 0 }} purchases and grants. Grants and revocations are done from the Users tab.</p>
      <p class="error" *ngIf="error">{{ error }}</p>
      <div class="scroll">
        <table>
          <tr><th>User</th><th>Test Series</th><th>Amount</th><th>Date</th></tr>
          <tr *ngFor="let row of data?.items">
            <td>{{ row.email || row.name || row.userId }}</td>
            <td>{{ packName(row.pack) }}</td>
            <td><span class="badge" [class.green]="row.amount > 0">{{ row.amount > 0 ? '₹' + row.amount : 'Granted' }}</span></td>
            <td>{{ row.purchasedAt | date: 'medium' }}</td>
          </tr>
        </table>
        <div class="empty" *ngIf="data && !data.items.length">No purchases yet.</div>
      </div>
      <div class="pager" *ngIf="data">
        <button class="btn small" [disabled]="page === 1" (click)="go(page - 1)">Previous</button>
        <span>Page {{ page }}</span>
        <button class="btn small" [disabled]="page * data.pageSize >= data.total" (click)="go(page + 1)">Next</button>
      </div>
    </div>
  `,
  styles: [ADMIN_STYLES]
})
export class AdminPurchasesComponent implements OnInit {
  packs: Array<{ pack: string; name: string }> = [];
  error = '';
  packName(id: string) {
    return this.packs.find((plan) => plan.pack === id)?.name ?? id;
  }

  private readonly api = inject(AdminApi);
  data: (Page<any> & { revenue: number }) | null = null;
  page = 1;

  ngOnInit() {
    this.api.get<Array<{ pack: string; name: string }>>('/packages').then((rows) => { this.packs = rows; })
      .catch((error) => { this.error = this.api.message(error); });
    this.go(1);
  }

  async go(page: number) {
    this.page = page;
    this.data = await this.api.get('/purchases', { page }).catch(() => null);
  }
}

@Component({
  selector: 'app-admin-messages',
  template: `
    <div class="card">
      <div class="head-row">
        <div>
          <h2>Contact messages</h2>
          <p class="muted">Messages sent from the website contact form.</p>
        </div>
        <div class="pills">
          <span class="pill">{{ data?.total ?? 0 }} total</span>
          <span class="pill amber" *ngIf="data?.unread">{{ data?.unread }} unread</span>
        </div>
      </div>
      <div class="list">
        <article class="msg" *ngFor="let m of data?.items" [class.unread]="!m.read">
          <span class="avatar">{{ initial(m.name) }}</span>
          <div class="msg-main">
            <div class="msg-top">
              <strong>{{ m.name }}</strong>
              <a [href]="'mailto:' + m.email">{{ m.email }}</a>
              <span class="dot" *ngIf="!m.read" title="Unread"></span>
              <time>{{ m.createdAt | date: 'd MMM y, h:mm a' }}</time>
            </div>
            <p class="msg-text">{{ m.message }}</p>
          </div>
          <div class="msg-actions">
            <button type="button" class="ib" [attr.aria-label]="m.read ? 'Mark as unread' : 'Mark as read'" [attr.title]="m.read ? 'Mark as unread' : 'Mark as read'" (click)="toggle(m)">
              <svg *ngIf="!m.read" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5L20 7"></path></svg>
              <svg *ngIf="m.read" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3 7 9 6 9-6"></path></svg>
            </button>
            <button type="button" class="ib danger" aria-label="Delete message" title="Delete message" (click)="remove(m)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 14H6L5 6"></path><path d="M10 11v5M14 11v5"></path></svg>
            </button>
          </div>
        </article>
        <div class="empty" *ngIf="data && !data.items.length">No messages yet.</div>
      </div>
      <div class="pager" *ngIf="data">
        <button class="btn small" [disabled]="page === 1" (click)="go(page - 1)">Previous</button>
        <span>Page {{ page }}</span>
        <button class="btn small" [disabled]="page * data.pageSize >= data.total" (click)="go(page + 1)">Next</button>
      </div>
      <p class="error" *ngIf="error">{{ error }}</p>
    </div>
  `,
  styles: [ADMIN_STYLES, `
    .head-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
    .head-row h2 { margin-bottom: 4px; }
    .head-row p { margin: 0 0 16px; }
    .pills { display: flex; gap: 8px; }
    .pill { border-radius: 999px; padding: 3px 12px; font-size: 0.78rem; font-weight: 600; background: #eef4fb; color: #173b5b; }
    .pill.amber { background: #fff1d6; color: #8a5a00; }
    .list { display: flex; flex-direction: column; gap: 12px; }
    .msg { display: flex; gap: 14px; align-items: flex-start; padding: 16px; border: 1px solid #e1e8f0; border-radius: 14px; background: #fff; }
    .msg.unread { background: #f3f8ff; border-color: #bcd3f2; }
    .avatar { flex: none; width: 42px; height: 42px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #3a5fcd, #5b8def); color: #fff; font-weight: 700; }
    .msg-main { flex: 1; min-width: 0; }
    .msg-top { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }
    .msg-top a { color: #3a5fcd; font-size: 0.85rem; text-decoration: none; }
    .msg-top time { margin-left: auto; color: #6b8199; font-size: 0.78rem; }
    .dot { width: 9px; height: 9px; border-radius: 50%; background: #e5484d; }
    .msg.unread strong { font-weight: 800; }
    .msg-text { margin: 6px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; color: #35506b; }
    .msg-actions { display: flex; gap: 8px; flex: none; }
    .ib { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 1px solid #d3deea; border-radius: 10px; background: #fff; color: #173b5b; cursor: pointer; }
    .ib:hover { background: #eef4fb; }
    .ib.danger { color: #b9332e; }
    .ib.danger:hover { background: #fdeceb; }
    .ib svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    @media (max-width: 640px) { .msg { flex-wrap: wrap; } .msg-actions { margin-left: auto; } }
  `]
})
export class AdminMessagesComponent implements OnInit {
  private readonly api = inject(AdminApi);
  data: (Page<any> & { unread: number }) | null = null;
  page = 1;
  error = '';

  ngOnInit() {
    this.go(1);
  }

  initial(name: string) {
    return (name?.trim()[0] ?? '?').toUpperCase();
  }

  async go(page: number) {
    this.page = page;
    this.data = await this.api.get('/messages', { page }).catch(() => null);
  }

  async toggle(m: any) {
    try {
      await this.api.send('patch', `/messages/${m.id}`, { read: !m.read });
      await this.go(this.page);
    } catch (e) {
      this.error = this.api.message(e);
    }
  }

  async remove(m: any) {
    if (!confirm('Delete this message?')) return;
    try {
      await this.api.send('delete', `/messages/${m.id}`);
      await this.go(this.page);
    } catch (e) {
      this.error = this.api.message(e);
    }
  }
}

@Component({
  selector: 'app-admin-flags',
  template: `
    <div class="card">
      <div class="head-row">
        <div>
          <h2>Question flags</h2>
          <p class="muted">Problems reported by learners while practising.</p>
        </div>
        <div class="chips">
          <button type="button" class="chip" *ngFor="let f of filters" [class.on]="status === f.value" (click)="setStatus(f.value)">
            {{ f.label }}<span *ngIf="f.value === 'open' && data?.open"> ({{ data?.open }})</span>
          </button>
        </div>
      </div>
      <div class="list">
        <article class="flag" *ngFor="let f of data?.items" [class.done]="f.status !== 'open'">
          <div class="flag-top">
            <span class="reason">{{ reasonLabel(f.reason) }}</span>
            <span class="state" *ngIf="f.status !== 'open'">{{ f.status === 'resolved' ? 'Resolved' : 'Dismissed' }}</span>
            <time>{{ f.createdAt | date: 'd MMM y, h:mm a' }}</time>
          </div>
          <div class="q" *ngIf="f.question; else gone">
            <div class="q-meta">{{ f.question.subject }}<span *ngIf="f.question.topic"> · {{ f.question.topic }}</span></div>
            <p class="q-text">{{ f.question.text }}</p>
            <ol class="opts" type="A"><li *ngFor="let o of f.question.options">{{ o }}</li></ol>
          </div>
          <ng-template #gone><p class="muted">This question no longer exists.</p></ng-template>
          <p class="note" *ngIf="f.note">“{{ f.note }}”</p>
          <div class="flag-foot">
            <span class="muted">Reported by {{ f.reporter }}</span>
            <div class="acts">
              <button class="btn small" *ngIf="f.status === 'open'" (click)="set(f, 'resolved')">Mark resolved</button>
              <button class="btn small" *ngIf="f.status === 'open'" (click)="set(f, 'dismissed')">Dismiss</button>
              <button class="btn small" *ngIf="f.status !== 'open'" (click)="set(f, 'open')">Reopen</button>
              <button class="btn small danger" (click)="remove(f)">Delete</button>
            </div>
          </div>
        </article>
        <div class="empty" *ngIf="data && !data.items.length">No flags here.</div>
      </div>
      <div class="pager" *ngIf="data">
        <button class="btn small" [disabled]="page === 1" (click)="go(page - 1)">Previous</button>
        <span>Page {{ page }}</span>
        <button class="btn small" [disabled]="page * data.pageSize >= data.total" (click)="go(page + 1)">Next</button>
      </div>
      <p class="error" *ngIf="error">{{ error }}</p>
    </div>
  `,
  styles: [ADMIN_STYLES, `
    .head-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
    .head-row h2 { margin-bottom: 4px; }
    .head-row p { margin: 0 0 16px; }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .chip { border: 1px solid #d3deea; background: #fff; color: #3d5670; border-radius: 999px; padding: 5px 14px; font-weight: 600; cursor: pointer; }
    .chip.on { background: #173b5b; border-color: #173b5b; color: #fff; }
    .list { display: flex; flex-direction: column; gap: 12px; }
    .flag { padding: 16px; border: 1px solid #f1d6a8; background: #fffaf0; border-radius: 14px; }
    .flag.done { border-color: #e1e8f0; background: #fff; }
    .flag-top { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
    .reason { background: #fff1d6; color: #8a5a00; border-radius: 999px; padding: 3px 12px; font-size: 0.78rem; font-weight: 700; }
    .state { background: #e6f4ea; color: #1e6b3a; border-radius: 999px; padding: 3px 12px; font-size: 0.78rem; font-weight: 600; }
    .flag-top time { margin-left: auto; color: #6b8199; font-size: 0.78rem; }
    .q { margin-top: 10px; }
    .q-meta { color: #6b8199; font-size: 0.78rem; }
    .q-text { margin: 4px 0; font-weight: 600; color: #12304d; overflow-wrap: anywhere; }
    .opts { margin: 4px 0 0; padding-left: 22px; color: #35506b; font-size: 0.9rem; }
    .note { margin: 10px 0 0; padding: 8px 12px; background: #fff; border-left: 3px solid #e0a23a; border-radius: 6px; color: #35506b; white-space: pre-wrap; overflow-wrap: anywhere; }
    .flag-foot { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
    .acts { display: flex; gap: 8px; flex-wrap: wrap; }
  `]
})
export class AdminFlagsComponent implements OnInit {
  private readonly api = inject(AdminApi);
  data: (Page<any> & { open: number }) | null = null;
  page = 1;
  status = 'open';
  error = '';
  readonly filters = [
    { value: 'open', label: 'Open' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'dismissed', label: 'Dismissed' },
    { value: '', label: 'All' }
  ];
  private readonly reasons: Record<string, string> = {
    wrong_answer: 'Answer looks wrong',
    unclear_question: 'Question is unclear',
    typo: 'Spelling mistake',
    translation: 'Translation problem',
    other: 'Something else'
  };

  ngOnInit() {
    this.go(1);
  }

  reasonLabel(reason: string) {
    return this.reasons[reason] ?? reason;
  }

  setStatus(value: string) {
    this.status = value;
    this.go(1);
  }

  async go(page: number) {
    this.page = page;
    this.data = await this.api.get('/flags', { page, status: this.status }).catch(() => null);
    if (this.data) this.api.openFlags = this.data.open;
  }

  async set(f: any, status: string) {
    try {
      await this.api.send('patch', `/flags/${f.id}`, { status });
      await this.go(this.page);
    } catch (e) {
      this.error = this.api.message(e);
    }
  }

  async remove(f: any) {
    if (!confirm('Delete this flag?')) return;
    try {
      await this.api.send('delete', `/flags/${f.id}`);
      await this.go(this.page);
    } catch (e) {
      this.error = this.api.message(e);
    }
  }
}

@Component({
  selector: 'app-admin-reviews',
  template: `
    <div class="card">
      <h2>Test Series reviews</h2>
      <p class="muted">Ratings and comments from learners who bought a Test Series.</p>
      <div class="sum">
        <div class="sum-card" *ngFor="let p of packs">
          <div class="muted">{{ p.name }}</div>
          <strong>★ {{ summaryOf(p.id)?.average ?? '–' }}</strong>
          <span class="muted">{{ summaryOf(p.id)?.count ?? 0 }} reviews</span>
        </div>
      </div>
      <div class="chips">
        <button type="button" class="chip" *ngFor="let f of filters" [class.on]="pack === f.value" (click)="setPack(f.value)">{{ f.label }}</button>
      </div>
      <div class="list">
        <article class="rv" *ngFor="let r of data?.items">
          <div class="rv-top">
            <strong>{{ r.reviewer }}</strong>
            <span class="muted" *ngIf="r.email">{{ r.email }}</span>
            <span class="tag">{{ packName(r.pack) }}</span>
            <time>{{ r.createdAt | date: 'd MMM y, h:mm a' }}</time>
          </div>
          <div class="stars">{{ '★'.repeat(r.rating) }}<span class="off">{{ '★'.repeat(5 - r.rating) }}</span></div>
          <p class="text" *ngIf="r.comment">{{ r.comment }}</p>
          <button class="btn small danger" (click)="remove(r)">Delete</button>
        </article>
        <div class="empty" *ngIf="data && !data.items.length">No reviews yet.</div>
      </div>
      <div class="pager" *ngIf="data">
        <button class="btn small" [disabled]="page === 1" (click)="go(page - 1)">Previous</button>
        <span>Page {{ page }}</span>
        <button class="btn small" [disabled]="page * data.pageSize >= data.total" (click)="go(page + 1)">Next</button>
      </div>
      <p class="error" *ngIf="error">{{ error }}</p>
    </div>
  `,
  styles: [ADMIN_STYLES, `
    .sum { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 14px 0; }
    .sum-card { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border: 1px solid #e1e8f0; border-radius: 12px; background: #f8fafd; }
    .sum-card strong { font-size: 1.3rem; color: #12304d; }
    .chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
    .chip { border: 1px solid #d3deea; background: #fff; color: #3d5670; border-radius: 999px; padding: 5px 14px; font-weight: 600; cursor: pointer; }
    .chip.on { background: #173b5b; border-color: #173b5b; color: #fff; }
    .list { display: flex; flex-direction: column; gap: 12px; }
    .rv { padding: 14px 16px; border: 1px solid #e1e8f0; border-radius: 14px; background: #fff; }
    .rv-top { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }
    .rv-top time { margin-left: auto; color: #6b8199; font-size: 0.78rem; }
    .tag { background: #eef4fb; color: #173b5b; border-radius: 999px; padding: 2px 10px; font-size: 0.75rem; font-weight: 600; }
    .stars { color: #f5a623; letter-spacing: 2px; margin: 6px 0; }
    .stars .off { color: #d3deea; }
    .text { margin: 0 0 10px; color: #35506b; white-space: pre-wrap; overflow-wrap: anywhere; }
  `]
})
export class AdminReviewsComponent implements OnInit {
  private readonly api = inject(AdminApi);
  data: (Page<any> & { summary: Array<{ pack: string; average: number; count: number }> }) | null = null;
  page = 1;
  pack = '';
  error = '';
  packs: Array<{ id: string; name: string }> = [];
  get filters() { return [{ value: '', label: 'All' }, ...this.packs.map((p) => ({ value: p.id, label: p.name }))]; }

  ngOnInit() {
    this.api.get<Array<{ pack: string; name: string }>>('/packages')
      .then((rows) => { this.packs = rows.map((row) => ({ id: row.pack, name: row.name })); })
      .catch((error) => { this.error = this.api.message(error); });
    this.go(1);
  }

  packName(id: string) {
    return this.packs.find((p) => p.id === id)?.name ?? id;
  }

  summaryOf(id: string) {
    return this.data?.summary.find((s) => s.pack === id);
  }

  setPack(value: string) {
    this.pack = value;
    this.go(1);
  }

  async go(page: number) {
    this.page = page;
    this.data = await this.api.get('/reviews', { page, pack: this.pack }).catch(() => null);
  }

  async remove(r: any) {
    if (!confirm('Delete this review?')) return;
    try {
      await this.api.send('delete', `/reviews/${r.id}`);
      await this.go(this.page);
    } catch (e) {
      this.error = this.api.message(e);
    }
  }
}

@Component({
  selector: 'app-admin-tests',
  template: `
    <div class="card">
      <h2>Recent tests</h2>
      <div class="scroll">
        <table>
          <tr><th>User</th><th>Type</th><th>Status</th><th>Questions</th><th>Score</th><th>Started</th></tr>
          <tr *ngFor="let a of data?.items">
            <td>{{ a.user }}</td>
            <td>{{ a.kind === 'daily_free' ? 'Daily free' : a.mock ? 'Mock ' + a.mock : a.pyq ? 'PYQ ' + a.pyq : 'Subject practice' }}</td>
            <td><span class="badge" [class.green]="a.status === 'submitted'" [class.amber]="a.status === 'in_progress'">{{ a.status }}</span></td>
            <td>{{ a.questions }}</td>
            <td>{{ a.percentage !== null ? a.percentage + '%' : '-' }}</td>
            <td>{{ a.startedAt | date: 'short' }}</td>
          </tr>
        </table>
        <div class="empty" *ngIf="data && !data.items.length">No tests yet.</div>
      </div>
      <div class="pager" *ngIf="data">
        <button class="btn small" [disabled]="page === 1" (click)="go(page - 1)">Previous</button>
        <span>Page {{ page }}</span>
        <button class="btn small" [disabled]="page * data.pageSize >= data.total" (click)="go(page + 1)">Next</button>
      </div>
    </div>
  `,
  styles: [ADMIN_STYLES]
})
export class AdminTestsComponent implements OnInit {
  private readonly api = inject(AdminApi);
  data: Page<any> | null = null;
  page = 1;

  ngOnInit() {
    this.go(1);
  }

  async go(page: number) {
    this.page = page;
    this.data = await this.api.get('/attempts', { page }).catch(() => null);
  }
}

@Component({
  selector: 'app-admin-settings',
  template: `
    <div class="card" *ngIf="form">
      <h2>Test settings</h2>
      <div class="grid">
        <label class="field">Daily free test questions
          <input type="number" min="1" max="50" [(ngModel)]="form.dailyFreeQuestionCount" />
        </label>
        <label class="field">Seconds per question
          <input type="number" min="10" max="600" [(ngModel)]="form.secondsPerQuestion" />
        </label>
      </div>
      <p class="muted">The total time of a test is questions x seconds per question. Changes apply to tests started afterwards.</p>
      <label class="field">Free subject (subject-wise practice)
        <select [(ngModel)]="form.freeSubjectCategory">
          <option value="">None - no free subject</option>
          <option *ngFor="let name of categoryNames" [value]="name">{{ name }}</option>
        </select>
      </label>
      <p class="muted">Logged-in users can practise this one subject without buying Subject Wise Practice (ADRE and Police/Forest).</p>
      <button class="btn primary" [disabled]="saving" (click)="save()">{{ saving ? 'Saving…' : 'Save settings' }}</button>
      <p class="ok" *ngIf="saved">{{ saved }}</p>
      <p class="error" *ngIf="error">{{ error }}</p>
    </div>
    <p class="muted" *ngIf="!form && !loadError">Loading settings…</p>
    <p class="error" *ngIf="loadError">{{ loadError }}</p>
  `,
  styles: [ADMIN_STYLES]
})
export class AdminSettingsComponent implements OnInit {
  private readonly api = inject(AdminApi);
  form: { dailyFreeQuestionCount: number; secondsPerQuestion: number; freeSubjectCategory: string } | null = null;
  categoryNames: string[] = [];
  saving = false;
  saved = '';
  error = '';
  loadError = '';

  async ngOnInit() {
    const [form, categories] = await Promise.all([
      this.api.get<NonNullable<AdminSettingsComponent['form']>>('/settings').catch(() => null),
      this.api.get<Array<{ name: string }>>('/categories').catch(() => [])
    ]);
    this.categoryNames = categories.map((category) => category.name);
    if (form && form.freeSubjectCategory && !this.categoryNames.includes(form.freeSubjectCategory)) {
      this.categoryNames = [form.freeSubjectCategory, ...this.categoryNames];
    }
    this.form = form ? { ...form, freeSubjectCategory: form.freeSubjectCategory ?? '' } : null;
    if (!form) this.loadError = 'Could not load settings.';
  }

  async save() {
    this.saved = this.error = '';
    this.saving = true;
    try {
      this.form = await this.api.send('put', '/settings', {
        dailyFreeQuestionCount: Number(this.form!.dailyFreeQuestionCount),
        secondsPerQuestion: Number(this.form!.secondsPerQuestion),
        freeSubjectCategory: this.form!.freeSubjectCategory ?? ''
      });
      this.saved = 'Settings saved.';
    } catch (e) {
      this.error = this.api.message(e, 'Could not save settings.');
    } finally {
      this.saving = false;
    }
  }
}
