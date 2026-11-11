import { Component, ElementRef, HostListener, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AdminApi } from './admin.api';
import { ADMIN_STYLES } from './admin-styles';
import { SimTheme, simTheme } from './simulation-theme';

interface SimCategory {
  id: string;
  name: string;
  count: number;
  active: number;
  remaining: number;
  canReset: boolean;
}

interface SimQuestion {
  id: string;
  questionId: string | null;
  questionText: string;
  options: string[];
  correctOption: number;
  explanation: string;
  referenceImage?: string | null;
  language?: 'en' | 'as';
  translation?: { questionText: string; options: string[]; explanation?: string } | null;
}

interface SimQuestionPreview {
  id: string;
  questionId: string | null;
  questionText: string;
  assameseQuestionText: string;
  options: string[];
  assameseOptions: string[];
  correctAnswer: string;
  assameseCorrectAnswer: string;
}

type ShortsPhase = 'hook' | 'question' | 'countdown' | 'answer' | 'cta';

@Component({
  selector: 'app-admin-simulation',
  host: { '[class.portrait]': 'portrait' },
  template: `
    <ng-container *ngIf="!questions.length; else running">
      <section class="picker">
        <header class="picker-head">
          <div>
            <h2>{{ portrait ? 'Shorts Simulation (9:16)' : 'Simulation' }}</h2>
            <p class="muted" *ngIf="portrait">Portrait canvas for Reels and YouTube Shorts. Record the 9:16 canvas; fullscreen keeps it centered with black space outside.</p>
            <p class="muted">Questions do not repeat within a subject across admins or languages until its history is reset. Regular and 9:16 simulations track and reset history separately. Starting reserves the entire batch, even if you end early.</p>
          </div>
          <input class="search" type="search" name="filter" [(ngModel)]="filter" placeholder="Search subjects" aria-label="Search subjects" />
        </header>

        <div class="subjects" role="radiogroup" aria-label="Subject">
          <button
            *ngFor="let c of visibleCategories; let i = index"
            type="button"
            role="radio"
            class="subject-card"
            [attr.aria-checked]="c.name === category"
            [class.selected]="c.name === category"
            [class.off]="!c.active && !c.canReset"
            [disabled]="(!c.active && !c.canReset) || starting || resetting"
            [ngStyle]="theme(c.name).vars"
            [style.animation-delay.ms]="i * 25"
            (click)="select(c)"
          >
            <span class="sc-icon">{{ theme(c.name).icon }}</span>
            <span class="sc-art" aria-hidden="true">{{ theme(c.name).icon }}</span>
            <span class="sc-check" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"></path></svg></span>
            <span class="sc-name">{{ c.name }}</span>
            <span class="sc-stats">
              <span class="sc-pill"><b>{{ c.remaining }}</b> unused</span>
              <span class="sc-total">{{ c.active }} active / {{ c.count }} total</span>
            </span>
          </button>
        </div>
        <div class="empty" *ngIf="loaded && !categories.length">No subjects yet.</div>
        <div class="empty" *ngIf="categories.length && !visibleCategories.length">No subjects match "{{ filter }}".</div>

        <label class="question-selection-toggle" *ngIf="category">
          <input type="checkbox" name="questionSelectionMode" [(ngModel)]="questionSelectionMode" (ngModelChange)="onQuestionSelectionModeChange($event)" [disabled]="starting || resetting" />
          Choose questions yourself
        </label>

        <section class="question-picker" *ngIf="category && questionSelectionMode" aria-label="Choose simulation questions">
          <header class="question-picker-head">
            <div>
              <h3>Choose questions</h3>
              <p class="muted">Select up to {{ maxCount }} unused questions. Your selected questions will be used in the simulation.</p>
            </div>
            <input class="search" type="search" name="questionFilter" [(ngModel)]="questionFilter" placeholder="Search questions" aria-label="Search available questions" />
          </header>
          <div class="question-picker-actions">
            <span role="status">{{ selectedQuestionIds.length }} selected / {{ availableQuestions.length }} available</span>
            <button type="button" class="selection-action" (click)="selectVisibleQuestions()" [disabled]="!visibleAvailableQuestions.length || selectedQuestionIds.length >= maxCount">Select visible</button>
            <button type="button" class="selection-action" (click)="clearQuestionSelection()" [disabled]="!selectedQuestionIds.length">Clear selection</button>
          </div>
          <p class="muted" *ngIf="loadingQuestions" role="status">Loading available questions...</p>
          <p class="error" *ngIf="questionListError" role="alert">{{ questionListError }}</p>
          <div class="question-table-wrap" *ngIf="!loadingQuestions && !questionListError">
            <table class="question-table">
              <thead>
                <tr>
                  <th scope="col">Select</th>
                  <th scope="col">Question (English)</th>
                  <th scope="col">Options (English)</th>
                  <th scope="col">Question (Assamese)</th>
                  <th scope="col">Options (Assamese)</th>
                  <th scope="col">Correct answer (English)</th>
                  <th scope="col">Correct answer (Assamese)</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let q of visibleAvailableQuestions">
                  <td><input type="checkbox" [checked]="selectedQuestionIds.includes(q.id)" [disabled]="!selectedQuestionIds.includes(q.id) && selectedQuestionIds.length >= maxCount" (change)="toggleQuestionSelection(q.id, $event)" [attr.aria-label]="'Select question ' + (q.questionId || q.questionText)" /></td>
                  <td>{{ q.questionText }}</td>
                  <td><ol class="preview-options"><li *ngFor="let option of q.options">{{ option }}</li></ol></td>
                  <td lang="as">{{ q.assameseQuestionText || '—' }}</td>
                  <td lang="as"><ol class="preview-options" *ngIf="q.assameseOptions.length; else noAssameseOptions"><li *ngFor="let option of q.assameseOptions">{{ option }}</li></ol><ng-template #noAssameseOptions>—</ng-template></td>
                  <td>{{ q.correctAnswer || '—' }}</td>
                  <td lang="as">{{ q.assameseCorrectAnswer || '—' }}</td>
                </tr>
                <tr *ngIf="!visibleAvailableQuestions.length">
                  <td colspan="7">{{ availableQuestions.length ? 'No questions match your search.' : 'No unused questions are available for this subject.' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <fieldset class="shorts-settings" *ngIf="portrait" [disabled]="starting || resetting">
          <legend>Shorts format</legend>
          <p class="muted">One hook → question, countdown and answer for each question → one CTA.</p>
          <div class="shorts-copy">
            <label class="lf">Hook text
              <textarea name="hookText" rows="3" [(ngModel)]="hookText"></textarea>
            </label>
            <label class="lf">CTA question
              <textarea name="ctaPrompt" rows="2" [(ngModel)]="ctaPrompt"></textarea>
            </label>
            <label class="lf">CTA follow message
              <textarea name="ctaText" rows="3" [(ngModel)]="ctaText"></textarea>
            </label>
          </div>
          <div class="shorts-timing">
            <label class="lf">Hook (sec)<input type="number" name="hookSeconds" min="1" max="600" step="1" [(ngModel)]="hookSeconds" /></label>
            <label class="lf">Question reading (sec)<input type="number" name="questionSeconds" min="1" max="600" step="1" [(ngModel)]="questionSeconds" /></label>
            <label class="lf">Answer (sec)<input type="number" name="answerSeconds" min="1" max="600" step="1" [(ngModel)]="answerSeconds" /></label>
            <label class="lf">CTA (sec)<input type="number" name="ctaSeconds" min="1" max="600" step="1" [(ngModel)]="ctaSeconds" /></label>
          </div>
          <label><input type="checkbox" name="soundEnabled" [(ngModel)]="soundEnabled" /> Countdown sound</label>
          <label><input type="checkbox" name="showExplanation" [(ngModel)]="showExplanation" /> Show answer explanation</label>
          <p class="error" *ngIf="shortsValidation" role="alert">{{ shortsValidation }}</p>
          <p class="muted" *ngIf="!shortsValidation && playbackMode === 'automatic'">Video duration: {{ shortsDuration }} seconds for {{ count }} question(s). Countdown duration is set below.</p>
          <p class="muted" *ngIf="!shortsValidation && playbackMode === 'manual'">Manual playback: use the controls to advance each phase. The question timer is optional.</p>
        </fieldset>

        <div class="launch" [class.ready]="!!category" [ngStyle]="category ? theme(category).vars : null">
          <div class="launch-subject">
            <span class="ls-icon">{{ category ? theme(category).icon : '🎯' }}</span>
            <div>
              <div class="ls-label">Subject</div>
              <div class="ls-name">{{ category || 'Select a subject' }}</div>
            </div>
          </div>
          <label class="lf" *ngIf="!questionSelectionMode">
            <span>Questions <small *ngIf="maxCount">(max {{ maxCount }})</small></span>
            <input type="number" name="count" min="1" [max]="maxCount || null" [(ngModel)]="count" (blur)="clampCount()" />
          </label>
          <div class="selected-count" *ngIf="questionSelectionMode">
            <span class="ls-label">Selected questions</span>
            <span class="ls-name">{{ selectedQuestionIds.length }}</span>
          </div>
          <label class="lf" *ngIf="portrait || playbackMode === 'automatic' || manualTimerEnabled">
            <span>{{ portrait ? 'Countdown (sec)' : 'Timer (sec)' }}</span>
            <input type="number" name="seconds" min="1" max="600" step="1" [(ngModel)]="seconds" (blur)="!portrait && clampSeconds()" />
          </label>
          <label class="lf">
            <span>Language</span>
            <select name="language" [(ngModel)]="language">
              <option value="both">English + Assamese</option>
              <option value="en">English</option>
              <option value="as">Assamese</option>
            </select>
          </label>
          <label class="voice-option">
            <input type="checkbox" name="voiceEnabled" [(ngModel)]="voiceEnabled" (ngModelChange)="onVoiceEnabledChange($event)" [disabled]="!speechSupported" />
            Read questions and answers aloud (browser voice)
          </label>
          <p class="muted voice-help" *ngIf="!speechSupported" role="status">Speech playback is not supported by this browser.</p>
          <section class="voice-settings" *ngIf="voiceEnabled && speechSupported" aria-label="Simulation voice settings">
            <label class="lf" *ngIf="language !== 'as'">
              <span>English voice</span>
              <select name="englishVoice" [(ngModel)]="englishVoiceURI">
                <option value="">Browser default</option>
                <option *ngFor="let voice of englishVoices" [value]="voice.voiceURI">{{ voice.name }} ({{ voice.lang }})</option>
              </select>
            </label>
            <div class="voice-test" *ngIf="language !== 'as'">
              <button type="button" class="selection-action" (click)="testVoice('en')" [disabled]="starting || resetting">Test English voice</button>
            </div>
            <label class="lf" *ngIf="language !== 'en'">
              <span>Assamese voice</span>
              <select name="assameseVoice" [(ngModel)]="assameseVoiceURI" [disabled]="!assameseVoices.length">
                <option value="">Browser default (Assamese)</option>
                <option *ngFor="let voice of assameseVoices" [value]="voice.voiceURI">{{ voice.name }} ({{ voice.lang }})</option>
              </select>
            </label>
            <div class="voice-test" *ngIf="language !== 'en'">
              <button type="button" class="selection-action" (click)="testVoice('as')" [disabled]="starting || resetting || !assameseVoices.length">Test Assamese voice</button>
            </div>
            <p class="muted voice-help" *ngIf="language !== 'en' && !assameseVoices.length" role="status">No Assamese voice is installed or available in this browser. Add an Assamese text-to-speech voice to your device and reload this page to test Assamese reading.</p>
            <p class="muted voice-help" *ngIf="language !== 'en' && assameseVoices.length" role="status">Assamese voice is available. Voice quality depends on your browser or device.</p>
            <p class="error" *ngIf="voiceError" role="alert">{{ voiceError }}</p>
          </section>
          <fieldset class="playback-settings" [disabled]="starting || resetting">
            <legend>Playback</legend>
            <label><input type="radio" name="playbackMode" value="automatic" [(ngModel)]="playbackMode" /> Automatic</label>
            <label><input type="radio" name="playbackMode" value="manual" [(ngModel)]="playbackMode" /> Manual</label>
            <label *ngIf="playbackMode === 'manual'"><input type="checkbox" name="manualTimerEnabled" [(ngModel)]="manualTimerEnabled" /> Show manual timer</label>
          </fieldset>
          <button class="launch-btn" type="button" (click)="start()" [disabled]="!canStart">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8Z"></path></svg>
            {{ starting ? 'Loading...' : 'Start simulation' }}
          </button>
          <button class="reset-btn" type="button" (click)="resetHistory()" [disabled]="!selectedCategory?.canReset || starting || resetting" [attr.aria-busy]="resetting">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.6 7.4M3 4v7h7"></path></svg>
            <span>{{ resetting ? 'Resetting...' : 'Reset subject history' }}</span>
          </button>
        </div>
        <p class="muted" *ngIf="category && maxCount === 0">No unused active questions remain. Reset this subject's history to use its questions again.</p>
        <p class="muted" *ngIf="notice" role="status">{{ notice }}</p>
        <p class="error" *ngIf="error">{{ error }}</p>
      </section>
    </ng-container>

    <ng-template #running>
      <div class="stage" *ngIf="current" [ngStyle]="theme(category).vars">
        <div class="bg" aria-hidden="true">
          <div class="glow g1"></div>
          <div class="glow g2"></div>
          <div class="glow g3"></div>
          <div class="watermark">{{ theme(category).icon }}</div>
        </div>

        <div class="tools" *ngIf="!portrait || !finished">
          <button type="button" class="tool" (click)="toggleFullscreen()" [attr.aria-label]="fullscreen ? 'Exit full screen' : 'Full screen'" [title]="fullscreen ? 'Exit full screen' : 'Full screen'">
            <svg *ngIf="fullscreen; else enterIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"></path></svg>
            <ng-template #enterIcon><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"></path></svg></ng-template>
          </button>
          <button type="button" class="tool danger" (click)="stop()" aria-label="End simulation" title="End simulation">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg>
          </button>
          <button *ngIf="manualTimerVisible && !waiting && !finished && !timerRunning" type="button" class="tool manual-timer-start" (click)="startManualTimer()" aria-label="Start timer" title="Start timer">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l3 2M9 2h6"></path></svg>
          </button>
          <button
            *ngIf="playbackMode === 'manual' && !waiting && !finished"
            type="button"
            class="tool manual-next"
            (click)="manualNext()"
            [attr.aria-label]="manualNextLabel"
            [title]="manualNextLabel"
          >
            <svg *ngIf="!revealed && (!portrait || phase === 'question' || phase === 'countdown'); else nextIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            <ng-template #nextIcon><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"></path></svg></ng-template>
          </button>
        </div>

        <header class="top" [class.with-manual-tools]="playbackMode === 'manual' && !waiting && !finished" *ngIf="!portrait || !finished">
          <div class="brand">
            <div class="plate"><img src="logo.png" alt="Logo" class="logo" /></div>
            <div class="meta">
              <div class="subject">{{ category }}</div>
              <div class="qcount">Question <b>{{ index + 1 }}</b> / {{ questions.length }}</div>
            </div>
          </div>
          <ng-container *ngIf="!finished && (portrait || playbackMode !== 'manual')" [ngTemplateOutlet]="countdown"></ng-container>
        </header>

        <ng-template #countdown>
          <div class="countdown" [class.timer-inactive]="portrait && (waiting || phase !== 'countdown')" [attr.aria-hidden]="portrait && (waiting || phase !== 'countdown') ? 'true' : null" [class.warn]="remaining > 0 && remaining <= 2" [class.done]="remaining === 0" [attr.aria-label]="remaining + ' seconds remaining'">
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <defs>
                <linearGradient id="simRing" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" [attr.stop-color]="theme(category).vars['--light']"></stop>
                  <stop offset="100%" [attr.stop-color]="theme(category).vars['--c1']"></stop>
                </linearGradient>
              </defs>
              <circle class="track" cx="50" cy="50" r="44"></circle>
              <circle class="ring" cx="50" cy="50" r="44" [attr.stroke-dasharray]="ringLength" [attr.stroke-dashoffset]="ringLength * (1 - timerPct / 100)"></circle>
            </svg>
            <span class="value" *ngIf="remaining > 0; else timeUp">{{ remaining }}</span>
            <ng-template #timeUp><span class="value up">Time's<br />up!</span></ng-template>
          </div>
        </ng-template>

        <div class="steps" aria-hidden="true" *ngIf="!portrait || !finished">
          <span *ngFor="let s of questions; let i = index" [class.past]="i < index || finished" [class.now]="!waiting && !finished && i === index"></span>
        </div>

        <section class="intro script-screen" *ngIf="portrait && !waiting && !finished && (phase === 'hook' || phase === 'cta')">
          <div class="intro-icon">{{ phase === 'hook' ? '🎯' : '🎉' }}</div>
          <h3 class="script-title">{{ phase === 'hook' ? hookText : ctaPrompt }}</h3>
          <p class="script-cta" *ngIf="phase === 'cta'">{{ ctaText }}</p>
        </section>

        <section class="intro" *ngIf="waiting">
          <div class="intro-icon">{{ theme(category).icon }}</div>
          <h3 class="intro-title">{{ category }}</h3>
          <div class="intro-meta">
            <span><b>{{ questions.length }}</b> questions</span>
            <span class="dot"></span>
            <span *ngIf="portrait || playbackMode === 'automatic'"><b>{{ seconds }}s</b> per question</span>
            <span *ngIf="!portrait && playbackMode === 'manual'">Manual playback</span>
            <span *ngIf="!portrait && playbackMode === 'manual' && manualTimerEnabled"> · {{ seconds }}s manual timer</span>
          </div>
          <button class="start-btn" type="button" (click)="begin()">
            <span class="start-pulse" aria-hidden="true"></span>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16l13-8Z"></path></svg>
            Start
          </button>
        </section>

        <main class="body" [class.with-reference]="!portrait && (playbackMode === 'manual' || (q.referenceImage && failedImageId !== q.id))" *ngFor="let q of (waiting || finished || (portrait && (phase === 'hook' || phase === 'cta')) ? [] : questions) | slice: index : index + 1">
          <div class="question-content">
            <h3 class="question">
              <span [attr.lang]="q.language">{{ q.questionText }}</span>
              <span *ngIf="q.translation?.questionText" class="translation" lang="as">{{ q.translation?.questionText }}</span>
            </h3>
            <ol class="options" [class.revealed]="revealed">
              <li *ngFor="let o of q.options; let i = index" [class.correct]="revealed && i === q.correctOption" [style.animation-delay.ms]="120 + i * 90">
                <span class="letter">
                  <ng-container *ngIf="revealed && i === q.correctOption; else letterTpl">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5L20 7"></path></svg>
                  </ng-container>
                  <ng-template #letterTpl>{{ letter(i) }}</ng-template>
                </span>
                <span class="text">
                  <span [attr.lang]="q.language">{{ o }}</span>
                  <span *ngIf="q.translation?.options?.[i]" class="translation" lang="as">{{ q.translation?.options?.[i] }}</span>
                </span>
              </li>
            </ol>

            <div class="explain" *ngIf="revealed && (!portrait || showExplanation) && (q.explanation || q.translation?.explanation)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2Z"></path></svg>
              <div>
                <span *ngIf="q.explanation" [attr.lang]="q.language">{{ q.explanation }}</span>
                <span *ngIf="q.translation?.explanation" class="translation" lang="as">{{ q.translation?.explanation }}</span>
              </div>
            </div>
            <p class="image-error" *ngIf="!portrait && failedImageId === q.id" role="alert">The reference image could not be displayed.</p>
          </div>
          <div class="manual-timer" *ngIf="manualTimerVisible">
            <ng-container *ngIf="timerRunning" [ngTemplateOutlet]="countdown"></ng-container>
          </div>
          <figure class="reference-image" *ngIf="!portrait && !manualTimerVisible && q.referenceImage && failedImageId !== q.id">
            <img [src]="q.referenceImage" alt="Reference image for this question" (error)="failedImageId = q.id" />
          </figure>
        </main>

        <section class="intro thanks" *ngIf="finished">
          <h3 class="intro-title" *ngIf="portrait">Thank you!</h3>
          <div class="plate" *ngIf="portrait"><img src="logo.png" alt="Let's Crack ADRE" class="logo" /></div>
          <p class="script-cta" *ngIf="portrait">Follow for More</p>
          <div class="intro-icon" *ngIf="!portrait">🎉</div>
          <h3 class="intro-title" *ngIf="!portrait">Thank you!</h3>
          <div class="intro-meta" *ngIf="!portrait">
            <span>You completed <b>{{ questions.length }}</b> {{ category }} questions</span>
          </div>
        </section>

        <footer class="controls" *ngIf="finished && !portrait">
          <button class="finish-btn" type="button" (click)="stop()">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5L20 7"></path></svg>
            Finish
          </button>
        </footer>
        <p class="voice-error" *ngIf="voiceError" role="alert">{{ voiceError }}</p>
      </div>
    </ng-template>
  `,
  styles: [ADMIN_STYLES, `
    /* ---------- subject picker ---------- */
    .picker { padding-top: 20px; }
    .picker-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 20px; }
    .picker-head h2 { margin: 0 0 4px; font-size: 1.6rem; font-weight: 800; letter-spacing: -0.01em; }
    .picker-head p { margin: 0; }
    .search { min-width: 260px; border-radius: 999px; padding: 10px 18px; }

    .subjects { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 18px; padding-bottom: 8px; }
    .subject-card {
      position: relative; overflow: hidden; isolation: isolate; text-align: left; cursor: pointer;
      display: flex; flex-direction: column; gap: 14px; min-height: 168px; padding: 18px 18px 16px;
      border: 0; border-radius: 20px; color: #fff; font: inherit;
      background: radial-gradient(120% 90% at 100% 0%, rgba(255,255,255,0.22) 0%, transparent 55%), linear-gradient(140deg, var(--c1), var(--c2));
      box-shadow: 0 6px 18px rgba(var(--c2-rgb), 0.28);
      transition: transform 0.2s ease, box-shadow 0.2s ease, filter 0.2s ease;
      animation: pop 0.4s ease-out both;
    }
    .subject-card::after { content: ''; position: absolute; inset: 0; z-index: -1; background: repeating-linear-gradient(135deg, rgba(255,255,255,0.06) 0 2px, transparent 2px 14px); }
    .subject-card:hover:not(:disabled) { transform: translateY(-4px); box-shadow: 0 14px 30px rgba(var(--c2-rgb), 0.42); }
    .subject-card:focus-visible { outline: 3px solid var(--c1); outline-offset: 3px; }
    .subject-card.selected { transform: translateY(-4px) scale(1.02); box-shadow: 0 0 0 3px #fff, 0 0 0 6px var(--c1), 0 18px 36px rgba(var(--c2-rgb), 0.55); }
    .subject-card.off { cursor: not-allowed; filter: grayscale(0.85); opacity: 0.55; }
    .sc-icon { width: 52px; height: 52px; display: grid; place-items: center; font-size: 1.7rem; border-radius: 16px; background: rgba(255,255,255,0.22); border: 1px solid rgba(255,255,255,0.35); backdrop-filter: blur(4px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.35); }
    .sc-art { position: absolute; right: -14px; bottom: -22px; z-index: -1; font-size: 6.5rem; line-height: 1; opacity: 0.18; transform: rotate(-14deg); transition: transform 0.3s ease; }
    .subject-card:hover .sc-art, .subject-card.selected .sc-art { transform: rotate(-4deg) scale(1.08); }
    .sc-check { position: absolute; top: 14px; right: 14px; width: 30px; height: 30px; display: grid; place-items: center; border-radius: 50%; background: #fff; color: var(--c2); opacity: 0; transform: scale(0.4); transition: all 0.2s ease; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
    .sc-check svg { width: 18px; height: 18px; }
    .sc-check path { stroke-width: 3; }
    .subject-card.selected .sc-check { opacity: 1; transform: scale(1); }
    .sc-name { font-size: 1.12rem; font-weight: 800; line-height: 1.25; text-shadow: 0 1px 6px rgba(0,0,0,0.18); padding-right: 30px; }
    .sc-stats { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 0.82rem; }
    .sc-pill { padding: 3px 12px; border-radius: 999px; background: rgba(255,255,255,0.92); color: var(--c2); font-weight: 600; }
    .sc-pill b { font-weight: 800; }
    .sc-total { opacity: 0.9; font-weight: 600; }
    @keyframes pop { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: none; } }

    .launch {
      --c1: #4b6584; --c2: #173b5b; --c1-rgb: 75, 101, 132; --c2-rgb: 23, 59, 91;
      position: sticky; bottom: 16px; z-index: 5; margin-top: 24px;
      display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; padding: 16px 18px; border-radius: 20px;
      background: rgba(255,255,255,0.92); backdrop-filter: blur(10px); border: 1px solid #e1e8f0;
      box-shadow: 0 12px 36px rgba(16,42,67,0.16); transition: box-shadow 0.3s ease, border-color 0.3s ease;
    }
    .launch.ready { border-color: rgba(var(--c1-rgb), 0.55); box-shadow: 0 12px 36px rgba(var(--c2-rgb), 0.25); }
    .launch-subject { display: flex; align-items: center; gap: 12px; flex: 1 1 220px; min-width: 0; }
    .ls-icon { flex: none; width: 50px; height: 50px; display: grid; place-items: center; font-size: 1.6rem; border-radius: 14px; background: linear-gradient(140deg, var(--c1), var(--c2)); box-shadow: 0 6px 16px rgba(var(--c2-rgb), 0.35); }
    .ls-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #5b6f86; }
    .ls-name { font-weight: 800; font-size: 1.05rem; color: #12304d; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lf { display: grid; gap: 4px; font-size: 0.78rem; font-weight: 700; color: #35506b; }
    .lf small { font-weight: 500; color: #5b6f86; }
    .lf input, .lf select { width: 130px; box-sizing: border-box; border-radius: 12px; padding: 9px 12px; }
    .lf select { width: 190px; }
    .lf input:focus, .lf select:focus { border-color: var(--c1); box-shadow: 0 0 0 3px rgba(var(--c1-rgb), 0.2); }
    .playback-settings { display: grid; gap: 6px; margin: 0; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 12px; color: #35506b; font-size: 0.82rem; }
    .playback-settings legend { padding: 0 4px; font-weight: 700; }
    .playback-settings label { display: flex; align-items: center; gap: 6px; cursor: pointer; }
    .question-selection-toggle { display: inline-flex; align-items: center; gap: 8px; margin: 20px 0 0; color: #12304d; font-weight: 700; cursor: pointer; }
    .question-picker { margin-top: 16px; padding: 18px; border: 1px solid #d5deea; border-radius: 16px; background: #fff; }
    .question-picker-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
    .question-picker-head h3 { margin: 0 0 4px; color: #12304d; }
    .question-picker-head p { margin: 0; }
    .question-picker-actions { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 14px 0; color: #35506b; font-size: 0.9rem; }
    .selection-action { padding: 7px 12px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; color: #12304d; font: inherit; cursor: pointer; }
    .selection-action:disabled { opacity: 0.5; cursor: not-allowed; }
    .question-table-wrap { max-height: 50vh; overflow: auto; border: 1px solid #e2e8f0; border-radius: 10px; }
    .question-table { width: 100%; border-collapse: collapse; min-width: 1200px; color: #1e293b; }
    .question-table th, .question-table td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; vertical-align: top; }
    .question-table th { position: sticky; top: 0; z-index: 1; background: #f1f5f9; color: #12304d; }
    .question-table td:first-child, .question-table th:first-child { width: 64px; text-align: center; }
    .question-table td[lang="as"] { font-family: 'Noto Sans Assamese', 'Nirmala UI', sans-serif; }
    .preview-options { margin: 0; padding-left: 20px; }
    .preview-options li + li { margin-top: 4px; }
    .selected-count { display: grid; gap: 4px; align-self: flex-end; min-width: 120px; }
    @media (max-width: 720px) { .question-picker { padding: 12px; } .question-picker-head .search { min-width: 0; width: 100%; } .question-table-wrap { max-height: 60vh; } }
    .launch-btn { display: inline-flex; align-items: center; gap: 10px; border: 0; border-radius: 999px; padding: 13px 28px; font: inherit; font-weight: 800; font-size: 1rem; color: #fff; cursor: pointer;
      background: linear-gradient(135deg, var(--c1), var(--c2)); box-shadow: 0 10px 24px rgba(var(--c2-rgb), 0.4); transition: transform 0.15s ease, box-shadow 0.15s ease; }
    .launch-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 14px 30px rgba(var(--c2-rgb), 0.5); }
    .launch-btn:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
    .launch-btn svg { width: 18px; height: 18px; }
    .launch-btn svg path { fill: currentColor; stroke: none; }
    .voice-option { display: inline-flex; align-items: center; gap: 8px; color: #35506b; font-size: 0.9rem; font-weight: 600; }
    .voice-help { flex-basis: 100%; margin: -4px 0 0; font-size: 0.82rem; }
    .voice-settings { display: flex; flex: 1 1 100%; align-items: flex-end; flex-wrap: wrap; gap: 12px; padding: 12px; border: 1px solid #d5deea; border-radius: 12px; background: #f8fafc; }
    .voice-settings .lf select { width: min(260px, 100%); }
    .voice-settings .voice-help, .voice-settings .error { flex-basis: 100%; margin: 0; }
    .voice-test { display: flex; min-height: 38px; align-items: center; }
    .reset-btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px; box-sizing: border-box;
      padding: 11px 20px; border: 1px solid #d97706; border-radius: 999px; background: #fffbeb; color: #92400e;
      font: inherit; font-size: 0.9rem; font-weight: 700; line-height: 1.4; cursor: pointer; box-shadow: 0 2px 6px rgba(146,64,14,0.1);
      transition: background 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease; }
    .reset-btn svg { flex: none; width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .reset-btn:hover:not(:disabled) { background: #fef3c7; box-shadow: 0 4px 12px rgba(146,64,14,0.18); transform: translateY(-1px); }
    .reset-btn:focus-visible { outline: 3px solid #92400e; outline-offset: 3px; }
    .reset-btn:disabled { background: #f1f5f9; border-color: #cbd5e1; color: #64748b; box-shadow: none; cursor: not-allowed; }

    /* ---------- running stage (colours come from the subject theme) ---------- */
    .stage {
      position: relative; overflow: hidden; isolation: isolate;
      display: flex; flex-direction: column; gap: clamp(14px, 2.4vh, 28px);
      min-height: 0; height: calc(100vh - 152px); box-sizing: border-box; margin-top: 16px;
      padding: clamp(20px, 3.5vh, 44px) clamp(20px, 4vw, 64px);
      border-radius: 0; color: #12304d; color-scheme: light;
      background: radial-gradient(1200px 600px at 10% -10%, rgba(var(--c1-rgb), 0.05) 0%, transparent 60%), radial-gradient(900px 500px at 110% 110%, rgba(var(--c2-rgb), 0.06) 0%, transparent 55%), linear-gradient(135deg, var(--bg0) 0%, var(--bg1) 55%, var(--bg2) 100%);
      font-family: 'Poppins', 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Arial, sans-serif;
    }
    .bg { position: absolute; inset: 0; z-index: -1; overflow: hidden; border-radius: inherit; pointer-events: none; }
    .glow { position: absolute; border-radius: 50%; filter: blur(70px); opacity: 0.08; animation: drift 9s ease-in-out infinite alternate; }
    .g1 { width: 360px; height: 360px; background: var(--c1); top: -120px; right: 18%; }
    .g2 { width: 420px; height: 420px; background: var(--c2); bottom: -180px; left: 8%; animation-delay: -4s; }
    .g3 { width: 260px; height: 260px; background: var(--light); top: 35%; left: 40%; opacity: 0.06; animation: orbit 18s linear infinite; }
    .watermark { position: absolute; right: -2vw; bottom: -6vh; font-size: min(52vh, 44vw); line-height: 1; opacity: 0.06; filter: grayscale(0.3); transform: rotate(-12deg); animation: sway 10s ease-in-out infinite; }
    @keyframes drift { from { transform: translate(0, 0) scale(1); } to { transform: translate(60px, 40px) scale(1.2); } }
    @keyframes orbit { from { transform: rotate(0deg) translateX(180px) rotate(0deg); } to { transform: rotate(360deg) translateX(180px) rotate(-360deg); } }
    @keyframes sway { 0%, 100% { transform: rotate(-12deg) translateY(0) scale(1); } 50% { transform: rotate(-4deg) translateY(-24px) scale(1.06); } }
    @media (prefers-reduced-motion: reduce) { .glow, .watermark { animation: none; } }

    .tools { position: absolute; top: 14px; right: 14px; display: flex; gap: 8px; z-index: 2; opacity: 0.8; transition: opacity 0.2s; }
    .tools:hover, .tools:focus-within { opacity: 1; }
    .tool { width: 38px; height: 38px; display: inline-flex; align-items: center; justify-content: center; border-radius: 10px; border: 1px solid #cbd5e1; background: rgba(255,255,255,0.9); color: #12304d; cursor: pointer; backdrop-filter: blur(6px); }
    .tool:hover { background: #f1f5f9; }
    .tool.danger:hover { background: #ffe4e6; color: #9f1239; border-color: #fda4af; }
    .tool.manual-next { width: 38px; min-width: 38px; padding: 0; color: #12304d; }
    .tool.manual-next svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .tool svg { width: 18px; height: 18px; }
    svg path, svg circle:not(.track):not(.ring) { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

    .top { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding-right: 96px; }
    .top.with-manual-tools { padding-right: 184px; }
    .brand { display: flex; align-items: center; gap: clamp(14px, 1.6vw, 24px); min-width: 0; }
    .plate { flex: none; background: #fff; border-radius: 16px; padding: 8px 14px; box-shadow: 0 6px 20px rgba(16,42,67,0.1); }
    .logo { display: block; height: clamp(48px, 7vh, 84px); width: auto; }
    .meta { min-width: 0; }
    .subject { font-size: clamp(1.4rem, 2.6vw, 2.6rem); font-weight: 800; line-height: 1.15; letter-spacing: -0.01em; overflow-wrap: anywhere;
      color: var(--accent); }
    .qcount { margin-top: 6px; display: inline-block; padding: 4px 14px; border-radius: 999px; background: rgba(255,255,255,0.8); border: 1px solid rgba(var(--c1-rgb), 0.3); font-size: clamp(0.85rem, 1.1vw, 1.1rem); color: #35506b; }
    .qcount b { color: #12304d; }

    .countdown { position: relative; flex: none; width: clamp(120px, 15vh, 190px); aspect-ratio: 1; display: grid; place-items: center; border-radius: 50%; background: rgba(255,255,255,0.85); box-shadow: 0 6px 24px rgba(var(--c1-rgb), 0.15); }
    .countdown svg { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
    .countdown circle { fill: none; stroke-width: 7; }
    .countdown .track { stroke: #d5deea; }
    .countdown .ring { stroke: url(#simRing); stroke-linecap: round; transition: stroke-dashoffset 1s linear; filter: drop-shadow(0 0 6px rgba(var(--c1-rgb), 0.8)); }
    .countdown .value { position: relative; font-size: clamp(3rem, 7vh, 5.2rem); font-weight: 800; color: #12304d; font-variant-numeric: tabular-nums; line-height: 1; }
    .countdown.warn { animation: pulse 1s ease-in-out infinite; box-shadow: 0 0 50px rgba(251,191,36,0.45); }
    .countdown.warn .ring { stroke: #fbbf24; filter: drop-shadow(0 0 8px rgba(251,191,36,0.8)); }
    .countdown.warn .value { color: #92400e; }
    .countdown.done { box-shadow: 0 0 50px rgba(244,63,94,0.45); }
    .countdown.done .track { stroke: #f43f5e; }
    .countdown .value.up { font-size: clamp(1rem, 2.2vh, 1.5rem); text-align: center; line-height: 1.15; color: #9f1239; text-transform: uppercase; letter-spacing: 0.04em; }
    @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }

    .steps { display: flex; gap: 6px; }
    .steps span { flex: 1; height: 6px; border-radius: 999px; background: #cbd5e1; transition: background 0.3s; }
    .steps span.past { background: linear-gradient(90deg, var(--c2), var(--c1)); }
    .steps span.now { background: linear-gradient(90deg, var(--c1), var(--light)); box-shadow: 0 0 12px rgba(var(--c1-rgb), 0.8); }

    .body { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; scrollbar-width: none; padding: 8px 6px; margin: -8px -6px; display: flex; flex-direction: column; justify-content: safe center; gap: clamp(14px, 2.6vh, 32px); animation: rise 0.45s ease-out both; }
    .body::-webkit-scrollbar { display: none; }
    .question-content { display: flex; flex-direction: column; gap: inherit; min-width: 0; }
    .body.with-reference { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: center; }
    .with-reference .options { grid-template-columns: 1fr; }
    .with-reference .question { font-size: clamp(1.5rem, 2.4vw, 2.6rem); overflow-wrap: anywhere; }
    .with-reference .options li { font-size: clamp(1.2rem, 1.6vw, 1.8rem); }
    .reference-image { margin: 0; min-width: 0; align-self: stretch; display: flex; align-items: center; justify-content: center; position: relative; }
    .reference-image img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
    .manual-timer { display: flex; align-items: center; justify-content: center; align-self: stretch; min-width: 0; min-height: 0; container-type: size; }
    .manual-timer .countdown { width: min(70cqw, 70cqh); }
    .manual-timer .countdown .value { font-size: min(21cqw, 21cqh); }
    .manual-timer .countdown .ring { filter: none; }
    .image-error { margin: 0; color: #9f1239; font-size: 0.9rem; }
    .question { margin: 0; font-size: clamp(1.85rem, 3.5vw, 3.4rem); font-weight: 700; line-height: 1.35; color: #12304d; white-space: pre-line; }
    .translation { display: block; margin-top: 0.3em; font-size: 0.85em; font-weight: 500; line-height: 1.5; color: inherit; white-space: pre-line; }
    .text { min-width: 0; overflow-wrap: anywhere; }
    .options { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(12px, 1.6vw, 20px); }
    .options li { display: flex; gap: 16px; align-items: center; padding: clamp(14px, 2vh, 22px) clamp(16px, 1.6vw, 24px); border-radius: 16px;
      background: rgba(255,255,255,0.9); border: 1px solid #cbd5e1; backdrop-filter: blur(8px);
      font-size: clamp(1.45rem, 2.3vw, 2.2rem); font-weight: 500; color: #12304d; animation: rise 0.45s ease-out both; transition: all 0.35s ease; }
    .letter { flex: none; display: inline-flex; align-items: center; justify-content: center; width: clamp(36px, 2.6vw, 48px); aspect-ratio: 1; border-radius: 12px; font-weight: 800;
      background: var(--bg1); color: var(--accent); box-shadow: 0 3px 10px rgba(var(--c2-rgb), 0.15); }
    .letter svg { width: 60%; height: 60%; }
    .letter svg path { stroke-width: 3; }
    .options.revealed li:not(.correct) { opacity: 0.4; filter: saturate(0.5); }
    .options li.correct { background: linear-gradient(135deg, #dcfce7, #d1fae5); border-color: #16a34a; color: #14532d; font-weight: 700; transform: scale(1.03); box-shadow: 0 0 0 2px rgba(22,163,74,0.2), 0 8px 24px rgba(34,197,94,0.18); }
    .options li.correct .letter { background: #15803d; color: #fff; box-shadow: 0 4px 12px rgba(34,197,94,0.2); }

    .explain { display: flex; gap: 14px; align-items: flex-start; padding: 16px 20px; border-radius: 14px; background: #fffbeb; border: 1px solid #fcd34d; color: #78350f; font-size: clamp(0.95rem, 1.3vw, 1.25rem); white-space: pre-line; animation: rise 0.4s ease-out both; }
    .explain svg { flex: none; width: 26px; height: 26px; color: #92400e; }

    .controls { display: flex; justify-content: flex-end; }
    .cta { display: inline-flex; align-items: center; gap: 10px; border: 0; border-radius: 999px; padding: 14px 30px; font: inherit; font-size: clamp(1rem, 1.3vw, 1.25rem); font-weight: 700; color: #fff; cursor: pointer;
      background: var(--accent); box-shadow: 0 10px 30px rgba(var(--c2-rgb), 0.2); transition: transform 0.15s, box-shadow 0.15s, opacity 0.2s; animation: rise 0.35s ease-out both; }
    .cta:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 14px 36px rgba(var(--c1-rgb), 0.6); }
    .cta:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; filter: grayscale(0.4); }
    .cta.finish { background: #15803d; box-shadow: 0 10px 30px rgba(34,197,94,0.2); }
    .cta svg { width: 22px; height: 22px; }

    @keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

    .intro { flex: 1; min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: clamp(12px, 2.4vh, 24px); text-align: center; animation: rise 0.5s ease-out both; }
    .intro-icon { width: clamp(90px, 14vh, 140px); aspect-ratio: 1; display: grid; place-items: center; font-size: clamp(3rem, 8vh, 5rem); border-radius: 32px;
      background: linear-gradient(140deg, var(--c1), var(--c2)); box-shadow: 0 0 0 1px rgba(255,255,255,0.2) inset, 0 20px 60px rgba(var(--c1-rgb), 0.55); animation: float 3.2s ease-in-out infinite; }
    .intro-title { margin: 0; font-size: clamp(2rem, 4.4vw, 4rem); font-weight: 800; line-height: 1.1; letter-spacing: -0.02em;
      color: var(--accent); }
    .intro-meta { display: flex; align-items: center; gap: 14px; font-size: clamp(1rem, 1.6vw, 1.4rem); color: #35506b; }
    .intro-meta b { color: #12304d; }
    .intro-meta .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c1); }
    .start-btn { position: relative; margin-top: clamp(8px, 2vh, 20px); display: inline-flex; align-items: center; gap: 14px; border: 0; border-radius: 999px;
      padding: clamp(16px, 2.4vh, 22px) clamp(40px, 4vw, 64px); font: inherit; font-size: clamp(1.3rem, 2vw, 1.9rem); font-weight: 800; letter-spacing: 0.02em; color: #fff; cursor: pointer;
      background: var(--accent); box-shadow: 0 12px 32px rgba(var(--c1-rgb), 0.2); transition: transform 0.15s ease; }
    .start-btn:hover { transform: translateY(-3px) scale(1.03); }
    .start-btn svg { width: 1.2em; height: 1.2em; }
    .start-btn svg path { fill: currentColor; stroke: none; }
    .thanks .intro-title { font-size: clamp(3.4rem, 9vw, 8rem); }
    .thanks .intro-icon { width: clamp(110px, 18vh, 180px); font-size: clamp(3.6rem, 10vh, 6.4rem); }
    .finish-btn { display: inline-flex; align-items: center; gap: 8px; border: 1px solid #cbd5e1; border-radius: 999px; padding: 10px 22px; font: inherit; font-size: 1rem; font-weight: 600;
      color: #12304d; background: rgba(255,255,255,0.9); cursor: pointer; transition: background 0.15s, color 0.15s; }
    .finish-btn:hover { background: #f1f5f9; color: var(--accent); }
    .finish-btn svg { width: 18px; height: 18px; }
    .voice-error { position: absolute; z-index: 3; right: 14px; bottom: 14px; max-width: min(440px, calc(100% - 28px)); margin: 0; padding: 8px 12px; border-radius: 10px; background: #fff1f2; color: #9f1239; font-size: 0.85rem; }
    .start-pulse { position: absolute; inset: 0; border-radius: inherit; border: 2px solid var(--c1); animation: ring 1.8s ease-out infinite; pointer-events: none; }
    @keyframes ring { from { opacity: 0.8; transform: scale(1); } to { opacity: 0; transform: scale(1.35); } }
    @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

    :host(:fullscreen) { background: #05070f; overflow: hidden; }
    :host(:fullscreen) .stage { margin: 0; height: 100vh; border-radius: 0; }

    @media (max-width: 760px) {
      .options { grid-template-columns: 1fr; }
      .top, .top.with-manual-tools { flex-wrap: wrap; padding-right: 0; padding-top: 36px; }
      .search { min-width: 0; width: 100%; }
      .lf { flex: 1 1 120px; }
      .lf input, .lf select { width: 100%; }
      .launch-btn, .reset-btn { flex: 1 1 100%; justify-content: center; }
    }

    :host(.portrait) { display: block; }
    :host(.portrait) .stage {
      width: min(100%, calc((100dvh - 152px) * 9 / 16)); height: auto; aspect-ratio: 9 / 16;
      margin-inline: auto; padding: clamp(10px, 2vh, 24px); gap: clamp(8px, 1.5vh, 16px);
      container-type: inline-size;
    }
    :host(.portrait:fullscreen) { display: flex; align-items: center; justify-content: center; }
    :host(.portrait:fullscreen) .stage { width: min(100%, 56.25dvh); height: auto; margin: 0; }
    :host(.portrait) .top { flex: none; flex-wrap: nowrap; gap: 3cqw; padding: 30px 0 0; }
    :host(.portrait) .brand { gap: 3cqw; flex: 1; }
    :host(.portrait) .plate { padding: 1.5cqw 2cqw; border-radius: 12px; }
    :host(.portrait) .logo { width: 18cqw; height: auto; }
    :host(.portrait) .subject { font-size: 5cqw; }
    :host(.portrait) .qcount { font-size: 3cqw; padding: 3px 2cqw; }
    :host(.portrait) .countdown { width: 16cqw; }
    :host(.portrait) .countdown .value { font-size: 7cqw; }
    :host(.portrait) .countdown.timer-inactive { visibility: hidden; }
    :host(.portrait) .countdown .value.up { font-size: 3cqw; }
    :host(.portrait) .steps { gap: 3px; }
    :host(.portrait) .steps span { min-width: 0; height: 4px; }
    :host(.portrait) .body { gap: 3cqw; }
    :host(.portrait) .question { font-size: 5.2cqw; overflow-wrap: anywhere; }
    :host(.portrait) .options { grid-template-columns: 1fr; gap: 2.5cqw; }
    :host(.portrait) .options li { font-size: 4.3cqw; padding: 2.5cqw 3cqw; gap: 3cqw; border-radius: 14px; }
    :host(.portrait) .letter { width: 8cqw; border-radius: 8px; }
    :host(.portrait) .explain { font-size: 3.3cqw; padding: 2.5cqw; gap: 2cqw; overflow-wrap: anywhere; }
    :host(.portrait) .explain svg { width: 5cqw; height: 5cqw; }
    :host(.portrait) .intro { gap: 4cqw; }
    :host(.portrait) .intro-icon { width: 25cqw; font-size: 14cqw; border-radius: 7cqw; }
    :host(.portrait) .intro-title { font-size: 9cqw; overflow-wrap: anywhere; max-width: 100%; }
    :host(.portrait) .intro-meta { flex-wrap: wrap; justify-content: center; font-size: 4cqw; gap: 2cqw; }
    :host(.portrait) .start-btn { font-size: 5cqw; padding: 3cqw 8cqw; }
    :host(.portrait) .finish-btn { font-size: 4cqw; padding: 2cqw 5cqw; }
    .shorts-settings { margin-top: 24px; padding: 20px; border: 1px solid #e1e8f0; border-radius: 20px; background: #fff; }
    .shorts-settings legend { font-weight: 800; color: #12304d; }
    .shorts-copy { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
    .shorts-copy textarea, .shorts-copy input { width: 100%; padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 12px; font: inherit; resize: vertical; }
    .shorts-timing { display: flex; flex-wrap: wrap; gap: 16px; margin: 20px 0; }
    .shorts-settings > label { display: inline-flex; gap: 8px; margin: 0 20px 12px 0; }
    .script-screen { overflow-y: auto; overflow-wrap: anywhere; }
    .script-title { margin: 0; font-size: 7cqw; line-height: 1.4; color: #12304d; white-space: pre-line; }
    .script-cta { margin: 0; font-size: 5cqw; font-weight: 700; color: var(--accent); white-space: pre-line; }
  `]
})
export class AdminSimulationComponent implements OnInit, OnDestroy {
  failedImageId: string | null = null;
  private readonly api = inject(AdminApi);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly portrait = inject(ActivatedRoute).snapshot.data['portrait'] === true;
  readonly mode = this.portrait ? 'portrait' : 'landscape';
  readonly historyLabel = this.portrait ? '9:16 simulation' : 'Regular simulation';
  hookText = '🎯 ADRE Aspirants! Only true Assam GK experts can answer this!';
  ctaPrompt = 'How many did you get right?';
  ctaText = "Follow LET'S CRACK ADRE for daily Assam GK challenges!";
  hookSeconds = 3;
  questionSeconds = 7;
  answerSeconds = 6;
  ctaSeconds = 4;
  soundEnabled = true;
  showExplanation = true;
  phase: ShortsPhase = 'question';

  fullscreen = false;
  categories: SimCategory[] = [];
  filter = '';
  loaded = false;
  category = '';
  count = 10;
  seconds = 5;
  language: 'en' | 'as' | 'both' = 'both';
  voiceEnabled = false;
  voiceError = '';
  voices: SpeechSynthesisVoice[] = [];
  englishVoiceURI = '';
  assameseVoiceURI = '';
  playbackMode: 'automatic' | 'manual' = 'automatic';
  manualTimerEnabled = false;
  questionSelectionMode = false;
  availableQuestions: SimQuestionPreview[] = [];
  selectedQuestionIds: string[] = [];
  questionFilter = '';
  loadingQuestions = false;
  questionListError = '';
  starting = false;
  resetting = false;
  error = '';
  notice = '';

  questions: SimQuestion[] = [];
  index = 0;
  remaining = 0;
  revealed = false;
  waiting = false;
  finished = false;
  get revealMs() { return this.portrait ? this.answerSeconds * 1000 : 3000; }
  private timer: ReturnType<typeof setInterval> | null = null;
  private advanceTimer: ReturnType<typeof setTimeout> | null = null;
  private audio: AudioContext | null = null;
  private speechGeneration = 0;
  private finishSpeech: (() => void) | null = null;
  private advanceRevision = 0;
  private readonly onVoicesChanged = () => this.loadVoices();
  private loadRevision = 0;
  private questionListRevision = 0;

  get maxCount() {
    return Math.min(500, this.selectedCategory?.remaining ?? 0);
  }

  get selectedCategory() {
    return this.categories.find((c) => c.name === this.category);
  }

  get visibleCategories() {
    const q = this.filter.trim().toLowerCase();
    return q ? this.categories.filter((c) => c.name.toLowerCase().includes(q)) : this.categories;
  }

  get visibleAvailableQuestions() {
    const query = this.questionFilter.trim().toLowerCase();
    return query ? this.availableQuestions.filter((question) =>
      [question.questionId, question.questionText, question.assameseQuestionText, ...question.options, ...question.assameseOptions, question.correctAnswer, question.assameseCorrectAnswer]
        .some((value) => value?.toLowerCase().includes(query))
    ) : this.availableQuestions;
  }

  theme(name: string): SimTheme {
    return simTheme(name);
  }

  get canStart() {
    const questionCount = this.questionSelectionMode ? this.selectedQuestionIds.length : this.count;
    return !this.starting && !this.resetting && !!this.category && this.maxCount > 0 && questionCount >= 1 && questionCount <= this.maxCount && this.seconds >= 1 && (!this.portrait || !this.shortsValidation);
  }

  get speechSupported() {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  get englishVoices() {
    return this.voices.filter((voice) => voice.lang.toLowerCase().startsWith('en'));
  }

  get assameseVoices() {
    return this.voices.filter((voice) => voice.lang.toLowerCase().startsWith('as'));
  }

  get shortsValidation() {
    if (![this.hookSeconds, this.questionSeconds, this.seconds, this.answerSeconds, this.ctaSeconds]
      .every((value) => Number.isInteger(value) && value >= 1 && value <= 600)) {
      return 'Each phase duration must be a whole number between 1 and 600 seconds.';
    }
    if (![this.hookText, this.ctaPrompt, this.ctaText].every((text) => text.trim().length > 0)) {
      return 'Enter the hook, CTA question and follow message.';
    }
    return '';
  }

  get shortsDuration() {
    return this.hookSeconds + this.count * (this.questionSeconds + this.seconds + this.answerSeconds) + this.ctaSeconds;
  }

  get current(): SimQuestion | undefined {
    return this.questions[this.index];
  }

  get isLast() {
    return this.index >= this.questions.length - 1;
  }

  get timerPct() {
    return this.seconds ? (this.remaining / this.seconds) * 100 : 0;
  }

  get manualTimerVisible() {
    return this.playbackMode === 'manual' && this.manualTimerEnabled && !this.revealed &&
      (!this.portrait || this.phase === 'question' || this.phase === 'countdown');
  }

  get manualNextLabel() {
    if (!this.portrait) return this.revealed ? (this.isLast ? 'Finish simulation' : 'Next question') : 'Show answer';
    if (this.phase === 'question' || this.phase === 'countdown') return 'Show answer';
    if (this.phase === 'cta') return 'Finish simulation';
    if (this.phase === 'answer') return this.isLast ? 'Show CTA' : 'Next question';
    return 'Next phase';
  }

  get timerRunning() {
    return this.timer !== null;
  }

  readonly ringLength = 2 * Math.PI * 44;

  ngOnInit() {
    if (this.speechSupported) {
      window.speechSynthesis.addEventListener('voiceschanged', this.onVoicesChanged);
      this.loadVoices();
    }
    this.load();
  }

  ngOnDestroy() {
    this.clearTimer();
    this.clearAdvance();
    this.cancelSpeech();
    if (this.speechSupported) window.speechSynthesis.removeEventListener('voiceschanged', this.onVoicesChanged);
    this.exitFullscreen();
    if (this.audio) this.audio.close().catch(() => undefined);
    this.audio = null;
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange() {
    this.fullscreen = document.fullscreenElement === this.host.nativeElement;
  }

  // Space / Enter / Right arrow start the simulation from its intro screen.
  @HostListener('document:keydown', ['$event'])
  onKey(event: KeyboardEvent) {
    if (!this.waiting || !this.questions.length || !['ArrowRight', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    this.begin();
  }

  toggleFullscreen() {
    if (this.fullscreen) this.exitFullscreen();
    else this.enterFullscreen();
  }

  // Must be called synchronously from a click handler, browsers reject it otherwise.
  private enterFullscreen() {
    const el = this.host.nativeElement;
    if (document.fullscreenElement === el || !el.requestFullscreen) return;
    el.requestFullscreen().catch(() => undefined);
  }

  private exitFullscreen() {
    if (document.fullscreenElement === this.host.nativeElement) document.exitFullscreen().catch(() => undefined);
  }

  async load() {
    const revision = ++this.loadRevision;
    try {
      const categories = await this.api.get<SimCategory[]>(`/simulation/categories?mode=${this.mode}`);
      if (revision !== this.loadRevision) return;
      this.categories = categories;
    } catch (e) {
      if (revision === this.loadRevision) this.error = this.api.message(e);
    } finally {
      if (revision === this.loadRevision) this.loaded = true;
    }
  }

  letter(i: number) {
    return String.fromCharCode(65 + i);
  }

  select(c: SimCategory) {
    if ((!c.active && !c.canReset) || this.starting || this.resetting) return;
    this.category = c.name;
    this.selectedQuestionIds = [];
    this.availableQuestions = [];
    this.questionFilter = '';
    this.questionListRevision += 1;
    this.error = '';
    this.notice = '';
    this.clampCount();
    if (this.questionSelectionMode) void this.loadAvailableQuestions();
  }

  onQuestionSelectionModeChange(enabled: boolean) {
    this.selectedQuestionIds = [];
    this.questionFilter = '';
    this.count = 1;
    if (enabled && this.category) void this.loadAvailableQuestions();
    else {
      this.questionListRevision += 1;
      this.availableQuestions = [];
      this.loadingQuestions = false;
      this.questionListError = '';
    }
  }

  async loadAvailableQuestions() {
    if (!this.category) return;
    const revision = ++this.questionListRevision;
    const category = this.category;
    this.loadingQuestions = true;
    this.questionListError = '';
    try {
      const questions = await this.api.get<SimQuestionPreview[]>('/simulation/questions', { category, mode: this.mode });
      if (revision !== this.questionListRevision) return;
      this.availableQuestions = questions;
      const availableIds = new Set(questions.map((question) => question.id));
      this.selectedQuestionIds = this.selectedQuestionIds.filter((id) => availableIds.has(id));
      this.count = Math.max(1, this.selectedQuestionIds.length);
    } catch (e) {
      if (revision === this.questionListRevision) this.questionListError = this.api.message(e);
    } finally {
      if (revision === this.questionListRevision) this.loadingQuestions = false;
    }
  }

  toggleQuestionSelection(id: string, event: Event) {
    if (!(event.target instanceof HTMLInputElement)) return;
    if (event.target.checked) {
      if (this.selectedQuestionIds.length >= this.maxCount || this.selectedQuestionIds.includes(id)) return;
      this.selectedQuestionIds = [...this.selectedQuestionIds, id];
    } else {
      this.selectedQuestionIds = this.selectedQuestionIds.filter((selectedId) => selectedId !== id);
    }
    this.count = Math.max(1, this.selectedQuestionIds.length);
  }

  selectVisibleQuestions() {
    const ids = new Set(this.selectedQuestionIds);
    for (const question of this.visibleAvailableQuestions) {
      if (ids.size >= this.maxCount) break;
      ids.add(question.id);
    }
    this.selectedQuestionIds = [...ids];
    this.count = Math.max(1, this.selectedQuestionIds.length);
  }

  clearQuestionSelection() {
    this.selectedQuestionIds = [];
    this.count = 1;
  }

  clampCount() {
    const max = this.maxCount;
    const n = Math.floor(Number(this.count) || 1);
    this.count = Math.max(1, max ? Math.min(n, max) : n);
  }

  clampSeconds() {
    this.seconds = Math.min(600, Math.max(1, Math.floor(Number(this.seconds) || 5)));
  }

  async start() {
    if (this.questionSelectionMode) this.count = this.selectedQuestionIds.length;
    this.clampCount();
    if (this.portrait && this.shortsValidation) {
      this.error = this.shortsValidation;
      return;
    }
    if (!this.portrait) this.clampSeconds();
    if (!this.canStart) return;
    this.error = '';
    this.notice = '';
    this.starting = true;
    if (this.portrait) this.unlockAudio();
    if (this.portrait || this.playbackMode === 'automatic') this.enterFullscreen();
    try {
      const payload: { category: string; count: number; language: 'en' | 'as' | 'both'; mode: 'landscape' | 'portrait'; questionIds?: string[] } = {
        category: this.category, count: this.count, language: this.language, mode: this.mode
      };
      if (this.questionSelectionMode) payload.questionIds = [...this.selectedQuestionIds];
      const data = await this.api.send<{ items: SimQuestion[] }>('post', '/simulation', payload);
      if (!data.items.length) {
        this.error = 'No active questions found in this category.';
        this.exitFullscreen();
        return;
      }
      this.questions = data.items;
      this.failedImageId = null;
      this.index = 0;
      this.revealed = false;
      this.finished = false;
      this.remaining = this.seconds;
      this.waiting = true;
      this.phase = 'question';
      if (this.portrait) {
        this.waiting = false;
        this.beginShortsPhase('hook');
      }
    } catch (e) {
      this.error = this.api.message(e);
      this.exitFullscreen();
    } finally {
      await this.load();
      if (!this.questions.length && this.questionSelectionMode) await this.loadAvailableQuestions();
      this.starting = false;
    }
  }

  async resetHistory() {
    if (!this.selectedCategory?.canReset || this.starting || this.resetting) return;
    const category = this.category;
    if (!window.confirm(`Reset ${this.historyLabel.toLowerCase()} history for "${category}" for all admins? Previously selected questions can appear again. The other simulation format and simulations already running will not change.`)) return;
    this.resetting = true;
    this.error = '';
    this.notice = '';
    try {
      await this.api.send('post', '/simulation/reset', { category, mode: this.mode });
      this.notice = `${this.historyLabel} history for "${category}" has been reset.`;
      await this.load();
      this.clampCount();
      this.selectedQuestionIds = [];
      if (this.questionSelectionMode) await this.loadAvailableQuestions();
    } catch (e) {
      this.error = this.api.message(e);
    } finally {
      this.resetting = false;
    }
  }

  // Shown once when the simulation opens; the first timer only starts after this.
  begin() {
    if (!this.waiting) return;
    this.waiting = false;
    this.unlockAudio();
    if (this.portrait) this.beginShortsPhase('hook');
    else this.beginQuestion();
  }

  private beginShortsPhase(phase: ShortsPhase) {
    this.clearTimer();
    this.clearAdvance();
    if (phase === 'hook' || phase === 'cta') this.cancelSpeech();
    this.phase = phase;
    this.revealed = phase === 'answer';
    this.remaining = phase === 'countdown' ? this.seconds : 0;
    const speech = phase === 'question' ? this.speakCurrentQuestion()
      : phase === 'answer' ? this.speakCorrectAnswer()
      : Promise.resolve();
    if (phase === 'countdown') {
      if (this.playbackMode === 'automatic') this.beginQuestion();
      return;
    }
    if (this.playbackMode === 'manual') return;
    const duration = phase === 'hook' ? this.hookSeconds
      : phase === 'question' ? this.questionSeconds
      : phase === 'answer' ? this.answerSeconds : this.ctaSeconds;
    this.scheduleAfterSpeech(duration * 1000, () => {
      if (phase === 'hook') this.beginShortsPhase('question');
      else if (phase === 'question') this.beginShortsPhase('countdown');
      else if (phase === 'answer') {
        if (this.isLast) this.beginShortsPhase('cta');
        else this.next();
      } else this.finish();
    }, speech);
  }

  // Browsers only allow audio after a user gesture, so the context is created from the Start click.
  private unlockAudio() {
    if (this.portrait && !this.soundEnabled) return;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.audio ??= new Ctx();
      if (this.audio.state === 'suspended') this.audio.resume().catch(() => undefined);
    } catch {
      this.audio = null;
    }
  }

  private beep(frequency: number, duration: number) {
    if (this.portrait && !this.soundEnabled) return;
    const ctx = this.audio;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  // When the timer runs out the answer is shown for a few seconds, then the next question (or the thank-you screen) follows automatically.
  reveal() {
    if (this.waiting || this.finished || this.remaining > 0 || this.revealed) return;
    if (this.portrait) {
      if (this.phase === 'countdown') this.beginShortsPhase('answer');
      return;
    }
    this.revealed = true;
    const speech = this.speakCorrectAnswer();
    this.clearAdvance();
    if (this.playbackMode === 'manual') return;
    this.scheduleAfterSpeech(this.revealMs, () => {
      if (this.isLast) this.finish();
      else this.next();
    }, speech);
  }

  manualNext() {
    if (this.waiting || this.finished || !this.questions.length) return;
    if (this.portrait) {
      if (this.phase === 'hook') this.beginShortsPhase('question');
      else if (this.phase === 'question' || this.phase === 'countdown') this.beginShortsPhase('answer');
      else if (this.phase === 'answer') {
        if (this.isLast) this.beginShortsPhase('cta');
        else this.next();
      } else this.finish();
      return;
    }
    if (!this.revealed) {
      this.clearTimer();
      this.remaining = 0;
      this.revealed = true;
      this.speakCorrectAnswer();
      return;
    }
    if (this.isLast) this.finish();
    else {
      this.index += 1;
      this.beginQuestion();
    }
  }

  startManualTimer() {
    if (!this.manualTimerVisible || this.waiting || this.finished || !this.questions.length || this.timerRunning) return;
    if (this.portrait) this.phase = 'countdown';
    this.startCountdown();
  }

  next() {
    if (this.isLast) return;
    this.index += 1;
    if (this.portrait) this.beginShortsPhase('question');
    else this.beginQuestion();
  }

  private finish() {
    this.clearTimer();
    this.clearAdvance();
    this.cancelSpeech();
    this.revealed = false;
    this.remaining = 0;
    this.phase = 'question';
    this.finished = true;
    if (this.portrait) {
      this.advanceTimer = setTimeout(() => {
        this.advanceTimer = null;
        this.stop();
      }, 3000);
    }
  }

  stop() {
    this.clearTimer();
    this.clearAdvance();
    this.cancelSpeech();
    this.exitFullscreen();
    this.questions = [];
    this.index = 0;
    this.waiting = false;
    this.finished = false;
    this.revealed = false;
    this.remaining = 0;
    this.selectedQuestionIds = [];
    void this.load();
    if (this.questionSelectionMode) void this.loadAvailableQuestions();
  }

  private beginQuestion() {
    this.clearTimer();
    this.clearAdvance();
    this.revealed = false;
    const question = this.current;
    const speech = !this.portrait ? this.speakCurrentQuestion() : Promise.resolve();
    if (!this.portrait && this.playbackMode === 'manual') {
      this.remaining = this.manualTimerEnabled ? this.seconds : 0;
      return;
    }
    if (!this.portrait && this.voiceEnabled && this.speechSupported) {
      void speech.then(() => {
        if (this.current === question && !this.waiting && !this.finished && !this.revealed) this.startCountdown();
      });
      return;
    }
    this.startCountdown();
  }

  private startCountdown() {
    this.remaining = this.seconds;
    this.timer = setInterval(() => {
      this.remaining = Math.max(0, this.remaining - 1);
      if (this.remaining > 0) this.beep(880, 0.15);
      if (this.remaining === 0) {
        this.beep(1320, 0.45);
        this.clearTimer();
        this.reveal();
      }
    }, 1000);
  }

  private speakCurrentQuestion(): Promise<void> {
    const question = this.current;
    if (!question) return Promise.resolve();
    const parts = [{
      text: `Question. ${question.questionText}. ${question.options.map((option, index) => `Option ${this.letter(index)}: ${option}`).join('. ')}`,
      language: question.language ?? 'en'
    }];
    if (question.translation) {
      parts.push({
        text: `Question. ${question.translation.questionText}. ${question.translation.options.map((option, index) => `Option ${this.letter(index)}: ${option}`).join('. ')}`,
        language: question.language === 'en' ? 'as' : 'en'
      });
    }
    return this.speak(parts);
  }

  private speakCorrectAnswer(): Promise<void> {
    const question = this.current;
    if (!question) return Promise.resolve();
    const answer = question.options[question.correctOption];
    if (answer === undefined) return Promise.resolve();
    const parts = [{ text: `The correct answer is ${answer}.`, language: question.language ?? 'en' }];
    const translatedAnswer = question.translation?.options[question.correctOption];
    if (translatedAnswer) {
      parts.push({
        text: `The correct answer is ${translatedAnswer}.`,
        language: question.language === 'en' ? 'as' : 'en'
      });
    }
    return this.speak(parts);
  }

  private speak(parts: Array<{ text: string; language: 'en' | 'as' }>): Promise<void> {
    if (!this.voiceEnabled || !this.speechSupported) return Promise.resolve();
    this.cancelSpeech();
    this.voiceError = '';
    const generation = this.speechGeneration;
    return new Promise<void>((resolve) => {
      let pending = parts.length;
      this.finishSpeech = resolve;
      const completePart = () => {
        if (generation !== this.speechGeneration) return;
        pending -= 1;
        if (pending === 0) {
          this.finishSpeech = null;
          resolve();
        }
      };
      for (const part of parts) {
        const utterance = new SpeechSynthesisUtterance(part.text);
        utterance.lang = part.language === 'as' ? 'as-IN' : 'en-IN';
        const voiceURI = part.language === 'as' ? this.assameseVoiceURI : this.englishVoiceURI;
        const voice = this.voices.find((availableVoice) => availableVoice.voiceURI === voiceURI);
        if (voice) utterance.voice = voice;
        utterance.onend = completePart;
        utterance.onerror = (event) => {
          if (event.error !== 'canceled' && event.error !== 'interrupted') {
            this.voiceError = 'Browser speech playback failed. Check that your device has a voice available for this language.';
          }
          completePart();
        };
        window.speechSynthesis.speak(utterance);
      }
    });
  }

  loadVoices() {
    if (!this.speechSupported) return;
    this.voices = window.speechSynthesis.getVoices();
    if (!this.englishVoices.some((voice) => voice.voiceURI === this.englishVoiceURI)) this.englishVoiceURI = '';
    if (!this.assameseVoices.some((voice) => voice.voiceURI === this.assameseVoiceURI)) this.assameseVoiceURI = '';
  }

  onVoiceEnabledChange(enabled: boolean) {
    this.voiceError = '';
    if (enabled) this.loadVoices();
    else this.cancelSpeech();
  }

  testVoice(language: 'en' | 'as') {
    if (language === 'as' && !this.assameseVoices.length) {
      this.voiceError = 'No Assamese voice is available. Install an Assamese text-to-speech voice and reload this page.';
      return;
    }
    void this.speak([{
      text: language === 'as' ? 'নমস্কাৰ। এইটো অসমৰ বাবে এটা কণ্ঠ পৰীক্ষা।' : 'Hello. This is a sample of the selected English voice.',
      language
    }]);
  }

  private cancelSpeech() {
    this.speechGeneration += 1;
    if (this.speechSupported) window.speechSynthesis.cancel();
    this.finishSpeech?.();
    this.finishSpeech = null;
  }

  private scheduleAfterSpeech(duration: number, action: () => void, speech: Promise<void>) {
    const revision = this.advanceRevision;
    this.advanceTimer = setTimeout(() => {
      this.advanceTimer = null;
      if (!this.voiceEnabled || !this.speechSupported) {
        if (revision === this.advanceRevision) action();
        return;
      }
      void speech.then(() => {
        if (revision === this.advanceRevision) action();
      });
    }, duration);
  }

  private clearTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private clearAdvance() {
    this.advanceRevision += 1;
    if (this.advanceTimer) clearTimeout(this.advanceTimer);
    this.advanceTimer = null;
  }
}
