import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { AdminApi, VerificationReport } from './admin.api';
import { AdminQuestionsComponent } from './admin-questions.component';
import { ReferenceImageUploadComponent } from './reference-image-upload.component';

describe('Admin question answer verification', () => {
  let fixture: ComponentFixture<AdminQuestionsComponent>;
  let component: AdminQuestionsComponent;
  let api: jasmine.SpyObj<AdminApi>;
  const question = {
    id: 'question-1', questionId: 'Q1', correctOption: 0, categories: ['History'],
    exams: [], difficulty: 'Easy', subject: 'History', topic: '', tags: [], isActive: true,
    localized: { en: { questionText: 'Which answer?', options: ['First', 'Second'] } }
  };
  const report: VerificationReport = {
    input: { language: 'en', questionText: 'Which answer?', options: ['First', 'Second'], correctOption: 0, asOfDate: '' },
    result: {
      verdict: 'likely_incorrect', suggestedOption: 1, explanation: 'Evidence supports the second option.',
      sources: [
        { title: 'Primary source', url: 'https://primary.example/fact', evidence: 'Supporting evidence.' },
        { title: 'Reference', url: 'https://reference.example/fact', evidence: 'Independent evidence.' }
      ],
      checkedAt: '2026-10-28T12:00:00.000Z', model: 'test-model'
    }
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<AdminApi>('AdminApi', ['get', 'send', 'message']);
    api.get.and.resolveTo([]);
    api.get.withArgs('/questions/question-1/verification').and.resolveTo({ configured: true, report: null });
    api.get.withArgs('/questions/question-1').and.resolveTo(structuredClone(question));
    api.get.withArgs('/questions', jasmine.anything()).and.resolveTo({ items: [], total: 0, page: 1, pageSize: 20 });
    api.send.and.resolveTo(structuredClone(report));
    api.message.and.returnValue('Verification request failed.');
    await TestBed.configureTestingModule({
      declarations: [AdminQuestionsComponent],
      imports: [CommonModule, FormsModule, MatButtonModule, ReferenceImageUploadComponent],
      providers: [{ provide: AdminApi, useValue: api }]
    }).compileComponents();
    fixture = TestBed.createComponent(AdminQuestionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    await component.open('question-1');
    fixture.detectChanges();
  });

  it('offers every requested page length and reloads page one with the selected value', async () => {
    const select: HTMLSelectElement = fixture.nativeElement.querySelector('.pager select');
    const sizes: (number | 'all')[] = [20, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 'all'];
    expect(Array.from(select.options, (option) => option.textContent?.trim()))
      .toEqual(sizes.map((size) => size === 'all' ? 'All' : String(size)));

    for (let index = 0; index < sizes.length; index++) {
      component.page = 3;
      api.get.calls.reset();
      select.selectedIndex = index;
      select.dispatchEvent(new Event('change'));
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(component.pageSize).toBe(sizes[index]);
      expect(api.get).toHaveBeenCalledWith('/questions', {
        ...component.filters, page: 1, pageSize: sizes[index]
      });
      expect(component.page).toBe(1);
    }
  });

  it('submits the current editor text, not the previously saved question', async () => {
    component.edit!.text.en = 'Unsaved question';
    component.verificationDate = '2024-08-01';
    await component.verifyAnswer();
    expect(api.send).toHaveBeenCalledWith('post', '/questions/question-1/verification', {
      ...report.input, questionText: 'Unsaved question', asOfDate: '2024-08-01'
    });

    expect(component.edit!.correctOption).toBe(0);
    expect(component.verificationStale).toBeTrue();
  });

  it('preserves existing translations on invalid results and permits retry without duplicate field requests', async () => {
    component.edit!.text.as = 'Existing question';
    let resolve!: (value: { translations: string[] }) => void;
    api.send.and.returnValue(new Promise((done) => { resolve = done; }));
    const translating = component.translateField('question');
    await component.translateField('question');
    expect(api.send).toHaveBeenCalledTimes(1);
    expect(component.isTranslating('question')).toBeTrue();
    resolve({ translations: [''] });
    await translating;
    expect(component.edit!.text.as).toBe('Existing question');
    expect(component.editError).toContain('empty or incomplete');
    expect(component.isTranslating('question')).toBeFalse();
    api.send.and.resolveTo({ translations: ['New question'] });
    await component.translateField('question');
    expect(component.edit!.text.as).toBe('New question');
  });

  it('loads, replaces and removes the saved question reference image', async () => {
    const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    api.get.withArgs('/questions/question-1').and.resolveTo({ ...question, referenceImage: image });
    await component.open('question-1');
    fixture.detectChanges();
    expect(component.edit!.referenceImage).toBe(image);
    expect(fixture.nativeElement.querySelector('app-reference-image-upload img').src).toBe(image);
    component.edit!.referenceImage = 'replacement';
    await component.save();
    expect(api.send).toHaveBeenCalledWith('put', '/questions/question-1', jasmine.objectContaining({ referenceImage: 'replacement' }));
    await component.open('question-1');
    component.edit!.referenceImage = null;
    await component.save();
    expect(api.send).toHaveBeenCalledWith('put', '/questions/question-1', jasmine.objectContaining({ referenceImage: null }));
  });

  it('does not save while an image is being read', async () => {
    component.imageLoading = true;
    await component.save();
    expect(api.send).not.toHaveBeenCalled();
  });

  it('renders citations and requires explicit selection and saving to change the answer', async () => {
    await component.verifyAnswer();
    fixture.detectChanges();
    expect(component.verificationStale).toBeFalse();
    expect(component.edit!.correctOption).toBe(0);
    const links: NodeListOf<HTMLAnchorElement> = fixture.nativeElement.querySelectorAll('.verification-report a');
    expect(links.length).toBe(2);
    expect(links[0].href).toBe(report.result.sources[0].url);
    expect(links[0].rel).toBe('noopener noreferrer');
    component.applyVerifiedAnswer();
    expect(component.edit!.correctOption).toBe(1);
    expect(component.verificationStale).toBeTrue();
    expect(api.send.calls.count()).toBe(1);
    expect(component.verificationNotice).toContain('Apply changes');
    await component.save();
    expect(api.send).toHaveBeenCalledWith('put', '/questions/question-1', jasmine.objectContaining({ correctOption: 1 }));
  });

  it('marks reports stale for all checked inputs and blocks corrections', async () => {
    await component.verifyAnswer();
    component.edit!.options[0].en = 'Changed';
    expect(component.verificationStale).toBeTrue();
    component.applyVerifiedAnswer();
    expect(component.edit!.correctOption).toBe(0);
    component.edit!.options[0].en = 'First';
    component.edit!.text.en = 'Changed question';
    expect(component.verificationStale).toBeTrue();
    component.edit!.text.en = 'Which answer?';
    component.edit!.correctOption = 1;
    expect(component.verificationStale).toBeTrue();
    component.edit!.correctOption = 0;
    component.verificationLanguage = 'as';
    expect(component.verificationStale).toBeTrue();
    component.verificationLanguage = 'en';
    component.verificationDate = '2024-08-01';
    expect(component.verificationStale).toBeTrue();
  });

  it('does not apply inconclusive assessments', async () => {
    api.send.and.resolveTo({ ...report, result: { ...report.result, verdict: 'inconclusive', suggestedOption: null } });
    await component.verifyAnswer();
    component.applyVerifiedAnswer();
    expect(component.edit!.correctOption).toBe(0);
  });

  it('disables verification when the server has no key, without disabling normal editing', () => {
    component.verificationConfigured = false;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Not configured');
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.verification > button');
    expect(button.disabled).toBeTrue();
    expect(component.missing(component.edit!)).toEqual([]);
  });

  it('loads persisted reports without invoking a paid verification', async () => {
    api.get.withArgs('/questions/question-1/verification').and.resolveTo({ configured: true, report });
    await component.loadVerification(component.edit!);
    expect(component.verificationReport).toEqual(report);
    expect(component.verificationStale).toBeFalse();
    expect(api.send).not.toHaveBeenCalled();
  });

  it('reports provider failures and keeps the previous report and selected answer', async () => {
    component.verificationReport = report;
    api.send.and.rejectWith(new Error('Provider failed'));
    await component.verifyAnswer();
    expect(component.verificationError).toBe('Verification request failed.');
    expect(component.verificationReport).toBe(report);
    expect(component.edit!.correctOption).toBe(0);
    expect(component.verifying).toBeFalse();
  });

  it('ignores a verification that completes after its editor closes', async () => {
    let resolve!: (value: VerificationReport) => void;
    api.send.and.returnValue(new Promise<VerificationReport>((done) => { resolve = done; }));
    const pending = component.verifyAnswer();
    expect(component.verifying).toBeTrue();
    component.edit = null;
    resolve(report);
    await pending;
    expect(component.verificationReport).toBeNull();
    expect(component.verifying).toBeFalse();
  });

  it('prevents duplicate paid requests while research is running', async () => {
    let resolve!: (value: VerificationReport) => void;
    api.send.and.returnValue(new Promise<VerificationReport>((done) => { resolve = done; }));
    const pending = component.verifyAnswer();
    await component.verifyAnswer();
    expect(api.send.calls.count()).toBe(1);
    resolve(report);
    await pending;
  });
});
