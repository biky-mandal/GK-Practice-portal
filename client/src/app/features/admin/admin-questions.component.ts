import { Component, OnInit, inject } from '@angular/core';
import { AdminApi, Page, VerificationInput, VerificationReport } from './admin.api';
import { ADMIN_STYLES } from './admin-styles';
import { EDITOR_STYLES } from './editor-styles';
import { MOCK_NUMBERS, PYQ_PAPERS, PYQ_YEARS, TagState, buildTags, pyqIncomplete, readTags } from './pyq-tags';

interface Row {
  id: string;
  questionId: string | null;
  questionText: string;
  questionTextEn: string | null;
  questionTextAs: string | null;
  languages: string[];
  categories: string[];
  exams: string[];
  difficulty: string;
  isActive: boolean;
}

interface EditOption {
  en: string;
  as: string;
  enNote: string;
  asNote: string;
}

interface EditState {
  id: string;
  referenceImage: string | null;
  questionId: string | null;
  hasEn: boolean;
  hasAs: boolean;
  text: { en: string; as: string };
  explanation: { en: string; as: string };
  misconceptions: { en: string; as: string };
  options: EditOption[];
  correctOption: number;
  categories: string[];
  exams: string[];
  difficulty: string;
  subject: string;
  topic: string;
  tagState: TagState;
  isActive: boolean;
}

@Component({
  selector: 'app-admin-questions',
  template: `
    <div class="card">
      <h2>Questions</h2>
      <div class="toolbar">
        <label class="language-toggle">
          <span [class.selected]="!showAssamese">English</span>
          <input type="checkbox" role="switch" aria-label="Show Assamese question text" [(ngModel)]="showAssamese" />
          <span class="switch-track" aria-hidden="true"></span>
          <span [class.selected]="showAssamese">Assamese</span>
        </label>
        <input class="search" placeholder="Search text or id" [(ngModel)]="filters.search" (keyup.enter)="load(1)" />
        <select [(ngModel)]="filters.exam" (change)="load(1)">
          <option value="">All exams</option><option *ngFor="let e of exams" [value]="e">{{ e }}</option>
        </select>
        <select [(ngModel)]="filters.category" (change)="load(1)">
          <option value="">All categories</option><option *ngFor="let c of categoryNames" [value]="c">{{ c }}</option>
        </select>
        <select [(ngModel)]="filters.status" (change)="load(1)">
          <option value="">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option>
        </select>
        <button class="btn primary" (click)="load(1)">Search</button>
      </div>

      <section class="bulk-editor" *ngIf="selectedIds.length">
        <div class="bulk-header">
          <strong>{{ selectedIds.length }} question{{ selectedIds.length === 1 ? '' : 's' }} selected</strong>
          <button type="button" class="btn small" [disabled]="bulkSaving" (click)="clearSelection()">Clear selection</button>
        </div>
        <p class="muted">Choose only the fields you want to change. Unselected metadata will be left as-is.</p>
        <label class="bulk-check"><input type="checkbox" [(ngModel)]="applyCategories" [ngModelOptions]="{standalone: true}" /> Replace categories</label>
        <div class="chips" *ngIf="applyCategories">
          <button type="button" class="chip" *ngFor="let c of categoryNames" [class.on]="bulkCategories.includes(c)" (click)="toggleIn(bulkCategories, c)">{{ c }}</button>
        </div>
        <label class="bulk-check"><input type="checkbox" [(ngModel)]="applyExams" [ngModelOptions]="{standalone: true}" /> Replace exams</label>
        <div class="chips" *ngIf="applyExams">
          <button type="button" class="chip" *ngFor="let x of exams" [class.on]="bulkExams.includes(x)" (click)="toggleIn(bulkExams, x)">{{ x }}</button>
        </div>
        <div class="two">
          <label class="field">Difficulty
            <select [(ngModel)]="bulkDifficulty" [ngModelOptions]="{standalone: true}">
              <option value="">No change</option><option *ngFor="let d of difficulties" [value]="d">{{ d }}</option>
            </select>
          </label>
          <label class="field">Status
            <select [(ngModel)]="bulkStatus" [ngModelOptions]="{standalone: true}">
              <option value="">No change</option><option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
          </label>
        </div>
        <label class="bulk-check"><input type="checkbox" [(ngModel)]="applyTags" [ngModelOptions]="{standalone: true}" /> Replace tags</label>
        <div *ngIf="applyTags">
          <div class="two">
            <label class="field">Previous year exam
              <select [(ngModel)]="bulkTagState.year" [ngModelOptions]="{standalone: true}">
                <option value="">Not a previous-year question</option>
                <option *ngFor="let y of pyqYears" [value]="y">ADRE {{ y }}</option>
              </select>
            </label>
            <label class="field">Previous year paper
              <select [(ngModel)]="bulkTagState.paper" [ngModelOptions]="{standalone: true}">
                <option value="">Not a previous-year question</option>
                <option *ngFor="let p of pyqPapers" [value]="p.id">{{ p.label }}</option>
              </select>
            </label>
          </div>
          <label class="field">Mock test
            <select [(ngModel)]="bulkTagState.mock" [ngModelOptions]="{standalone: true}">
              <option value="">Not a mock-test question</option>
              <option *ngFor="let n of mockNumbers" [value]="n">Mock {{ n }}</option>
            </select>
          </label>
          <label class="field">Other tags (comma separated)<input [(ngModel)]="bulkTagState.other" [ngModelOptions]="{standalone: true}" /></label>
          <p class="error" *ngIf="bulkTagsIncomplete">Select both a previous-year exam and paper, or neither.</p>
        </div>
        <p class="error" *ngIf="bulkError">{{ bulkError }}</p>
        <div class="bulk-actions">
          <button type="button" class="btn primary" [disabled]="bulkSaving || !canApplyBulk" (click)="applyBulkChanges()">{{ bulkSaving ? 'Updating...' : 'Apply to selected questions' }}</button>
        </div>
      </section>
      <p class="ok" *ngIf="notice">{{ notice }}</p>

      <div class="scroll">
        <table>
          <tr><th><input type="checkbox" aria-label="Select all questions on this page" [checked]="allPageSelected" (change)="setPageSelection($event)" /></th><th>Question</th><th>Categories</th><th>Exam</th><th>Level</th><th>Status</th><th></th></tr>
          <tr *ngFor="let q of data?.items">
            <td><input type="checkbox" [attr.aria-label]="'Select question ' + (q.questionId ?? q.id)" [checked]="selectedIds.includes(q.id)" (change)="setQuestionSelection(q.id, $event)" /></td>
            <td style="max-width: 360px">
              <div [attr.lang]="showAssamese ? (q.questionTextAs ? 'as' : null) : (q.questionTextEn ? 'en' : null)">{{ (showAssamese ? q.questionTextAs : q.questionTextEn) || q.questionText }}</div>
              <small class="muted" *ngIf="showAssamese ? !q.questionTextAs : !q.questionTextEn">{{ showAssamese ? 'Assamese' : 'English' }} text unavailable; showing original text.</small>
              <small class="muted">{{ q.questionId }}</small>
            </td>
            <td><span class="badge purple" *ngFor="let c of q.categories">{{ c }}</span></td>
            <td><span class="badge" *ngFor="let e of q.exams">{{ e }}</span></td>
            <td>{{ q.difficulty }}</td>
            <td><span class="badge" [class.green]="q.isActive" [class.red]="!q.isActive">{{ q.isActive ? 'Active' : 'Inactive' }}</span></td>
            <td class="actions-cell">
              <div class="actions">
                <button type="button" class="table-icon-btn" aria-label="Edit question" title="Edit question" (click)="open(q.id)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>
                </button>
                <button type="button" class="table-icon-btn" [attr.aria-label]="q.isActive ? 'Deactivate question' : 'Activate question'" [attr.title]="q.isActive ? 'Deactivate question' : 'Activate question'" (click)="toggle(q)">
                  <svg *ngIf="q.isActive" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path><path d="M1 1l22 22"></path></svg>
                  <svg *ngIf="!q.isActive" viewBox="0 0 24 24" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                </button>
                <button type="button" class="table-icon-btn danger" aria-label="Delete question" title="Delete question" (click)="remove(q)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 14H6L5 6"></path><path d="M10 11v5M14 11v5"></path></svg>
                </button>
              </div>
            </td>
          </tr>
        </table>
        <div class="empty" *ngIf="data && !data.items.length">No questions match.</div>
      </div>
      <div class="pager" *ngIf="data">
        <span>{{ data.total }} questions</span>
        <label>Questions per page
          <select [(ngModel)]="pageSize" (change)="load(1)" [disabled]="loading">
            <option *ngFor="let size of pageSizes" [ngValue]="size">{{ size }}</option>
            <option value="all">All</option>
          </select>
        </label>
        <button class="btn small" [disabled]="loading || page === 1" (click)="load(page - 1)">Previous</button>
        <span>Page {{ page }} of {{ totalPages }}</span>
        <button class="btn small" [disabled]="loading || page >= totalPages" (click)="load(page + 1)">Next</button>
      </div>
      <p class="muted" *ngIf="loading" role="status">Loading questions...</p>
      <p class="error" *ngIf="error">{{ error }}</p>
    </div>

    <div class="backdrop" *ngIf="edit" (click)="edit = null"></div>
    <div class="editor" *ngIf="edit as e" role="dialog" aria-modal="true" aria-label="Edit question" (keydown.escape)="edit = null">
      <h3>
        <span>Editing {{ e.questionId }}</span>
        <span class="header-actions">
          <button type="button" mat-flat-button color="primary" [disabled]="saving || imageLoading || missing(e).length > 0" (click)="save()">{{ saving ? 'Saving...' : 'Apply changes' }}</button>
          <button type="button" mat-button (click)="edit = null">Cancel</button>
        </span>
      </h3>

      <div class="two">
        <label class="field" *ngIf="e.hasEn">Question (English)<textarea class="question-text" [(ngModel)]="e.text.en" name="qen"></textarea></label>
        <div class="field" *ngIf="e.hasAs">
          <span class="field-title-row">Question (Assamese)
            <button type="button" class="translate-field-btn" aria-label="Translate question to Assamese" title="Translate question" [disabled]="isTranslating('question') || !e.text.en.trim()" (click)="translateField('question')">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h8M9 6v2c0 4-2 6-5 8"></path><path d="M7 12c1 2 3 3 5 4"></path><path d="m14 18 3.5-8 3.5 8M15.5 15h4"></path></svg>
            </button>
          </span>
          <textarea class="question-text" lang="as" [(ngModel)]="e.text.as" name="qas"></textarea>
        </div>
      </div>

      <app-reference-image-upload [(value)]="e.referenceImage" [disabled]="saving" (loadingChange)="imageLoading = $event"></app-reference-image-upload>

      <h4>Options (select the correct answer)</h4>
      <div class="opt" *ngFor="let o of e.options; let i = index">
        <input type="radio" name="correct" [checked]="e.correctOption === i" (change)="e.correctOption = i" [attr.aria-label]="'Correct option ' + letter(i)" />
        <strong>{{ letter(i) }}</strong>
        <input *ngIf="e.hasEn" placeholder="English" [(ngModel)]="o.en" [name]="'oen' + i" />
        <span class="assamese-input-row" *ngIf="e.hasAs">
          <input lang="as" placeholder="Assamese" [(ngModel)]="o.as" [name]="'oas' + i" />
          <button type="button" class="translate-field-btn" [attr.aria-label]="'Translate option ' + letter(i) + ' to Assamese'" [attr.title]="'Translate option ' + letter(i)" [disabled]="isTranslating('option-' + i) || !o.en.trim()" (click)="translateField('option', i)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h8M9 6v2c0 4-2 6-5 8"></path><path d="M7 12c1 2 3 3 5 4"></path><path d="m14 18 3.5-8 3.5 8M15.5 15h4"></path></svg>
          </button>
        </span>
      </div>
      <div class="row-actions">
        <button type="button" mat-button [disabled]="e.options.length >= 6" (click)="addOption()">Add option</button>
      </div>

      <section class="verification" aria-label="AI answer verification">
        <h4>AI answer verification</h4>
        <p class="muted">Sends the selected language's question and options to OpenAI for paid web research. AI can be wrong: review the evidence before changing an answer. Other translations are not checked.</p>
        <div class="two">
          <label class="field">Language to verify
            <select [(ngModel)]="verificationLanguage" name="verificationLanguage" [disabled]="verifying || verificationLoading">
              <option *ngIf="e.hasEn" value="en">English</option>
              <option *ngIf="e.hasAs" value="as">Assamese</option>
            </select>
          </label>
          <label class="field">As of date (optional)
            <input type="date" [(ngModel)]="verificationDate" name="verificationDate" [disabled]="verifying || verificationLoading" />
          </label>
        </div>
        <p class="muted">For previous-year or current-affairs questions, set the intended reference date.</p>
        <p class="muted" *ngIf="verificationLoading" role="status">Loading saved verification...</p>
        <p class="error" *ngIf="verificationConfigured === false">Not configured. Ask the server administrator to set OPENAI_API_KEY and restart the backend.</p>
        <button type="button" mat-stroked-button [disabled]="verifying || verificationLoading || verificationConfigured !== true || !canVerify" (click)="verifyAnswer()">{{ verifying ? 'Researching sources...' : 'Verify answer with AI' }}</button>
        <p *ngIf="verifying" class="muted" role="status">This may take up to about two minutes. No answer will be changed automatically.</p>
        <p class="error" *ngIf="verificationError" role="alert">{{ verificationError }}</p>
        <button type="button" mat-button *ngIf="verificationConfigured === null && !verificationLoading" (click)="loadVerification(e)">Retry loading verification</button>
        <p class="ok" *ngIf="verificationNotice" role="status">{{ verificationNotice }}</p>
        <article *ngIf="verificationReport as report" class="verification-report" aria-label="Verification report">
          <p><strong>{{ verificationLabels[report.result.verdict] }}</strong></p>
          <p class="error" *ngIf="verificationStale">Stale report: the question, options, selected answer, language or reference date differs from what was checked. Verify again before applying a suggestion.</p>
          <p class="muted">Checked {{ report.result.checkedAt | date:'medium' }} · {{ report.result.model }} · {{ report.input.language === 'en' ? 'English' : 'Assamese' }}{{ report.input.asOfDate ? ' · As of ' + report.input.asOfDate : '' }}</p>
          <p>Checked answer: {{ letter(report.input.correctOption) }} — {{ report.input.options[report.input.correctOption] }}</p>
          <p *ngIf="report.result.suggestedOption !== null">Suggested answer: {{ letter(report.result.suggestedOption) }} — {{ report.input.options[report.result.suggestedOption] }}</p>
          <p class="verification-explanation">{{ report.result.explanation }}</p>
          <h5>Sources and AI evidence summaries</h5>
          <p *ngIf="!report.result.sources.length" class="muted">No corroborated sources returned. This is not a verified answer.</p>
          <ol>
            <li *ngFor="let source of report.result.sources">
              <a [href]="source.url" target="_blank" rel="noopener noreferrer">{{ source.title }}</a>
              <p>{{ source.evidence }}</p>
            </li>
          </ol>
          <button type="button" mat-stroked-button *ngIf="report.result.verdict === 'likely_incorrect'" [disabled]="verificationStale || verifying || saving" (click)="applyVerifiedAnswer()">Use suggested answer (not saved yet)</button>
        </article>
      </section>

      <h4>Option explanations (why each option is right or wrong)</h4>
      <div class="two" *ngFor="let o of e.options; let i = index">
        <label class="field" *ngIf="e.hasEn">Option {{ letter(i) }} explanation (English)<textarea [(ngModel)]="o.enNote" [name]="'nen' + i"></textarea></label>
        <div class="field" *ngIf="e.hasAs">
          <span class="field-title-row">Option {{ letter(i) }} explanation (Assamese)
            <button type="button" class="translate-field-btn" [attr.aria-label]="'Translate option ' + letter(i) + ' explanation to Assamese'" [attr.title]="'Translate option ' + letter(i) + ' explanation'" [disabled]="isTranslating('option-note-' + i) || !o.enNote.trim()" (click)="translateField('optionNote', i)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h8M9 6v2c0 4-2 6-5 8"></path><path d="M7 12c1 2 3 3 5 4"></path><path d="m14 18 3.5-8 3.5 8M15.5 15h4"></path></svg>
            </button>
          </span>
          <textarea lang="as" [(ngModel)]="o.asNote" [name]="'nas' + i"></textarea>
        </div>
      </div>

      <div class="two">
        <label class="field" *ngIf="e.hasEn">Explanation (English)<textarea [(ngModel)]="e.explanation.en" name="xen"></textarea></label>
        <div class="field" *ngIf="e.hasAs">
          <span class="field-title-row">Explanation (Assamese)
            <button type="button" class="translate-field-btn" aria-label="Translate explanation to Assamese" title="Translate explanation" [disabled]="isTranslating('explanation') || !e.explanation.en.trim()" (click)="translateField('explanation')">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h8M9 6v2c0 4-2 6-5 8"></path><path d="M7 12c1 2 3 3 5 4"></path><path d="m14 18 3.5-8 3.5 8M15.5 15h4"></path></svg>
            </button>
          </span>
          <textarea lang="as" [(ngModel)]="e.explanation.as" name="xas"></textarea>
        </div>
      </div>
      <div class="two">
        <label class="field" *ngIf="e.hasEn">Common misconceptions (English, one per line)<textarea [(ngModel)]="e.misconceptions.en" name="men"></textarea></label>
        <div class="field" *ngIf="e.hasAs">
          <span class="field-title-row">Common misconceptions (Assamese, one per line)
            <button type="button" class="translate-field-btn" aria-label="Translate misconceptions to Assamese" title="Translate misconceptions" [disabled]="isTranslating('misconceptions') || !e.misconceptions.en.trim()" (click)="translateField('misconceptions')">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h8M9 6v2c0 4-2 6-5 8"></path><path d="M7 12c1 2 3 3 5 4"></path><path d="m14 18 3.5-8 3.5 8M15.5 15h4"></path></svg>
            </button>
          </span>
          <textarea lang="as" [(ngModel)]="e.misconceptions.as" name="mas"></textarea>
        </div>
      </div>

      <h4>Classification</h4>
      <div class="chips">
        <button type="button" class="chip" *ngFor="let c of categoryNames" [class.on]="e.categories.includes(c)" (click)="toggleIn(e.categories, c)">{{ c }}</button>
      </div>
      <div class="chips">
        <button type="button" class="chip" *ngFor="let x of exams" [class.on]="e.exams.includes(x)" (click)="toggleIn(e.exams, x)">{{ x }}</button>
      </div>
      <div class="two">
        <label class="field">Difficulty
          <select [(ngModel)]="e.difficulty" name="diff">
            <option value="">Select difficulty</option>
            <option *ngFor="let l of difficulties" [value]="l">{{ l }}</option>
            <option *ngIf="e.difficulty && !difficulties.includes(e.difficulty)" [value]="e.difficulty">{{ e.difficulty }}</option>
          </select>
        </label>
        <label class="field">Status
          <select [(ngModel)]="e.isActive" name="active"><option [ngValue]="true">Active</option><option [ngValue]="false">Inactive</option></select>
        </label>
      </div>

      <h4>Tags</h4>
      <div class="two">
        <label class="field">Previous year exam
          <select [(ngModel)]="e.tagState.year" name="pyqYear">
            <option value="">Not a previous-year question</option>
            <option *ngFor="let y of pyqYears" [value]="y">ADRE {{ y }}</option>
          </select>
        </label>
        <label class="field">Previous year paper
          <select [(ngModel)]="e.tagState.paper" name="pyqPaper">
            <option value="">Not a previous-year question</option>
            <option *ngFor="let p of pyqPapers" [value]="p.id">{{ p.label }}</option>
          </select>
        </label>
      </div>
      <p class="muted">For Police and Forest content, select the Assam Police and Forest exam label. Add a Mock 1-10 tag for full-length papers; each Constable mock requires exactly 100 active questions. Exam labels keep ADRE and Police/Forest papers separate.</p>
      <label class="field">Mock test (Mock 1 to 10)
        <select [(ngModel)]="e.tagState.mock" name="mockTest">
          <option value="">Not a mock-test question</option>
          <option *ngFor="let n of mockNumbers" [value]="n">Mock {{ n }}</option>
        </select>
      </label>
      <label class="field">Other tags (comma separated)<input [(ngModel)]="e.tagState.other" name="otherTags" /></label>
      <p class="flag" *ngIf="tagsOf(e).length">Tags: {{ tagsOf(e).join(', ') }}</p>

      <p class="flag bad" *ngIf="missing(e).length">⚠ Still missing: {{ missing(e).join(', ') }}</p>
      <p class="edit-error" *ngIf="editError">{{ editError }}</p>
    </div>
  `,
  styles: [ADMIN_STYLES, EDITOR_STYLES, `
    .editor textarea.question-text { min-height: 180px; }
    .language-toggle { position: relative; display: inline-flex; align-items: center; gap: 10px; cursor: pointer; color: #5b6f86; }
    .language-toggle .selected { color: #173b5b; font-weight: 700; }
    .language-toggle input { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip-path: inset(50%); }
    .switch-track { position: relative; width: 44px; height: 24px; flex-shrink: 0; border-radius: 12px; background: #c9d6e4; transition: background 0.15s ease; }
    .switch-track::after { content: ''; position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%; background: #fff; transition: transform 0.15s ease; }
    .language-toggle input:checked + .switch-track { background: #173b5b; }
    .language-toggle input:checked + .switch-track::after { transform: translateX(20px); }
    .language-toggle input:focus-visible + .switch-track { outline: 3px solid #2a5d8f; outline-offset: 3px; }
    .editor { top: 0; right: 0; bottom: 0; left: auto; width: 40vw; max-width: none; height: 100vh; max-height: 100vh; height: 100dvh; max-height: 100dvh; transform: none; translate: 0 0; border-radius: 16px 0 0 16px; animation: question-editor-slide-in 0.22s ease-out both; }
    .editor > h3:first-child { border-radius: 16px 0 0 0; }
    .editor > .row-actions:last-child { border-radius: 0; }
    @keyframes question-editor-slide-in { from { translate: 100% 0; } to { translate: 0 0; } }
    @media (max-width: 600px) {
      .editor { width: 100vw; border-radius: 0; padding-right: 18px; padding-left: 18px; }
      .editor > h3:first-child { margin-right: -18px; margin-left: -18px; padding-right: 18px; padding-left: 18px; border-radius: 0; }
      .editor > .row-actions:last-child { margin-right: -18px; margin-left: -18px; padding-right: 18px; padding-left: 18px; }
    }
    .bulk-editor { position: fixed; z-index: 999; top: 0; right: 0; bottom: 0; display: grid; align-content: start; gap: 12px; width: 20vw; height: 100vh; height: 100dvh; box-sizing: border-box; overflow-y: auto; padding: 18px; border: 1px solid #c9d6e4; border-right: 0; border-radius: 12px 0 0 12px; background: #f8fafd; box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18); animation: bulk-editor-slide-in 0.22s ease-out both; }
    .bulk-header, .bulk-actions { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; }
    .bulk-actions .btn { width: 100%; }
    .verification { display: grid; gap: 12px; padding: 16px; border: 1px solid #c9d6e4; border-radius: 12px; background: #edf4fc; min-width: 0; }
    .verification p { margin: 0; line-height: 1.5; }
    .verification-report { display: grid; gap: 12px; min-width: 0; }
    .verification-report h5, .verification-report ol { margin: 0; }
    .verification-report ol { padding-left: 22px; }
    .verification-report li { margin-bottom: 12px; overflow-wrap: anywhere; }
    .verification-report a { color: #174e85; text-decoration: underline; }
    .verification-explanation { white-space: pre-wrap; overflow-wrap: anywhere; }
    .bulk-check { display: flex; align-items: center; gap: 8px; color: #35506b; font-size: 0.9rem; font-weight: 600; }
    .bulk-check input, table input[type="checkbox"] { width: 18px; height: 18px; accent-color: #173b5b; }
    .bulk-editor .field { margin-bottom: 4px; }
    .pager { flex-wrap: wrap; }
    @keyframes bulk-editor-slide-in { from { translate: 100% 0; } to { translate: 0 0; } }
    @media (max-width: 700px) {
      .bulk-editor { width: 100vw; border-radius: 0; }
    }
  `]
})
export class AdminQuestionsComponent implements OnInit {
  private readonly api = inject(AdminApi);

  readonly difficulties = ['Easy', 'Medium', 'Hard'];
  readonly pyqYears = PYQ_YEARS;
  readonly pyqPapers = PYQ_PAPERS;
  readonly mockNumbers = MOCK_NUMBERS;

  tagsOf(e: EditState) {
    return buildTags(e.tagState);
  }

  missing(e: EditState): string[] {
    const langs = (['en', 'as'] as const).filter((l) => (l === 'en' ? e.hasEn : e.hasAs));
    const issues: string[] = [];
    if (pyqIncomplete(e.tagState)) issues.push('Previous-year exam and paper (both)');
    if (!langs.length) issues.push('A language');
    if (langs.some((l) => !e.text[l].trim())) issues.push('Question text');
    if (e.options.some((o) => langs.some((l) => !o[l].trim()))) issues.push('Option text');
    if (!e.difficulty) issues.push('Difficulty');
    if (!e.subject) issues.push('Subject');
    return issues;
  }

  categoryNames: string[] = [];
  exams: string[] = [];
  filters = { search: '', exam: '', category: '', status: '' };
  showAssamese = false;
  data: Page<Row> | null = null;
  page = 1;
  readonly pageSizes = [20, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
  pageSize: number | 'all' = 20;
  loading = false;
  error = '';
  notice = '';
  selectedIds: string[] = [];
  applyCategories = false;
  applyExams = false;
  applyTags = false;
  bulkCategories: string[] = [];
  bulkExams: string[] = [];
  bulkDifficulty = '';
  bulkStatus: '' | 'active' | 'inactive' = '';
  bulkTagState: TagState = { year: '', paper: '', mock: '', other: '' };
  bulkError = '';
  bulkSaving = false;
  edit: EditState | null = null;
  editError = '';
  imageLoading = false;
  saving = false;
  verificationLanguage: 'en' | 'as' = 'en';
  verificationDate = '';
  verificationConfigured: boolean | null = null;
  verificationLoading = false;
  verificationReport: VerificationReport | null = null;
  verificationError = '';
  verificationNotice = '';
  readonly verificationLabels = { supported: 'Selected answer supported', likely_incorrect: 'Selected answer likely incorrect', inconclusive: 'Inconclusive — manual review required' };
  private verificationRequest: EditState | null = null;
  private readonly translatingFields = new Set<string>();

  get verifying(): boolean {
    return this.edit !== null && this.verificationRequest === this.edit;
  }

  private verificationInput(e: EditState): VerificationInput {
    return {
      language: this.verificationLanguage,
      questionText: e.text[this.verificationLanguage].trim(),
      options: e.options.map((option) => option[this.verificationLanguage].trim()),
      correctOption: e.correctOption,
      asOfDate: this.verificationDate
    };
  }

  get canVerify(): boolean {
    if (!this.edit) return false;
    const input = this.verificationInput(this.edit);
    return Boolean(input.questionText) && input.questionText.length <= 2000 &&
      input.options.length >= 2 && input.options.length <= 6 &&
      input.options.every((option) => Boolean(option) && option.length <= 500) &&
      Number.isInteger(input.correctOption) && input.correctOption >= 0 && input.correctOption < input.options.length;
  }

  get verificationStale(): boolean {
    if (!this.edit || !this.verificationReport) return true;
    const current = this.verificationInput(this.edit);
    const checked = this.verificationReport.input;
    return current.language !== checked.language || current.questionText !== checked.questionText ||
      current.correctOption !== checked.correctOption || current.asOfDate !== checked.asOfDate ||
      JSON.stringify(current.options) !== JSON.stringify(checked.options);
  }

  async loadVerification(e: EditState) {
    this.verificationLoading = true;
    this.verificationError = '';
    try {
      const data = await this.api.get<{ configured: boolean; report: VerificationReport | null }>(`/questions/${e.id}/verification`);
      if (this.edit !== e) return;
      this.verificationConfigured = data.configured;
      this.verificationReport = data.report;
      if (data.report) {
        const language = data.report.input.language;
        if (language === 'en' ? e.hasEn : e.hasAs) this.verificationLanguage = language;
        this.verificationDate = data.report.input.asOfDate;
      }
    } catch (error) {
      if (this.edit === e) this.verificationError = this.api.message(error, 'Could not load saved verification.');
    } finally {
      if (this.edit === e) this.verificationLoading = false;
    }
  }

  async verifyAnswer() {
    const e = this.edit;
    if (!e || this.verifying || !this.canVerify || this.verificationConfigured !== true) return;
    this.verificationRequest = e;
    this.verificationError = '';
    this.verificationNotice = '';
    try {
      const report = await this.api.send<VerificationReport>('post', `/questions/${e.id}/verification`, this.verificationInput(e));
      if (this.edit === e) this.verificationReport = report;
    } catch (error) {
      if (this.edit === e) this.verificationError = this.api.message(error, 'Verification failed. No answer has been changed.');
    } finally {
      if (this.verificationRequest === e) this.verificationRequest = null;
    }
  }

  applyVerifiedAnswer() {
    const report = this.verificationReport;
    if (!this.edit || !report || this.verificationStale || this.verifying || this.saving ||
      report.result.verdict !== 'likely_incorrect' || report.result.suggestedOption === null) return;
    this.edit.correctOption = report.result.suggestedOption;
    this.verificationNotice = 'Suggested answer selected. Review the explanations and translations, then use Apply changes to save.';
  }

  ngOnInit() {
    this.api.get<Array<{ name: string }>>('/exams')
      .then((list) => (this.exams = list.map((exam) => exam.name)))
      .catch((error) => (this.error = this.api.message(error, 'Could not load exams.')));
    this.api.get<Array<{ name: string }>>('/categories').then((list) => (this.categoryNames = list.map((c) => c.name))).catch(() => undefined);
    this.load(1);
  }

  letter(index: number) {
    return String.fromCharCode(65 + index);
  }

  async load(page: number) {
    if (this.loading) return;
    this.loading = true;
    this.error = '';
    this.notice = '';
    try {
      this.data = await this.api.get<Page<Row>>('/questions', { ...this.filters, page, pageSize: this.pageSize });
      this.page = this.data.page;
    } catch (e) {
      this.error = this.api.message(e);
    } finally {
      this.loading = false;
    }
  }

  get totalPages(): number {
    return this.data ? Math.max(1, Math.ceil(this.data.total / this.data.pageSize)) : 1;
  }

  get allPageSelected(): boolean {
    return Boolean(this.data?.items.length) && this.data!.items.every((question) => this.selectedIds.includes(question.id));
  }

  get canApplyBulk(): boolean {
    const hasUpdates = this.applyCategories || this.applyExams || this.applyTags || Boolean(this.bulkDifficulty) || Boolean(this.bulkStatus);
    return hasUpdates && !(this.applyTags && this.bulkTagsIncomplete);
  }

  get bulkTagsIncomplete(): boolean {
    return pyqIncomplete(this.bulkTagState);
  }

  setPageSelection(event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const pageIds = this.data?.items.map((question) => question.id) ?? [];
    this.selectedIds = checked
      ? [...new Set([...this.selectedIds, ...pageIds])]
      : this.selectedIds.filter((id) => !pageIds.includes(id));
  }

  setQuestionSelection(id: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedIds = checked
      ? [...new Set([...this.selectedIds, id])]
      : this.selectedIds.filter((selectedId) => selectedId !== id);
  }

  clearSelection() {
    this.selectedIds = [];
    this.resetBulkForm();
  }

  private resetBulkForm() {
    this.applyCategories = false;
    this.applyExams = false;
    this.applyTags = false;
    this.bulkCategories = [];
    this.bulkExams = [];
    this.bulkDifficulty = '';
    this.bulkStatus = '';
    this.bulkTagState = { year: '', paper: '', mock: '', other: '' };
    this.bulkError = '';
  }

  async applyBulkChanges() {
    if (!this.selectedIds.length || !this.canApplyBulk || (this.applyTags && pyqIncomplete(this.bulkTagState))) return;
    const updates: Record<string, unknown> = {};
    if (this.applyCategories) updates['categories'] = this.bulkCategories;
    if (this.applyExams) updates['exams'] = this.bulkExams;
    if (this.bulkDifficulty) updates['difficulty'] = this.bulkDifficulty;
    if (this.bulkStatus) updates['isActive'] = this.bulkStatus === 'active';
    if (this.applyTags) updates['tags'] = buildTags(this.bulkTagState);

    this.bulkSaving = true;
    this.bulkError = '';
    try {
      const result = await this.api.send<{ matchedCount: number }>('patch', '/questions/bulk', {
        ids: this.selectedIds,
        updates
      });
      this.selectedIds = [];
      this.resetBulkForm();
      await this.load(this.page);
      this.notice = `Updated ${result.matchedCount} question${result.matchedCount === 1 ? '' : 's'}.`;
    } catch (error) {
      this.bulkError = this.api.message(error, 'Could not update the selected questions.');
    } finally {
      this.bulkSaving = false;
    }
  }

  async toggle(q: Row) {
    try {
      await this.api.send('patch', `/questions/${q.id}/active`, { isActive: !q.isActive });
      q.isActive = !q.isActive;
    } catch (e) {
      this.error = this.api.message(e);
    }
  }

  async remove(q: Row) {
    if (!confirm('Delete this question permanently? Past test results that used it will lose its review.')) return;
    try {
      await this.api.send('delete', `/questions/${q.id}`);
      this.load(this.page);
    } catch (e) {
      this.error = this.api.message(e);
    }
  }

  async open(id: string) {
    this.editError = '';
    this.imageLoading = false;
    try {
      const q: any = await this.api.get(`/questions/${id}`);
      const en = q.localized?.en;
      const as = q.localized?.as;
      const count = Math.max(en?.options?.length ?? 0, as?.options?.length ?? 0, 2);
      this.edit = {
        id: q.id,
        referenceImage: q.referenceImage ?? null,
        questionId: q.questionId,
        hasEn: Boolean(en),
        hasAs: Boolean(as),
        text: { en: en?.questionText ?? '', as: as?.questionText ?? '' },
        explanation: { en: en?.explanation ?? '', as: as?.explanation ?? '' },
        misconceptions: { en: (en?.commonMisconceptions ?? []).join('\n'), as: (as?.commonMisconceptions ?? []).join('\n') },
        options: Array.from({ length: count }, (_, i) => ({
          en: en?.options?.[i] ?? '',
          as: as?.options?.[i] ?? '',
          enNote: en?.optionExplanations?.[i] ?? '',
          asNote: as?.optionExplanations?.[i] ?? ''
        })),
        correctOption: q.correctOption,
        categories: [...q.categories],
        exams: [...q.exams],
        difficulty: q.difficulty,
        subject: q.subject,
        topic: q.topic,
        tagState: readTags(q.tags),
        isActive: q.isActive
      };
      this.verificationLanguage = this.edit.hasEn ? 'en' : 'as';
      this.verificationDate = '';
      this.verificationConfigured = null;
      this.verificationReport = null;
      this.verificationError = '';
      this.verificationNotice = '';
      await this.loadVerification(this.edit);
    } catch (e) {
      this.error = this.api.message(e);
    }
  }

  isTranslating(field: string): boolean {
    return this.translatingFields.has(field);
  }

  async translateField(field: 'question' | 'explanation' | 'option' | 'optionNote' | 'misconceptions', index?: number) {
    const e = this.edit;
    if (!e) return;
    const fieldKey = field === 'option' ? `option-${index}` : field === 'optionNote' ? `option-note-${index}` : field;
    const option = index === undefined ? undefined : e.options[index];
    const source = field === 'question' ? e.text.en
      : field === 'explanation' ? e.explanation.en
        : field === 'option' ? option?.en
          : field === 'optionNote' ? option?.enNote
            : e.misconceptions.en;
    if (!source?.trim() || this.translatingFields.has(fieldKey)) return;

    this.translatingFields.add(fieldKey);
    this.editError = '';
    try {
      const { translations } = await this.api.send<{ translations: string[] }>('post', '/translate', { texts: [source] });
      if (!Array.isArray(translations) || translations.length !== 1 || typeof translations[0] !== 'string' || !translations[0].trim()) {
        this.editError = 'Translation returned an empty or incomplete result. Your existing translation has not changed.';
        return;
      }
      const translated = translations[0];
      if (field === 'question') e.text.as = translated;
      else if (field === 'explanation') e.explanation.as = translated;
      else if (field === 'option' && option) option.as = translated;
      else if (field === 'optionNote' && option) option.asNote = translated;
      else if (field === 'misconceptions') e.misconceptions.as = translated;
    } catch (error) {
      this.editError = this.api.message(error, 'Translation failed. Try again.');
    } finally {
      this.translatingFields.delete(fieldKey);
    }
  }

  addOption() {
    this.edit?.options.push({ en: '', as: '', enNote: '', asNote: '' });
  }

  toggleIn(list: string[], value: string) {
    const index = list.indexOf(value);
    if (index >= 0) list.splice(index, 1);
    else list.push(value);
  }

  async save() {
    const e = this.edit;
    if (!e || this.imageLoading || this.saving) return;
    this.editError = '';

    const build = (language: 'en' | 'as') => ({
      questionText: e.text[language],
      options: e.options.map((o) => o[language]),
      explanation: e.explanation[language],
      commonMisconceptions: e.misconceptions[language].split('\n').map((line) => line.trim()).filter(Boolean),
      optionExplanations: e.options.map((o) => (language === 'en' ? o.enNote : o.asNote))
    });

    this.saving = true;
    try {
      await this.api.send('put', `/questions/${e.id}`, {
        referenceImage: e.referenceImage,
        localized: { ...(e.hasEn ? { en: build('en') } : {}), ...(e.hasAs ? { as: build('as') } : {}) },
        correctOption: e.correctOption,
        categories: e.categories,
        exams: e.exams,
        difficulty: e.difficulty,
        subject: e.categories[0] ?? e.subject,
        topic: e.topic,
        tags: buildTags(e.tagState),
        isActive: e.isActive
      });
      this.edit = null;
      this.load(this.page);
    } catch (error) {
      this.editError = this.api.message(error, 'Could not save. Check that every option and the question text are filled in.');
    } finally {
      this.saving = false;
    }
  }
}
