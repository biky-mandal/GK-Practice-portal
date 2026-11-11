import { environment } from '../../../environments/environment';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { AdminPresenceService } from '../../core/admin-presence.service';
import { EDITOR_STYLES } from './editor-styles';
import { MOCK_NUMBERS, PYQ_PAPERS, PYQ_YEARS, TagState, buildTags, pyqIncomplete, readTags } from './pyq-tags';

interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  failed: Array<{ index: number; id?: string; error: string }>;
}

interface PreviewRow {
  id: string;
  text: LangText;
  options: Array<{ id: string; text: LangText }>;
  answers: Array<{ id: string; text: LangText }>;
  explanation: LangText;
  subject: string;
  difficulty: string;
  language: string;
  exams: string;
  issues: string[];
}

interface LangText {
  en: string;
  as: string;
}

interface Draft {
  id: string;
  referenceImage: string | null;
  text: LangText;
  options: Array<{ id: string; text: LangText; note: LangText }>;
  correct: string[];
  explanation: LangText;
  difficulty: string;
  subjects: string[];
  exams: string[];
  tagState: TagState;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.css'],
  styles: [EDITOR_STYLES]
})
export class AdminComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly presence = inject(AdminPresenceService);
  private readonly snack = inject(MatSnackBar);
  private readonly auth = inject(AuthService);

  records: unknown[] = [];
  draftIds: string[] = [];
  allDrafts: Array<{ id: string; record: unknown; setTitle: string; fileName: string }> = [];
  sets: Array<{ title: string; count: number }> = [];
  activeSet = '';
  newSetTitle = '';
  renaming = false;
  renameValue = '';
  confirmingDelete = false;
  preview: PreviewRow[] = [];
  summary: ImportSummary | null = null;
  totalQuestions: number | null = null;
  uploading = false;
  categories: string[] = [];
  exams: string[] = [];
  readonly difficulties = ['Easy', 'Medium', 'Hard'];
  readonly pyqYears = PYQ_YEARS;
  readonly pyqPapers = PYQ_PAPERS;
  readonly mockNumbers = MOCK_NUMBERS;
  editIndex: number | null = null;
  editMode: 'form' | 'json' = 'form';
  editError = '';
  json = '';
  draft: Draft | null = null;
  imageLoading = false;
  private readonly translatingFields = new Set<string>();
  readonly translatingOptions = new Set<string>();

  canTranslateOptions(index: number, target: 'options' | 'answer' | 'explanation' | 'question' = 'options'): boolean {
    const row = this.preview[index];
    const options = target === 'answer' ? row?.answers : row?.options;
    return !this.uploading && this.editIndex === null && !!this.draftIds[index]
      && !this.translatingOptions.has(this.draftIds[index])
      && (target === 'question' ? !!row?.text.en.trim()
        : target === 'explanation' ? !!row?.explanation.en.trim()
        : !!options?.length && options.every((option) => !!option.text.en.trim()
          && (target === 'options' || row.options.some((entry) => entry.id === option.id))));
  }

  async translateOptions(index: number, target: 'options' | 'answer' | 'explanation' | 'question' = 'options') {
    if (!this.canTranslateOptions(index, target)) return;
    const id = this.draftIds[index];
    const updated = structuredClone(this.records[index]);
    const draft = this.toDraft(updated);
    const optionIndexes = draft.options.map((_, i) => i)
      .filter((i) => target === 'options' || draft.correct.includes(draft.options[i].id));
    const texts = target === 'question' ? [draft.text.en] : target === 'explanation' ? [draft.explanation.en]
      : optionIndexes.map((i) => draft.options[i].text.en);
    const label = target === 'answer' ? 'answers' : target;
    this.translatingOptions.add(id);
    try {
      const response = await firstValueFrom(
        this.http.post<{ data: { translations: string[] } }>(`${this.apiBase}/admin/manage/translate`, {
          texts
        })
      );
      const translations = response.data.translations;
      if (!Array.isArray(translations) || translations.length !== texts.length
        || translations.some((text) => typeof text !== 'string' || !text.trim())) {
        throw new Error(`Translation returned incomplete ${label}. No changes were saved.`);
      }
      if (!updated || typeof updated !== 'object') throw new Error('Invalid question draft.');
      if (target === 'question') {
        const content = 'content' in updated ? updated.content : updated;
        if (!content || typeof content !== 'object' || Array.isArray(content)) {
          throw new Error('Invalid question content.');
        }
        Object.assign(content, {
          questionText: this.fromLangs(draft.text, { en: draft.text.en, as: translations[0] })
        });
      } else if (target === 'explanation') {
        const answerKey = 'answerKey' in updated ? updated.answerKey : undefined;
        if (answerKey !== undefined && (!answerKey || typeof answerKey !== 'object' || Array.isArray(answerKey))) {
          throw new Error('Invalid question answer key.');
        }
        Object.assign(updated, {
          answerKey: {
            ...answerKey,
            explanation: this.fromLangs(draft.explanation, { en: draft.explanation.en, as: translations[0] })
          }
        });
      } else {
        const content = 'content' in updated ? updated.content : updated;
        if (!content || typeof content !== 'object' || !('options' in content) || !Array.isArray(content.options)) {
          throw new Error('Invalid question options.');
        }
        content.options = content.options.map((option, i) => {
          const translationIndex = optionIndexes.indexOf(i);
          return translationIndex < 0 ? option : {
            ...option,
            text: this.fromLangs(option.text, { en: draft.options[i].text.en, as: translations[translationIndex] })
          };
        });
      }
      await firstValueFrom(this.http.put(`${this.apiBase}/admin/questions/drafts/${id}`, { record: updated }));
      const cached = this.allDrafts.find((item) => item.id === id);
      if (cached) cached.record = updated;
      const currentIndex = this.draftIds.indexOf(id);
      if (currentIndex >= 0) {
        this.records[currentIndex] = updated;
        this.refreshPreview();
      }
      this.snack.open(`Assamese ${label} translated and saved to the draft.`, 'Close', { duration: 3000 });
    } catch (error: unknown) {
      const message = error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
        ? error.error.message
        : error instanceof Error ? error.message : `Could not translate and save ${label}. Try again.`;
      this.snack.open(message, 'Close');
    } finally {
      this.translatingOptions.delete(id);
    }
  }

  generateQuestionId() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    while (id.length < 12) {
      const values = new Uint8Array(16);
      globalThis.crypto.getRandomValues(values);
      for (const value of values) {
        if (value < 248) id += characters[value % characters.length];
        if (id.length === 12) break;
      }
    }
    if (this.draft) this.draft.id = id;
  }

  isTranslating(field: string): boolean {
    return this.translatingFields.has(field);
  }

  async translateField(field: 'question' | 'explanation' | 'option' | 'optionNote', index?: number) {
    const d = this.draft;
    if (!d) return;
    const fieldKey = field === 'option' ? `option-${index}` : field === 'optionNote' ? `option-note-${index}` : field;
    const option = index === undefined ? undefined : d.options[index];
    const source = field === 'question' ? d.text.en
      : field === 'explanation' ? d.explanation.en
        : field === 'option' ? option?.text.en
          : option?.note.en;
    if (!source?.trim() || this.translatingFields.has(fieldKey)) return;

    this.translatingFields.add(fieldKey);
    this.editError = '';
    try {
      const response = await firstValueFrom(
        this.http.post<{ data: { translations: string[] } }>(`${this.apiBase}/admin/manage/translate`, { texts: [source] })
      );
      const translations = response.data?.translations;
      if (!Array.isArray(translations) || translations.length !== 1 || typeof translations[0] !== 'string' || !translations[0].trim()) {
        this.editError = 'Translation returned an empty or incomplete result. Your existing translation has not changed.';
        return;
      }
      const translated = translations[0];
      if (field === 'question') d.text.as = translated;
      else if (field === 'explanation') d.explanation.as = translated;
      else if (field === 'option' && option) option.text.as = translated;
      else if (field === 'optionNote' && option) option.note.as = translated;
    } catch (error: any) {
      this.editError = error?.error?.message ?? 'Translation failed. Try again.';
    } finally {
      this.translatingFields.delete(fieldKey);
    }
  }

  ngOnInit(): void {
    firstValueFrom(this.http.get<{ data: Array<{ name: string }> }>(`${this.apiBase}/admin/manage/exams`))
      .then((res) => (this.exams = res.data.map((exam) => exam.name)))
      .catch(() => this.snack.open('Could not load exams. Reload the page to try again.', 'Close'));
    firstValueFrom(this.http.get<{ data: Array<{ name: string }> }>(`${this.apiBase}/admin/manage/categories`))
      .then((res) => (this.categories = res.data.map((c) => c.name)))
      .catch(() => undefined);
    this.loadCount();
    this.loadDrafts();
  }

  ngOnDestroy(): void {
    this.presence.setActiveSet(null);
  }

  initial(name: string): string {
    return (name.trim()[0] ?? '?').toUpperCase();
  }

  // Other admins currently working on the given set.
  editorsOf(title: string) {
    const me = this.auth.userSignal()?.id;
    return this.presence.admins().filter((a) => a.activeSet === title && a.userId !== me);
  }

  private async loadDrafts(select?: string) {
    try {
      const response = await firstValueFrom(
        this.http.get<{ data: Array<{ id: string; record: unknown; setTitle: string; fileName: string }> }>(`${this.apiBase}/admin/questions/drafts`)
      );
      this.allDrafts = response.data;
      const titles = [...new Set(response.data.map((draft) => draft.setTitle))];
      this.sets = titles.map((title) => ({ title, count: response.data.filter((d) => d.setTitle === title).length }));
      if (select) this.activeSet = select;
      if (!titles.includes(this.activeSet)) this.activeSet = titles[0] ?? '';
      this.showActiveSet();
    } catch {
      this.snack.open('Could not load saved drafts.', 'Close');
    }
  }

  private showActiveSet() {
    const items = this.allDrafts.filter((draft) => draft.setTitle === this.activeSet);
    this.draftIds = items.map((draft) => draft.id);
    this.records = items.map((draft) => draft.record);
    this.refreshPreview();
    this.presence.setActiveSet(this.activeSet);
  }

  selectSet(title: string) {
    this.activeSet = title;
    this.renaming = false;
    this.confirmingDelete = false;
    this.summary = null;
    this.cancelEdit();
    this.showActiveSet();
  }

  startRename() {
    this.renameValue = this.activeSet;
    this.confirmingDelete = false;
    this.renaming = true;
  }

  async renameSet() {
    const to = this.renameValue.trim();
    if (!to || to === this.activeSet) {
      this.renaming = false;
      return;
    }
    try {
      await firstValueFrom(this.http.post(`${this.apiBase}/admin/questions/drafts/rename-set`, { from: this.activeSet, to }));
      this.renaming = false;
      await this.loadDrafts(to);
      this.snack.open(`Renamed to "${to}".`, 'Close', { duration: 3000 });
    } catch (error: any) {
      this.snack.open(error?.error?.message ?? 'Could not rename set.', 'Close');
    }
  }

  async deleteSet() {
    try {
      await firstValueFrom(this.http.post(`${this.apiBase}/admin/questions/drafts/delete-set`, { title: this.activeSet }));
      this.confirmingDelete = false;
      await this.loadDrafts();
      this.snack.open('Draft set deleted.', 'Close', { duration: 3000 });
    } catch (error: any) {
      this.snack.open(error?.error?.message ?? 'Could not delete set.', 'Close');
    }
  }

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.summary = null;
    this.cancelEdit();
    if (!file) return;

    const setTitle = this.newSetTitle.trim() || file.name.replace(/\.json$/i, '');
    if (!setTitle) {
      this.snack.open('Enter a title for this set first.', 'Close');
      input.value = '';
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      this.snack.open('File is larger than 5 MB.', 'Close');
      input.value = '';
      return;
    }

    let list: unknown[];
    try {
      const parsed = JSON.parse(await file.text());
      list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : [parsed];
      if (!list.length) throw new Error('empty');

      if (list.some((item: unknown) => !item || typeof item !== 'object' || Array.isArray(item))) throw new Error('shape');
    } catch {
      this.snack.open('Not a valid JSON file of questions.', 'Close');
      input.value = '';
      return;
    }

    // Saved to the staging area first so nothing is lost if the admin leaves before finishing.
    try {
      await firstValueFrom(this.http.post(`${this.apiBase}/admin/questions/drafts`, { questions: list, fileName: file.name, setTitle }));
      this.newSetTitle = '';
      await this.loadDrafts(setTitle);
      this.snack.open(`${list.length} question(s) saved to "${setTitle}".`, 'Close', { duration: 3000 });
    } catch (error: any) {
      this.snack.open(error?.error?.message ?? 'Could not save drafts.', 'Close');
    }
    input.value = '';
  }

  // Publishes every draft, or only the complete ones, into the main question set.
  async upload(onlyValid = false) {
    if (!this.records.length || this.uploading || this.translatingOptions.size) return;
    if (!onlyValid && this.incompleteCount) return;
    const ids = onlyValid ? this.draftIds.filter((_, i) => !this.preview[i]?.issues.length) : [...this.draftIds];
    await this.publish(ids);
  }

  async uploadOne(index: number) {
    if (this.uploading || this.translatingOptions.size || this.preview[index]?.issues.length || !this.draftIds[index]) return;
    await this.publish([this.draftIds[index]]);
  }

  private async publish(ids: string[]) {
    if (!ids.length) return;
    this.uploading = true;
    try {
      const response = await firstValueFrom(
        this.http.post<{ data: ImportSummary }>(`${this.apiBase}/admin/questions/drafts/publish`, { ids })
      );
      this.summary = response.data;
      this.cancelEdit();
      await this.loadDrafts();
      this.loadCount();
    } catch (error: any) {
      this.snack.open(error?.error?.message ?? 'Upload failed.', 'Close');
    } finally {
      this.uploading = false;
    }
  }

  get validCount(): number {
    return this.preview.length - this.incompleteCount;
  }

  logout() {
    this.auth.logout();
  }

  edit(index: number) {
    if (this.translatingOptions.size) return;
    this.imageLoading = false;
    const record: any = this.records[index];
    this.editIndex = index;
    this.editError = '';
    this.editMode = 'form';
    this.json = JSON.stringify(record, null, 2);
    this.draft = this.toDraft(record);
  }

  private toDraft(record: any): Draft {
    const content = record?.content ?? record ?? {};
    const options: any[] = content.options ?? record?.options ?? [];
    return {
      id: record?.id ?? record?.questionId ?? '',
      referenceImage: record?.referenceImage ?? null,
      text: this.toLangs(content.questionText ?? record?.questionText),
      options: options.map((option, i) => {
        const id = option?.id ?? '';
        const entry = (record?.answerKey?.optionExplanations ?? []).find((item: any) => item?.optionId === (id || String.fromCharCode(65 + i)));
        return { id, text: this.toLangs(option?.text), note: this.toLangs(entry?.explanation ?? option?.explanation) };
      }),
      correct: [...(record?.answerKey?.correctOptionIds ?? [])],
      explanation: this.toLangs(record?.answerKey?.explanation ?? record?.explanation),
      difficulty: record?.classification?.difficulty ?? record?.difficulty ?? '',
      subjects: this.readSubjects(record),
      exams: [...new Set([record?.classification?.exams, record?.classification?.exam, record?.exams,
        record?.classification?.examCategories, record?.examCompatibility?.eligibleExamIds]
        .flat(2).filter((value): value is string => typeof value === 'string'))],
      tagState: readTags(content.tags ?? record?.classification?.tags ?? record?.tags)
    };
  }

  private readSubjects(record: any): string[] {
    const raw = [record?.classification?.subjects, record?.classification?.categories, record?.categories, record?.subject]
      .flat(2)
      .filter((value): value is string => typeof value === 'string');
    return [...new Set(raw.filter((value) => this.categories.includes(value)))];
  }

  toggleSubject(name: string) {
    if (!this.draft) return;
    const list = this.draft.subjects;
    const at = list.indexOf(name);
    if (at >= 0) list.splice(at, 1);
    else list.push(name);
  }

  toggleExam(name: string) {
    if (!this.draft) return;
    const index = this.draft.exams.indexOf(name);
    if (index >= 0) this.draft.exams.splice(index, 1);
    else this.draft.exams.push(name);
  }

  // Lists what is still missing; a language counts as required once its question text is filled in.
  missing(draft: Draft | null): string[] {
    if (!draft) return ['Question'];
    const issues: string[] = [];
    const langs = (['en', 'as'] as const).filter((l) => draft.text[l].trim());
    if (!draft.id.trim()) issues.push('ID');
    if (!langs.length) issues.push('Question text');
    if (draft.options.length < 2) issues.push('At least 2 options');
    if (draft.options.some((o) => !o.id.trim() || langs.some((l) => !o.text[l].trim()))) issues.push('Option text');
    if (!draft.correct.some((id) => draft.options.some((o) => o.id === id))) issues.push('Correct answer');
    if (!draft.difficulty) issues.push('Difficulty');
    if (!draft.subjects.some((s) => this.categories.includes(s))) issues.push('Subject (select at least one)');
    if (pyqIncomplete(draft.tagState)) issues.push('Previous-year exam and paper (both)');
    return issues;
  }

  get draftIssues(): string[] {
    return this.missing(this.draft);
  }

  get incompleteCount(): number {
    return this.preview.filter((row) => row.issues.length).length;
  }

  cancelEdit() {
    this.editIndex = null;
    this.draft = null;
    this.imageLoading = false;
  }

  toggleCorrect(id: string) {
    if (!this.draft) return;
    const list = this.draft.correct;
    const at = list.indexOf(id);
    if (at >= 0) list.splice(at, 1);
    else list.push(id);
  }

  switchMode(mode: 'form' | 'json') {
    if (mode === this.editMode || this.editIndex === null || this.imageLoading) return;
    this.editError = '';
    if (mode === 'json') {
      this.json = JSON.stringify(this.applyDraft(), null, 2);
    } else {
      try {
        this.records[this.editIndex] = JSON.parse(this.json);
      } catch {
        this.editError = 'Fix the JSON before switching to the form.';
        return;
      }
      this.edit(this.editIndex);
    }
    this.editMode = mode;
  }

  async saveEdit() {
    if (this.editIndex === null || this.imageLoading) return;
    let updated: unknown;
    if (this.editMode === 'json') {
      try {
        updated = JSON.parse(this.json);
      } catch {
        this.editError = 'Invalid JSON.';
        return;
      }
      if (!updated || typeof updated !== 'object' || Array.isArray(updated)) {
        this.editError = 'A question must be a JSON object.';
        return;
      }
    } else {
      updated = this.applyDraft();
    }
    const index = this.editIndex;
    try {
      await firstValueFrom(this.http.put(`${this.apiBase}/admin/questions/drafts/${this.draftIds[index]}`, { record: updated }));
    } catch (error: any) {
      this.editError = error?.error?.message ?? 'Could not save changes.';
      return;
    }
    this.records[index] = updated;
    const cached = this.allDrafts.find((draft) => draft.id === this.draftIds[index]);
    if (cached) cached.record = updated;
    this.cancelEdit();
    this.refreshPreview();
  }

  async remove(index: number) {
    if (this.translatingOptions.has(this.draftIds[index])) return;
    try {
      await firstValueFrom(this.http.delete(`${this.apiBase}/admin/questions/drafts/${this.draftIds[index]}`));
    } catch (error: any) {
      this.snack.open(error?.error?.message ?? 'Could not remove draft.', 'Close');
      return;
    }
    this.cancelEdit();
    await this.loadDrafts();
  }

  private toLangs(value: unknown): LangText {
    if (typeof value === 'string') return { en: value, as: '' };
    const object = (value ?? {}) as Partial<LangText>;
    return { en: object.en ?? '', as: object.as ?? '' };
  }

  private fromLangs(original: unknown, value: LangText): string | Partial<LangText> {
    if (typeof original === 'string' && !value.as.trim()) return value.en;
    const result: Partial<LangText> = {};
    if (value.en.trim()) result.en = value.en;
    if (value.as.trim()) result.as = value.as;
    return result;
  }

  private applyDraft(): any {
    const draft = this.draft!;
    const record: any = structuredClone(this.records[this.editIndex!] ?? {});
    const content = record.content ?? record;
    record.referenceImage = draft.referenceImage;

    if (draft.id) {
      if ('questionId' in record && !('id' in record)) record.questionId = draft.id;
      else record.id = draft.id;
    }
    content.questionText = this.fromLangs(content.questionText ?? record.questionText, draft.text);

    const originalOptions: any[] = content.options ?? record.options ?? [];
    const options = draft.options.map((option, i) => {
      const { explanation: _legacy, ...rest } = originalOptions[i] ?? {};
      return { ...rest, id: option.id, text: this.fromLangs(originalOptions[i]?.text, option.text) };
    });
    content.options = options;

    record.answerKey = { ...(record.answerKey ?? {}), correctOptionIds: draft.correct };
    const optionExplanations = draft.options
      .map((option, i) => ({ option, i }))
      .filter(({ option }) => option.note.en.trim() || option.note.as.trim())
      .map(({ option, i }) => ({
        optionId: option.id,
        isCorrect: draft.correct.includes(option.id),
        explanation: this.fromLangs(originalOptions[i]?.explanation, option.note)
      }));
    if (optionExplanations.length) record.answerKey.optionExplanations = optionExplanations;
    else delete record.answerKey.optionExplanations;
    if (draft.explanation.en || draft.explanation.as || record.answerKey.explanation !== undefined) {
      record.answerKey.explanation = this.fromLangs(record.answerKey.explanation, draft.explanation);
    }

    if (record.classification) {
      record.classification.difficulty = draft.difficulty;
      record.classification.subjects = [...draft.subjects];
      record.classification.categories = [...draft.subjects];
    } else {
      record.difficulty = draft.difficulty;
      record.subject = draft.subjects[0] ?? '';
      record.categories = [...draft.subjects];
    }

    record.exams = [...draft.exams];
    if (record.classification) {
      record.classification.exams = [...draft.exams];
      record.classification.exam = [...draft.exams];
      record.classification.examCategories = [...draft.exams];
    }
    if (record.examCompatibility) record.examCompatibility.eligibleExamIds = [...draft.exams];

    // The importer reads content.tags first, then classification.tags, so keep both in step.
    const tags = buildTags(draft.tagState);
    if (record.classification) record.classification.tags = tags;
    if (!record.classification || Array.isArray(content.tags)) content.tags = tags;
    return record;
  }

  private refreshPreview() {
    this.preview = this.records.map((item) => {
      const draft = this.toDraft(item);
      const languages = [draft.text.en.trim() ? 'English' : '', draft.text.as.trim() ? 'Assamese' : ''].filter(Boolean);
      return {
        id: draft.id || '-',
        text: draft.text,
        options: draft.options,
        answers: draft.correct.map((id) => ({
          id,
          text: draft.options.find((option) => option.id === id)?.text ?? { en: '', as: '' }
        })),
        explanation: draft.explanation,
        subject: draft.subjects.join(', ') || '-',
        difficulty: draft.difficulty || '-',
        language: languages.join(' + ') || '-',
        exams: draft.exams.join(', ') || '-',
        issues: this.missing(draft)
      };
    });
  }

  private async loadCount() {
    try {
      const response = await firstValueFrom(this.http.get<{ data: { total: number } }>(`${this.apiBase}/admin/questions/count`));
      this.totalQuestions = response.data.total;
    } catch {
      this.totalQuestions = null;
    }
  }

  private get apiBase(): string {
    return environment.apiUrl;
  }
}
