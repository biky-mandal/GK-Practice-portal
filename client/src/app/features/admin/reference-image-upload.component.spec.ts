import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReferenceImageUploadComponent } from './reference-image-upload.component';

describe('Reference image upload', () => {
  let fixture: ComponentFixture<ReferenceImageUploadComponent>;
  let component: ReferenceImageUploadComponent;
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReferenceImageUploadComponent] }).compileComponents();
    fixture = TestBed.createComponent(ReferenceImageUploadComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  const inputWith = (file: File): HTMLInputElement => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    return input;
  };

  it('reads a real image and emits it only after successful decoding', async () => {
    const emit = spyOn(component.valueChange, 'emit');
    const busy = spyOn(component.loadingChange, 'emit');
    const file = new File([Uint8Array.from(atob(png), (ch) => ch.charCodeAt(0))], 'reference.png', { type: 'image/png' });
    const input = inputWith(file);
    const reading = component.selectFile(input);
    expect(component.loading).toBeTrue();
    expect(emit).not.toHaveBeenCalled();
    await reading;
    expect(emit).toHaveBeenCalledOnceWith(`data:image/png;base64,${png}`);
    expect(busy.calls.allArgs()).toEqual([[true], [false]]);
    expect(component.loading).toBeFalse();
    expect(component.error).toBe('');
    expect(input.value).toBe('');
  });

  it('rejects unsupported types, empty files, oversized files and invalid image data without replacing the current image', async () => {
    component.value = `data:image/png;base64,${png}`;
    const emit = spyOn(component.valueChange, 'emit');
    const files = [
      new File(['<svg/>'], 'reference.svg', { type: 'image/svg+xml' }),
      new File([], 'empty.png', { type: 'image/png' }),
      new File([new Uint8Array(512 * 1024 + 1)], 'large.png', { type: 'image/png' }),
      new File(['not an image'], 'invalid.png', { type: 'image/png' })
    ];
    for (const file of files) {
      await component.selectFile(inputWith(file));
      fixture.detectChanges();
      expect(component.error).not.toBe('');
      expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    }
    expect(emit).not.toHaveBeenCalled();
    expect(component.value).toBe(`data:image/png;base64,${png}`);
  });

  it('allows removing the image but respects disabled and loading states', () => {
    const emit = spyOn(component.valueChange, 'emit');
    component.disabled = true;
    component.remove();
    expect(emit).not.toHaveBeenCalled();
    component.disabled = false;
    component.loading = true;
    component.remove();
    expect(emit).not.toHaveBeenCalled();
    component.loading = false;
    component.remove();
    expect(emit).toHaveBeenCalledOnceWith(null);
  });

  it('does not apply an image after its editor has been closed', async () => {
    const emit = spyOn(component.valueChange, 'emit');
    const file = new File([Uint8Array.from(atob(png), (ch) => ch.charCodeAt(0))], 'reference.png', { type: 'image/png' });
    const reading = component.selectFile(inputWith(file));
    fixture.destroy();
    await reading;
    expect(emit).not.toHaveBeenCalled();
  });
});
