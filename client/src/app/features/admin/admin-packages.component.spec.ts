import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { PackPrice } from '../../core/pricing.service';
import { AdminApi } from './admin.api';
import { AdminPackagesComponent } from './admin-packages.component';

describe('AdminPackagesComponent', () => {
  const pack: PackPrice = {
    pack: 'complete', name: 'Complete ADRE', description: 'A preparation bundle',
    price: 699, originalPrice: 999, enabled: true, visible: true, archived: false,
    highlight: true, group: 'adre', access: ['subject', 'pyq'], perks: ['Practice', 'Review'], sortOrder: 5
  };
  const contentOptions = [
    { id: 'subject', name: 'Subject-wise practice', description: 'ADRE subject practice', group: 'adre', access: ['subject'], archived: false, sortOrder: 0 },
    { id: 'pyq', name: 'Previous-year papers', description: 'Original papers', group: 'adre', access: ['pyq'], archived: false, sortOrder: 1 },
    { id: 'mock', name: 'Full-length mocks', description: 'All 10 ADRE mocks', group: 'adre', access: ['mock'], archived: false, sortOrder: 2 },
    { id: 'police-subject', name: 'Subject-wise practice', description: 'Constable subjects', group: 'police-forest', access: ['police-subject'], archived: false, sortOrder: 3 }
  ];
  let api: { get: jasmine.Spy; send: jasmine.Spy; message: jasmine.Spy };

  beforeEach(async () => {
    api = {
      get: jasmine.createSpy('get').and.callFake((path: string) => Promise.resolve(path === '/packages' ? [pack] : {
        options: contentOptions.map((option) => ({ ...option, access: [...option.access] })), modes: contentOptions.map((option) => ({ id: option.id, name: option.description }))
      })),
      send: jasmine.createSpy('send').and.resolveTo([pack]),
      message: jasmine.createSpy('message').and.returnValue('Request failed')
    };
    await TestBed.configureTestingModule({
      declarations: [AdminPackagesComponent], imports: [CommonModule, FormsModule, MatDialogModule, NoopAnimationsModule],
      providers: [{ provide: AdminApi, useValue: api }]
    }).compileComponents();
  });

  const setup = async () => {
    const fixture = TestBed.createComponent(AdminPackagesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  it('renders the catalog, prices and editor with immutable IDs for existing packages', async () => {
    const fixture = await setup();
    expect(fixture.nativeElement.textContent).toContain('Complete ADRE');
    expect(fixture.nativeElement.textContent).toContain('On sale');
    fixture.componentInstance.edit(pack);
    fixture.detectChanges();
    await fixture.whenStable();
    const popup = TestBed.inject(OverlayContainer).getContainerElement();
    const id = popup.querySelector<HTMLInputElement>('input[name="pack"]')!;
    expect(id.disabled).toBeTrue();
    expect(popup.querySelectorAll('fieldset input:checked').length).toBe(2);
    expect(popup.querySelector<HTMLTextAreaElement>('textarea[name="perks"]')!.value).toBe('Practice\nReview');
    const actions = popup.querySelector<HTMLElement>('form > .actions')!;
    expect(actions.querySelectorAll('button').length).toBe(2);
    expect(getComputedStyle(actions).gap).toBe('8px');
    expect(getComputedStyle(actions).flexWrap).toBe('wrap');
    expect(fixture.nativeElement.querySelector('input[name="pack"]')).toBeNull();
  });

  it('creates hidden drafts and saves selected bundle content and normalized features', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    component.create();
    expect(component.draft?.visible).toBeFalse();
    expect(component.draft?.enabled).toBeFalse();
    Object.assign(component.draft!, pack, { pack: 'new-complete' });
    component.toggleAccess('subject');
    component.toggleAccess('pyq');
    component.toggleAccess('mock');
    component.perksText = ' First feature \n\nSecond feature';
    await component.save();
    expect(api.send).toHaveBeenCalledWith('post', '/packages', {
      pack: 'new-complete', details: jasmine.objectContaining({
        access: ['subject', 'pyq', 'mock'], perks: ['First feature', 'Second feature']
      })
    });
    expect(component.draft).toBeNull();
    expect(component.notice).toBe('Package saved.');
    expect(pack.access).toEqual(['subject', 'pyq']);
  });

  it('rejects invalid discount prices without submitting', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    component.edit(pack);
    component.draft!.originalPrice = 100;
    await component.save();
    expect(api.send).not.toHaveBeenCalled();
    expect(component.editError).toContain('greater than');
  });

  it('archives with confirmation and retains the content configuration', async () => {
    const fixture = await setup();
    spyOn(window, 'confirm').and.returnValue(true);
    await fixture.componentInstance.archive(pack);
    expect(api.send).toHaveBeenCalledWith('put', '/packages/complete', jasmine.objectContaining({
      archived: true, access: ['subject', 'pyq'], visible: true
    }));
  });

  it('surfaces load failures and keeps unsaved editor data on save failure', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    api.get.and.rejectWith(new Error('Load failed'));
    await component.load();
    fixture.detectChanges();
    expect(component.loadFailed).toBeTrue();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Request failed');
    component.edit(pack);
    component.loadFailed = false;
    api.send.and.rejectWith(new Error('Save failed'));
    await component.save();
    expect(component.draft?.name).toBe(pack.name);
    expect(component.editError).toBe('Request failed');
    expect(component.saving).toBeFalse();
  });

  it('groups accessible cards by exam and offers a deduplicated access preview', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    component.edit(pack);
    component.contentOptions.push({ id: 'revision', name: 'Revision bundle', description: 'Two modes', group: 'adre',
      access: ['subject', 'pyq'], archived: false, sortOrder: 5 });
    fixture.detectChanges();
    const element = TestBed.inject(OverlayContainer).getContainerElement();
    expect(element.querySelectorAll('.content-group').length).toBe(2);
    expect(element.querySelectorAll('.content-choice.selected').length).toBe(2);
    expect(element.querySelector('.selection-summary')?.textContent).toContain('2 selected');
    component.toggleAccess('revision');
    expect(component.draft?.access).toEqual(['subject', 'pyq']);
    component.selectGroup('adre');
    expect(component.groupSelected('adre')).toBeTrue();
    expect(component.draft?.access).toEqual(['subject', 'pyq', 'mock']);
    component.selectGroup('adre');
    expect(component.selectedContentIds).toEqual([]);
    component.toggleAccess('police-subject');
    expect(component.draft?.access).toEqual(['police-subject']);
  });

  it('retains selected archived options but does not offer them to new packages', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    component.contentOptions = component.contentOptions.map((option) => ({ ...option, archived: option.id === 'subject' }));
    component.edit(pack);
    expect(component.optionsFor('adre').some((option) => option.id === 'subject')).toBeTrue();
    component.toggleAccess('subject');
    expect(component.optionsFor('adre').some((option) => option.id === 'subject')).toBeFalse();
    component.toggleAccess('subject');
    expect(component.selectedContentIds).not.toContain('subject');
  });

  it('creates and edits persisted content choices and surfaces mapping failures', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    component.newContent();
    Object.assign(component.contentDraft!, { id: 'revision', name: 'Revision', description: 'ADRE revision' });
    component.toggleContentMode('subject');
    component.toggleContentMode('pyq');
    api.send.and.resolveTo([...contentOptions, component.contentDraft]);
    await component.saveContent();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(api.send).toHaveBeenCalledWith('post', '/package-content', {
      id: 'revision', details: jasmine.objectContaining({ access: ['subject', 'pyq'], name: 'Revision' })
    });
    expect(component.contentOptions.some((option) => option.id === 'revision')).toBeTrue();
    component.editContent(component.contentOptions[0]);
    component.contentDraft!.archived = true;
    api.send.and.rejectWith(new Error('Failed'));
    await component.saveContent();
    expect(component.contentError).toBe('Request failed');
    expect(component.contentDraft?.archived).toBeTrue();
    expect(component.contentSaving).toBeFalse();
  });

  it('opens nested content popups without losing the package draft and closes them independently', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    const dialogs = TestBed.inject(MatDialog);
    component.edit(pack);
    component.draft!.name = 'Unsaved package name';
    fixture.detectChanges();
    component.openContentManager();
    fixture.detectChanges();
    component.editContent(component.contentOptions[0]);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(dialogs.openDialogs.length).toBe(3);
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    expect(overlay.querySelector('[aria-label="Edit content option"]')).not.toBeNull();
    const contentActions = overlay.querySelector<HTMLElement>('input[name="contentId"]')!
      .closest('form')!.querySelector<HTMLElement>(':scope > .actions')!;
    expect(contentActions.querySelectorAll('button').length).toBe(2);
    expect(getComputedStyle(contentActions).gap).toBe('8px');
    expect(getComputedStyle(contentActions).flexWrap).toBe('wrap');
    component.closeContentEditor();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.contentDraft).toBeNull();
    expect(dialogs.openDialogs.length).toBe(2);
    component.managerDialog?.close();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.draft?.name).toBe('Unsaved package name');
    component.closePackageEditor();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.draft).toBeNull();
    expect(dialogs.openDialogs.length).toBe(0);
    expect(api.send).not.toHaveBeenCalled();
  });

  it('keeps the editor open with errors and prevents dismissal while saving', async () => {
    const fixture = await setup();
    const component = fixture.componentInstance;
    component.edit(pack);
    fixture.detectChanges();
    let rejectSave!: (error: Error) => void;
    api.send.and.returnValue(new Promise((_resolve, reject) => { rejectSave = reject; }));
    const saving = component.save();
    const ref = TestBed.inject(MatDialog).openDialogs[0];
    expect(ref.disableClose).toBeTrue();
    component.closePackageEditor();
    expect(TestBed.inject(MatDialog).openDialogs.length).toBe(1);
    rejectSave(new Error('Save failed'));
    await saving;
    fixture.detectChanges();
    expect(ref.disableClose).toBeFalse();
    expect(TestBed.inject(OverlayContainer).getContainerElement().querySelector('[role="alert"]')?.textContent).toContain('Request failed');
    expect(component.draft?.name).toBe(pack.name);
  });
});
