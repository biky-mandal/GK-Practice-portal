import { CommonModule } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AdminPresenceService } from '../../core/admin-presence.service';
import { AuthService } from '../../core/auth.service';
import { MathTextDirective } from '../../shared/math-text.directive';
import { MathToolsComponent } from '../../shared/math-tools.component';
import { ReferenceImageUploadComponent } from './reference-image-upload.component';
import { AdminComponent } from './admin.component';

describe('Admin upload review table', () => {
  let fixture: ComponentFixture<AdminComponent>;
  let component: AdminComponent;
  let http: HttpTestingController;
  const assameseQuestion = '\u0995\u09cb\u09a8 \u0986\u099b\u09bf\u09b2?';
  const assameseAnswer = '\u09b6\u09c1\u09a6\u09cd\u09a7 \u0989\u09a4\u09cd\u09a4\u09f0';
  const record = {
    id: 'Q1',
    content: {
      questionText: { en: 'Who was the founder Vice-Chancellor?', as: assameseQuestion },
      options: [
        { id: 'A', text: { en: 'Krishnakanta Handique', as: assameseAnswer } },
        { id: 'B', text: { en: 'Another answer', as: 'B translation' } }
      ]
    },
    answerKey: {
      correctOptionIds: ['A'],
      explanation: { en: 'The founder was Handique.', as: 'Assamese explanation' }
    },
    classification: { subjects: ['History'], difficulty: 'Easy', exams: ['ADRE 3.0'] }
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdminComponent],
      imports: [CommonModule, FormsModule, MatButtonModule, MatCardModule, MathTextDirective, MathToolsComponent, ReferenceImageUploadComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: jasmine.createSpyObj('MatSnackBar', ['open']) },
        { provide: AdminPresenceService, useValue: { admins: () => [], setActiveSet: jasmine.createSpy('setActiveSet') } },
        { provide: AuthService, useValue: { userSignal: () => null } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(AdminComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne((request) => request.url.endsWith('/admin/manage/exams')).flush({ data: [{ name: 'ADRE 3.0' }] });
    http.expectOne((request) => request.url.endsWith('/admin/manage/categories')).flush({ data: [{ name: 'History' }] });
    http.expectOne((request) => request.url.endsWith('/admin/questions/count')).flush({ data: { total: 0 } });
    http.expectOne((request) => request.url.endsWith('/admin/questions/drafts')).flush({ data: [] });
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('keeps successful fields when another translation fails, blocks duplicate clicks and permits retry', async () => {
    show([record]);
    component.edit(0);
    const first = component.translateField('question');
    await component.translateField('question');
    expect(component.isTranslating('question')).toBeTrue();
    http.expectOne((req) => req.url.endsWith('/admin/manage/translate'))
      .flush({ data: { translations: ['New Assamese question'] } });
    await first;
    expect(component.draft!.text.as).toBe('New Assamese question');

    const failed = component.translateField('explanation');
    http.expectOne((req) => req.url.endsWith('/admin/manage/translate'))
      .flush({ message: 'Translation capacity is temporarily exhausted.' }, { status: 503, statusText: 'Unavailable' });
    await failed;
    expect(component.draft!.text.as).toBe('New Assamese question');
    expect(component.draft!.explanation.as).toBe('Assamese explanation');
    expect(component.editError).toContain('capacity');
    expect(component.isTranslating('explanation')).toBeFalse();

    const retry = component.translateField('explanation');
    http.expectOne((req) => req.url.endsWith('/admin/manage/translate')).flush({ data: { translations: [''] } });
    await retry;
    expect(component.editError).toContain('empty or incomplete');
    expect(component.draft!.explanation.as).toBe('Assamese explanation');
  });

  function show(records: unknown[]) {
    component.allDrafts = records.map((item, index) => ({
      id: `draft-${index}`, record: item, setTitle: 'Review', fileName: 'questions.json'
    }));
    component.selectSet('Review');
    fixture.detectChanges();
  }

  function cell(selector: string): string {
    return fixture.nativeElement.querySelector(selector).textContent.trim();
  }

  it('adds, replaces and removes an optional reference image in a question upload draft', async () => {
    const images = [
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'data:image/webp;base64,UklGRg==',
      null
    ];
    show([record]);
    for (const referenceImage of images) {
      component.edit(0);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-reference-image-upload')).not.toBeNull();
      component.draft!.referenceImage = referenceImage;
      const saving = component.saveEdit();
      const request = http.expectOne((req) => req.url.endsWith('/admin/questions/drafts/draft-0'));
      expect(request.request.body.record.referenceImage).toBe(referenceImage);
      expect(request.request.body.record.content.questionText).toEqual(record.content.questionText);
      request.flush({ data: {} });
      await saving;
      expect(component.allDrafts[0].record).toEqual(jasmine.objectContaining({ referenceImage }));
    }
  });

  it('blocks saving and mode changes while an image is being read', async () => {
    show([record]);
    component.edit(0);
    component.imageLoading = true;
    component.switchMode('json');
    await component.saveEdit();
    expect(component.editMode).toBe('form');
    http.expectNone((req) => req.method === 'PUT');
    component.cancelEdit();
    expect(component.imageLoading).toBeFalse();
  });

  it('renders bilingual questions, every option, answers and explanations in the table', () => {
    show([record]);
    expect(fixture.nativeElement.querySelectorAll('.preview-table th').length).toBe(16);
    expect(cell('.preview-table th:nth-child(3)')).toBe('Translate question');
    expect(cell('.preview-table th:nth-child(6)')).toBe('Translate options');
    expect(cell('.preview-table th:nth-child(9)')).toBe('Translate answer');
    expect(cell('.preview-table th:nth-child(12)')).toBe('Translate explanation');
    for (const selector of ['.translate-question button', '.translate-options button', '.translate-answer button', '.translate-explanation button']) {
      const button = fixture.nativeElement.querySelector(selector);
      expect(button.querySelector('svg')).not.toBeNull();
      expect(button.textContent.trim()).toBe('');
      expect(button.getAttribute('aria-label')).toContain('to Assamese');
    }
    expect(cell('.question-en')).toBe(record.content.questionText.en);
    expect(cell('.question-as')).toBe(assameseQuestion);
    expect(cell('.options-en')).toContain('A.Krishnakanta Handique');
    expect(cell('.options-en')).toContain('B.Another answer');
    expect(cell('.options-as')).toContain(assameseAnswer);
    expect(cell('.options-as')).toContain('B.B translation');
    expect(cell('.answer-en')).toBe('A.Krishnakanta Handique');
    expect(cell('.answer-as')).toBe(`A.${assameseAnswer}`);
    expect(cell('.explanation-en')).toBe(record.answerKey.explanation.en);
    expect(cell('.explanation-as')).toBe(record.answerKey.explanation.as);
    expect(cell('.details-cell')).toContain('History');
    expect(cell('.details-cell')).toContain('ADRE 3.0');
    expect(cell('.flag.ok')).toContain('Complete');
  });

  it('shows all correct answers using option IDs, not their array positions', () => {
    show([{ ...record, answerKey: { ...record.answerKey, correctOptionIds: ['B', 'A'] } }]);
    const answers: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('.answer-en .option-line');
    expect(Array.from(answers, (answer) => answer.textContent?.trim()))
      .toEqual(['B.Another answer', 'A.Krishnakanta Handique']);
  });

  it('keeps icon cells at full row height with vertically centered buttons', () => {
    show([record]);
    const row: HTMLTableRowElement = fixture.nativeElement.querySelector('.preview-table tbody tr');
    const rowBounds = row.getBoundingClientRect();
    for (const selector of ['.translate-question', '.translate-options', '.translate-answer', '.translate-explanation', '.row-actions']) {
      const iconCell = row.querySelector<HTMLTableCellElement>(selector)!;
      const bounds = iconCell.getBoundingClientRect();
      expect(getComputedStyle(iconCell).display).toBe('table-cell');
      expect(getComputedStyle(iconCell).verticalAlign).toBe('middle');
      expect(Math.abs(bounds.height - rowBounds.height)).toBeLessThan(1);
      for (const button of Array.from(iconCell.querySelectorAll('button'))) {
        const buttonBounds = button.getBoundingClientRect();
        expect(Math.abs(buttonBounds.top + buttonBounds.height / 2 - (bounds.top + bounds.height / 2)))
          .toBeLessThan(2);
      }
    }
  });

  it('gives every column more space while keeping text columns wider', () => {
    show([record]);
    const cells: NodeListOf<HTMLTableCellElement> = fixture.nativeElement.querySelectorAll('.preview-table tbody td');
    for (const tableCell of Array.from(cells)) {
      expect(parseFloat(getComputedStyle(tableCell).minWidth)).toBeGreaterThanOrEqual(120);
      expect(getComputedStyle(tableCell).paddingLeft).toBe('24px');
      expect(getComputedStyle(tableCell).paddingRight).toBe('24px');
    }
    expect(getComputedStyle(fixture.nativeElement.querySelector('.content-cell')).minWidth).toBe('320px');
    expect(getComputedStyle(fixture.nativeElement.querySelector('.details-cell')).minWidth).toBe('280px');
  });

  it('supports flat English-only records without substituting English for Assamese', () => {
    show([{
      questionId: 'legacy',
      questionText: 'English question',
      options: [{ id: 'A', text: 'First' }, { id: 'B', text: 'Second' }],
      answerKey: { correctOptionIds: ['B'] },
      subject: 'History',
      difficulty: 'Easy'
    }]);
    expect(cell('.question-en')).toBe('English question');
    expect(cell('.question-as')).toBe('(missing)');
    expect(cell('.options-as')).not.toContain('First');
    expect(cell('.answer-en')).toBe('B.Second');
    expect(cell('.answer-as')).toBe('B.(missing)');
    expect(cell('.explanation-en')).toBe('-');
    expect(component.incompleteCount).toBe(0);
  });

  it('keeps missing subjects and missing answers visible and blocks publishing', () => {
    show([{
      ...record,
      classification: { ...record.classification, subjects: [] },
      answerKey: { correctOptionIds: ['unknown'] }
    }]);
    expect(cell('.answer-en')).toBe('unknown.(missing)');
    expect(cell('.flag.bad')).toContain('Correct answer');
    expect(cell('.flag.bad')).toContain('Subject (select at least one)');
    const upload: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Upload question"]');
    expect(upload.disabled).toBeTrue();
    expect(component.incompleteCount).toBe(1);
  });

  it('refreshes the bilingual preview after saving an edit', async () => {
    show([record]);
    component.edit(0);
    component.draft!.text.as = 'Updated translation';
    component.draft!.options[0].text.en = 'Updated answer';
    const saving = component.saveEdit();
    const request = http.expectOne((item) => item.url.endsWith('/admin/questions/drafts/draft-0'));
    expect(request.request.method).toBe('PUT');
    expect(request.request.body.record.content.questionText.as).toBe('Updated translation');
    request.flush({ data: {} });
    await saving;
    fixture.detectChanges();
    expect(cell('.question-as')).toBe('Updated translation');
    expect(cell('.options-en')).toContain('Updated answer');
    expect(cell('.answer-en')).toBe('A.Updated answer');
  });

  it('translates all options together and refreshes the preview only after saving', async () => {
    show([record]);
    const translating = component.translateOptions(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.translate-options button').getAttribute('aria-busy')).toBe('true');
    expect(fixture.nativeElement.querySelector('.translate-options button').disabled).toBeTrue();
    await component.translateOptions(0);
    await component.uploadOne(0);
    await component.upload();
    const request = http.expectOne((item) => item.url.endsWith('/admin/manage/translate'));
    expect(request.request.body).toEqual({ texts: ['Krishnakanta Handique', 'Another answer'] });
    request.flush({ data: { translations: ['Translated A', 'Translated B'] } });
    await fixture.whenStable();
    const save = http.expectOne((item) => item.url.endsWith('/admin/questions/drafts/draft-0'));
    expect(save.request.method).toBe('PUT');
    expect(save.request.body.record).toEqual({
      ...record,
      content: {
        ...record.content,
        options: [
          { id: 'A', text: { en: 'Krishnakanta Handique', as: 'Translated A' } },
          { id: 'B', text: { en: 'Another answer', as: 'Translated B' } }
        ]
      }
    });
    expect(component.records[0]).toEqual(record);
    save.flush({ data: {} });
    await translating;
    fixture.detectChanges();
    expect(cell('.options-as')).toContain('B.Translated B');
    expect(cell('.answer-as')).toBe('A.Translated A');
    expect(component.allDrafts[0].record).toEqual(save.request.body.record);
    expect(component.translatingOptions.size).toBe(0);
  });

  it('preserves flat records, option metadata and nonsequential answer IDs', async () => {
    const flat = {
      questionId: 'legacy', questionText: 'Question',
      options: [{ id: 'Z', text: 'First', image: 'image.png' }, { id: 'X', text: 'Second' }],
      answerKey: { correctOptionIds: ['X'] }, subject: 'History', difficulty: 'Easy'
    };
    show([flat]);
    const translating = component.translateOptions(0);
    http.expectOne((item) => item.url.endsWith('/admin/manage/translate'))
      .flush({ data: { translations: ['First translated', 'Second translated'] } });
    await fixture.whenStable();
    const save = http.expectOne((item) => item.url.endsWith('/admin/questions/drafts/draft-0'));
    expect(save.request.body.record).toEqual({
      ...flat,
      options: [
        { id: 'Z', text: { en: 'First', as: 'First translated' }, image: 'image.png' },
        { id: 'X', text: { en: 'Second', as: 'Second translated' } }
      ]
    });
    save.flush({ data: {} });
    await translating;
    fixture.detectChanges();
    expect(cell('.answer-as')).toBe('X.Second translated');
  });

  for (const translations of [['Only one'], ['Valid', ''], ['Valid', null]]) {
    it(`rejects incomplete translations ${JSON.stringify(translations)} without saving`, async () => {
      show([record]);
      const translating = component.translateOptions(0);
      http.expectOne((item) => item.url.endsWith('/admin/manage/translate'))
        .flush({ data: { translations } });
      await translating;
      expect(component.records[0]).toEqual(record);
      expect(component.translatingOptions.size).toBe(0);
      expect(TestBed.inject(MatSnackBar).open).toHaveBeenCalledWith(
        'Translation returned incomplete options. No changes were saved.', 'Close'
      );
    });
  }

  it('leaves the draft unchanged and allows retry after translation or save failure', async () => {
    show([record]);
    let translating = component.translateOptions(0);
    http.expectOne((item) => item.url.endsWith('/admin/manage/translate'))
      .flush({ message: 'Translation unavailable' }, { status: 502, statusText: 'Bad Gateway' });
    await translating;
    expect(component.canTranslateOptions(0)).toBeTrue();
    expect(TestBed.inject(MatSnackBar).open).toHaveBeenCalledWith('Translation unavailable', 'Close');
    translating = component.translateOptions(0);
    http.expectOne((item) => item.url.endsWith('/admin/manage/translate'))
      .flush({ data: { translations: ['Translated A', 'Translated B'] } });
    await fixture.whenStable();
    http.expectOne((item) => item.url.endsWith('/admin/questions/drafts/draft-0'))
      .flush({ message: 'Save failed' }, { status: 500, statusText: 'Server Error' });
    await translating;
    expect(component.records[0]).toEqual(record);
    expect(component.allDrafts[0].record).toEqual(record);
    expect(component.canTranslateOptions(0)).toBeTrue();
    expect(TestBed.inject(MatSnackBar).open).toHaveBeenCalledWith('Save failed', 'Close');
  });

  it('updates the correct cached draft when switching sets during translation', async () => {
    show([record]);
    component.allDrafts.push({ id: 'other', record, setTitle: 'Other', fileName: 'other.json' });
    const translating = component.translateOptions(0);
    component.selectSet('Other');
    http.expectOne((item) => item.url.endsWith('/admin/manage/translate'))
      .flush({ data: { translations: ['Translated A', 'Translated B'] } });
    await fixture.whenStable();
    http.expectOne((item) => item.url.endsWith('/admin/questions/drafts/draft-0')).flush({ data: {} });
    await translating;
    expect(component.records[0]).toEqual(record);
    component.selectSet('Review');
    fixture.detectChanges();
    expect(cell('.answer-as')).toBe('A.Translated A');
  });

  it('disables translation when English options are missing, uploading, or editing', () => {
    show([{ ...record, content: { ...record.content, options: [{ id: 'A', text: { en: '', as: 'Existing' } }] } }]);
    expect(component.canTranslateOptions(0)).toBeFalse();
    show([record]);
    component.uploading = true;
    expect(component.canTranslateOptions(0)).toBeFalse();
    component.uploading = false;
    component.edit(0);
    expect(component.canTranslateOptions(0)).toBeFalse();
  });

  it('translates only correct answers by ID and keeps other options unchanged', async () => {
    show([{ ...record, answerKey: { ...record.answerKey, correctOptionIds: ['B'] } }]);
    fixture.nativeElement.querySelector('.translate-answer button').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.translate-options button').disabled).toBeTrue();
    const request = http.expectOne((item) => item.url.endsWith('/admin/manage/translate'));
    expect(request.request.body).toEqual({ texts: ['Another answer'] });
    request.flush({ data: { translations: ['Translated B'] } });
    await fixture.whenStable();
    const save = http.expectOne((item) => item.url.endsWith('/admin/questions/drafts/draft-0'));
    expect(save.request.body.record.content.options[0]).toEqual(record.content.options[0]);
    expect(save.request.body.record.content.options[1].text).toEqual({ en: 'Another answer', as: 'Translated B' });
    expect(save.request.body.record.answerKey.correctOptionIds).toEqual(['B']);
    save.flush({ data: {} });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(cell('.answer-as')).toBe('B.Translated B');
    expect(cell('.options-as')).toContain('B.Translated B');
  });

  it('translates multiple correct answers together regardless of answer ID order', async () => {
    show([{ ...record, answerKey: { ...record.answerKey, correctOptionIds: ['B', 'A'] } }]);
    const translating = component.translateOptions(0, 'answer');
    const request = http.expectOne((item) => item.url.endsWith('/admin/manage/translate'));
    expect(request.request.body.texts).toEqual(['Krishnakanta Handique', 'Another answer']);
    request.flush({ data: { translations: ['Translated A', 'Translated B'] } });
    await fixture.whenStable();
    http.expectOne((item) => item.url.endsWith('/admin/questions/drafts/draft-0')).flush({ data: {} });
    await translating;
    fixture.detectChanges();
    expect(cell('.answer-as')).toBe('B.Translated BA.Translated A');
  });

  it('blocks answer translation for missing or unknown correct answers', () => {
    for (const correctOptionIds of [[], ['unknown']]) {
      show([{ ...record, answerKey: { ...record.answerKey, correctOptionIds } }]);
      expect(component.canTranslateOptions(0, 'answer')).toBeFalse();
      expect(fixture.nativeElement.querySelector('.translate-answer button').disabled).toBeTrue();
    }
  });

  for (const target of ['question', 'explanation'] as const) {
    it(`translates and saves only the ${target} through its icon`, async () => {
      show([record]);
      fixture.nativeElement.querySelector(`.translate-${target} button`).click();
      const request = http.expectOne((item) => item.url.endsWith('/admin/manage/translate'));
      expect(request.request.body.texts).toEqual([
        target === 'question' ? record.content.questionText.en : record.answerKey.explanation.en
      ]);
      request.flush({ data: { translations: ['New translation'] } });
      await fixture.whenStable();
      const save = http.expectOne((item) => item.url.endsWith('/admin/questions/drafts/draft-0'));
      const expected = structuredClone(record);
      if (target === 'question') expected.content.questionText.as = 'New translation';
      else expected.answerKey.explanation.as = 'New translation';
      expect(save.request.body.record).toEqual(expected);
      expect(component.records[0]).toEqual(record);
      save.flush({ data: {} });
      await fixture.whenStable();
      fixture.detectChanges();
      expect(cell(`.${target}-as`)).toBe('New translation');
      expect(component.allDrafts[0].record).toEqual(expected);
    });

    it(`does not save a failed ${target} translation and allows retry`, async () => {
      show([record]);
      const translating = component.translateOptions(0, target);
      http.expectOne((item) => item.url.endsWith('/admin/manage/translate'))
        .flush({ message: 'Unavailable' }, { status: 502, statusText: 'Bad Gateway' });
      await translating;
      expect(component.records[0]).toEqual(record);
      expect(component.canTranslateOptions(0, target)).toBeTrue();
    });
  }

  it('disables question and explanation icons when their English text is missing', () => {
    show([{
      ...record, content: { ...record.content, questionText: { as: assameseQuestion } },
      answerKey: { ...record.answerKey, explanation: { as: 'Existing' } }
    }]);
    for (const target of ['question', 'explanation'] as const) {
      expect(component.canTranslateOptions(0, target)).toBeFalse();
      expect(fixture.nativeElement.querySelector(`.translate-${target} button`).disabled).toBeTrue();
    }
  });
});
