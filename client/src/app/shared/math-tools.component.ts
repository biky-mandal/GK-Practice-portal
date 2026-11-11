import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MathTextDirective } from './math-text.directive';
import { convertTextToLatex } from './math-convert';

/** Convert-to-LaTeX button, undo, and a Plain / LaTeX source / Rendered toggle shown next to a text field. */
@Component({
  selector: 'app-math-tools',
  standalone: true,
  imports: [CommonModule, MathTextDirective],
  changeDetection: ChangeDetectionStrategy.Default,
  template: `
    <div class="math-tools">
      <button type="button" class="mt-btn" (click)="convert()" [disabled]="!text" title="Wrap math-looking parts in $...$ and convert to LaTeX">ƒ Convert to LaTeX</button>
      <button type="button" class="mt-btn" *ngIf="previous !== null" (click)="undo()">Undo</button>
      <span class="mt-toggle" role="group" aria-label="Preview mode">
        <button type="button" [class.on]="mode === 'off'" (click)="mode = 'off'">Off</button>
        <button type="button" [class.on]="mode === 'both'" (click)="mode = 'both'">Plain + Rendered</button>
        <button type="button" [class.on]="mode === 'rendered'" (click)="mode = 'rendered'">Rendered</button>
      </span>
    </div>
    <div class="mt-preview" *ngIf="mode !== 'off' && text">
      <div class="mt-col" *ngIf="mode === 'both'"><small>Plain / LaTeX source</small><pre>{{ text }}</pre></div>
      <div class="mt-col"><small>Rendered</small><div [lang]="lang" [appMath]="text"></div></div>
    </div>
  `,
  styles: [`
    .math-tools { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 4px 0; }
    .mt-btn, .mt-toggle button { border: 1px solid #cbd5e1; background: #f8fafc; border-radius: 6px; padding: 2px 8px; font-size: 12px; cursor: pointer; }
    .mt-btn:disabled { opacity: .5; cursor: default; }
    .mt-toggle { display: inline-flex; }
    .mt-toggle button { border-radius: 0; margin-left: -1px; }
    .mt-toggle button:first-child { border-radius: 6px 0 0 6px; margin-left: 0; }
    .mt-toggle button:last-child { border-radius: 0 6px 6px 0; }
    .mt-toggle button.on { background: #1d4ed8; color: #fff; border-color: #1d4ed8; }
    .mt-preview { display: flex; flex-wrap: wrap; gap: 12px; border: 1px dashed #94a3b8; border-radius: 8px; padding: 6px 10px; margin-bottom: 6px; }
    .mt-col { flex: 1 1 220px; min-width: 0; }
    .mt-col small { color: #64748b; display: block; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: Consolas, monospace; font-size: 13px; }
  `]
})
export class MathToolsComponent {
  @Input() text: string | null | undefined = '';
  @Input() lang = 'en';
  @Output() textChange = new EventEmitter<string>();

  mode: 'off' | 'both' | 'rendered' = 'off';
  previous: string | null = null;

  convert(): void {
    const current = this.text ?? '';
    const converted = convertTextToLatex(current);
    if (converted === current) return;
    this.previous = current;
    this.textChange.emit(converted);
    if (this.mode === 'off') this.mode = 'both';
  }

  undo(): void {
    if (this.previous === null) return;
    this.textChange.emit(this.previous);
    this.previous = null;
  }
}
