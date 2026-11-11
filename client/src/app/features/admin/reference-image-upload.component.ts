import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';

@Component({
  selector: 'app-reference-image-upload',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section aria-label="Question reference image">
      <label>
        <strong>Reference image (optional)</strong>
        <span>Shown on the right in regular simulation only. PNG, JPEG or WebP, up to 512 KB.</span>
        <input #fileInput type="file" accept="image/png,image/jpeg,image/webp" [disabled]="disabled || loading" (change)="selectFile(fileInput)" />
      </label>
      <p *ngIf="loading" role="status">Reading image...</p>
      <img *ngIf="value" [src]="value" alt="Question reference image preview" />
      <button *ngIf="value" type="button" [disabled]="disabled || loading" (click)="remove()">Remove image</button>
      <p class="error" *ngIf="error" role="alert">{{ error }}</p>
    </section>
  `,
  styles: [`
    :host { display: block; margin: 16px 0; }
    section { display: grid; gap: 10px; padding: 14px; border: 1px solid #cbd5e1; border-radius: 12px; background: #f8fafc; color: #12304d; }
    label { display: grid; gap: 8px; }
    label span { color: #35506b; font-size: 0.85rem; }
    input { max-width: 100%; }
    img { width: 100%; max-height: 240px; object-fit: contain; background: #fff; border-radius: 8px; }
    button { justify-self: start; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; color: #9f1239; font: inherit; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    p { margin: 0; }
    .error { color: #9f1239; }
  `]
})
export class ReferenceImageUploadComponent implements OnDestroy {
  @Input() value: string | null = null;
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<string | null>();
  @Output() loadingChange = new EventEmitter<boolean>();
  loading = false;
  error = '';
  private reader: FileReader | null = null;
  private destroyed = false;

  async selectFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file || this.disabled || this.loading) return;
    this.error = '';
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      this.error = 'Choose a PNG, JPEG or WebP image.';
      return;
    }
    if (!file.size || file.size > 512 * 1024) {
      this.error = 'Choose a non-empty image up to 512 KB.';
      return;
    }
    this.loading = true;
    this.loadingChange.emit(true);
    try {
      const value = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        this.reader = reader;
        reader.onload = () => typeof reader.result === 'string'
          ? resolve(reader.result) : reject(new Error('Could not read the image.'));
        reader.onerror = () => reject(new Error('Could not read the image.'));
        reader.onabort = () => reject(new Error('Image reading was cancelled.'));
        reader.readAsDataURL(file);
      });
      const image = new Image();
      image.src = value;
      await image.decode();
      if (!this.destroyed) this.valueChange.emit(value);
    } catch {
      if (!this.destroyed) this.error = 'Could not read this image. Choose a valid PNG, JPEG or WebP file.';
    } finally {
      this.reader = null;
      this.loading = false;
      if (!this.destroyed) this.loadingChange.emit(false);
    }
  }

  remove(): void {
    if (this.disabled || this.loading) return;
    this.error = '';
    this.valueChange.emit(null);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.reader?.abort();
  }
}
