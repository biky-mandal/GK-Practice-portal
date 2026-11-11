import { Directive, ElementRef, Input, OnChanges, inject } from '@angular/core';
import katex from 'katex';

// Matches $$...$$, \[...\], \(...\) and $...$ (single-line, non-empty, no space after opening / before closing $).
const MATH_PATTERN = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$(?!\s)([^$\n]+?)(?<!\s)\$/g;

const escapeHtml = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Renders LaTeX inside plain text. Text without math delimiters is shown exactly as before. */
@Directive({ selector: '[appMath]', standalone: true })
export class MathTextDirective implements OnChanges {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input('appMath') text: string | null | undefined = '';

  ngOnChanges(): void {
    const value = this.text ?? '';
    const host = this.el.nativeElement;
    MATH_PATTERN.lastIndex = 0;
    if (!MATH_PATTERN.test(value)) {
      host.textContent = value;
      return;
    }
    let html = '';
    let last = 0;
    MATH_PATTERN.lastIndex = 0;
    for (const match of value.matchAll(MATH_PATTERN)) {
      const index = match.index ?? 0;
      html += escapeHtml(value.slice(last, index));
      const display = match[1] !== undefined || match[2] !== undefined;
      const expr = match[1] ?? match[2] ?? match[3] ?? match[4] ?? '';
      try {
        html += katex.renderToString(expr, { displayMode: display, throwOnError: false, output: 'htmlAndMathml', trust: false });
      } catch {
        html += escapeHtml(match[0]);
      }
      last = index + match[0].length;
    }
    html += escapeHtml(value.slice(last));
    host.innerHTML = html;
  }
}
