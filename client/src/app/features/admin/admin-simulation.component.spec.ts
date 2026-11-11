import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AdminApi } from './admin.api';
import { AdminSimulationComponent } from './admin-simulation.component';

for (const portrait of [false, true]) {
describe(`Admin simulation question history (${portrait ? 'portrait' : 'landscape'})`, () => {
  const mode = portrait ? 'portrait' : 'landscape';
  let fixture: ComponentFixture<AdminSimulationComponent>;
  let component: AdminSimulationComponent;
  let api: jasmine.SpyObj<AdminApi>;
  const subject = (remaining = 5, canReset = true) => ({
    id: 'history', name: 'History', count: 10, active: 10, remaining, canReset
  });
  const question = {
    id: 'question-1', questionId: null, questionText: 'Question',
    options: ['A', 'B'], correctOption: 1, explanation: ''
  };

  beforeEach(async () => {
    api = jasmine.createSpyObj<AdminApi>('AdminApi', ['get', 'send', 'message']);
    api.get.and.resolveTo([subject()]);
    api.send.and.resolveTo({ items: [question] });
    api.message.and.returnValue('Request failed.');
    await TestBed.configureTestingModule({
      declarations: [AdminSimulationComponent],
      imports: [CommonModule, FormsModule],
      providers: [
        { provide: AdminApi, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { data: portrait ? { portrait: true } : {} } } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(AdminSimulationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    spyOn(element, 'requestFullscreen').and.resolveTo();
  });

  it('loads persistent remaining counts and caps the batch to unused questions', () => {
    expect(component.portrait).toBe(portrait);
    expect(fixture.nativeElement.classList.contains('portrait')).toBe(portrait);
    expect(fixture.nativeElement.querySelector('h2').textContent).toBe(portrait ? 'Shorts Simulation (9:16)' : 'Simulation');
    expect(api.get).toHaveBeenCalledWith(`/simulation/categories?mode=${mode}`);
    expect(fixture.nativeElement.textContent).toContain('Regular and 9:16 simulations track and reset history separately.');
    component.select(component.categories[0]);
    fixture.detectChanges();
    expect(component.count).toBe(5);
    expect(component.maxCount).toBe(5);
    expect(component.canStart).toBeTrue();
    expect(fixture.nativeElement.querySelector('.sc-pill').textContent).toContain('5 unused');
  });

  it('defaults to automatic playback and offers manual playback in both formats', () => {
    expect(component.playbackMode).toBe('automatic');
    const playbackOption = fixture.nativeElement.querySelector('[name="playbackMode"]');
    expect(playbackOption).toEqual(jasmine.any(HTMLInputElement));
    component.questions = [question];
    fixture.detectChanges();
    expect(getComputedStyle(fixture.nativeElement.querySelector('.stage')).borderRadius).toBe('0px');
  });

  it('uses the browser voice to read questions, options and answers in the selected languages', () => {
    if (!component.speechSupported) pending('Speech synthesis is unavailable in this browser.');
    const synthesis = window.speechSynthesis;
    spyOn(synthesis, 'speak');
    spyOn(synthesis, 'cancel');
    component.voiceEnabled = true;
    component.playbackMode = 'manual';
    component.questions = [{
      ...question,
      language: 'en',
      translation: { questionText: 'অসমীয়া প্ৰশ্ন', options: ['উত্তৰ A', 'উত্তৰ B'] }
    }];
    component.waiting = true;
    component.begin();
    if (portrait) component.manualNext();

    const spoken = () => (synthesis.speak as jasmine.Spy).calls.allArgs()
      .map(([utterance]) => utterance as SpeechSynthesisUtterance);
    expect(spoken().map((utterance) => utterance.text)).toEqual([
      'Question. Question. Option A: A. Option B: B',
      'Question. অসমীয়া প্ৰশ্ন. Option A: উত্তৰ A. Option B: উত্তৰ B'
    ]);
    expect(spoken().map((utterance) => utterance.lang)).toEqual(['en-IN', 'as-IN']);

    component.manualNext();
    expect(spoken().slice(-2).map((utterance) => utterance.text)).toEqual([
      'The correct answer is B.',
      'The correct answer is উত্তৰ B.'
    ]);
    expect(synthesis.cancel).toHaveBeenCalled();
  });

  it('lets admins select and test installed English and Assamese voices before starting', () => {
    if (!component.speechSupported) pending('Speech synthesis is unavailable in this browser.');
    const englishVoice = {
      default: true, lang: 'en-IN', localService: true, name: 'English sample', voiceURI: 'english-sample'
    } as SpeechSynthesisVoice;
    const assameseVoice = {
      default: false, lang: 'as-IN', localService: true, name: 'Assamese sample', voiceURI: 'assamese-sample'
    } as SpeechSynthesisVoice;
    const synthesis = window.speechSynthesis;
    spyOn(synthesis, 'getVoices').and.returnValue([englishVoice, assameseVoice]);
    spyOn(synthesis, 'speak');
    spyOn(synthesis, 'cancel');

    component.language = 'both';
    component.voiceEnabled = true;
    component.loadVoices();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[name="englishVoice"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[name="assameseVoice"]')).not.toBeNull();
    expect(component.englishVoiceURI).toBe('');
    expect(component.assameseVoiceURI).toBe('');

    component.testVoice('as');
    const utterance = (synthesis.speak as jasmine.Spy).calls.mostRecent().args[0] as SpeechSynthesisUtterance;
    expect(utterance.text).toContain('নমস্কাৰ');
    expect(utterance.lang).toBe('as-IN');
    expect(api.send).not.toHaveBeenCalled();
  });

  it('defaults to requesting English and Assamese together', async () => {
    component.select(component.categories[0]);
    expect(component.language).toBe('both');
    await component.start();
    expect(api.send).toHaveBeenCalledOnceWith('post', '/simulation', { category: 'History', count: 5, language: 'both', mode });
  });

  it('uses light surfaces and dark text throughout question playback and answer reveal', () => {
    component.select(component.categories[0]);
    component.questions = [{ ...question, explanation: 'Answer explanation' }];
    component.remaining = 5;
    component.phase = 'question';
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    element.querySelectorAll<HTMLElement>('.options li').forEach((option) => option.style.transition = 'none');
    const style = (selector: string) => getComputedStyle(element.querySelector(selector)!);
    expect(style('.stage').getPropertyValue('color-scheme')).toBe('light');
    expect(style('.stage').backgroundImage).toContain('linear-gradient');
    expect(style('.question').color).toBe('rgb(18, 48, 77)');
    expect(style('.question').textShadow).toBe('none');
    expect(style('.options li').backgroundColor).toBe('rgba(255, 255, 255, 0.9)');
    expect(style('.options li').color).toBe('rgb(18, 48, 77)');
    expect(style('.tool').color).toBe('rgb(18, 48, 77)');
    expect(style('.countdown .value').color).toBe('rgb(18, 48, 77)');
    if (portrait) expect(style('.stage').aspectRatio).toBe('9 / 16');

    component.remaining = 2;
    fixture.detectChanges();
    expect(style('.countdown .value').color).toBe('rgb(146, 64, 14)');
    component.remaining = 0;
    component.revealed = true;
    component.showExplanation = true;
    fixture.detectChanges();
    expect(style('.countdown .value.up').color).toBe('rgb(159, 18, 57)');
    expect(style('.options li.correct').color).toBe('rgb(20, 83, 45)');
    expect(style('.options li.correct .letter').color).toBe('rgb(255, 255, 255)');
    expect(style('.explain').backgroundColor).toBe('rgb(255, 251, 235)');
    expect(style('.explain').color).toBe('rgb(120, 53, 15)');
  });

  it('keeps intro and completion text readable on the light canvas', () => {
    component.select(component.categories[0]);
    component.questions = [question];
    component.waiting = true;
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const accent = getComputedStyle(element.querySelector('.subject')!).color;
    expect(accent).not.toBe('rgba(0, 0, 0, 0)');
    expect(getComputedStyle(element.querySelector('.intro-title')!).color).toBe(accent);
    expect(getComputedStyle(element.querySelector('.intro-meta')!).color).toBe('rgb(53, 80, 107)');
    expect(getComputedStyle(element.querySelector('.start-btn')!).backgroundColor).toBe(accent);

    component.waiting = false;
    component.finished = true;
    fixture.detectChanges();
    expect(getComputedStyle(element.querySelector('.thanks .intro-title')!).color).toBe(accent);
    if (portrait) {
      expect(getComputedStyle(element.querySelector('.thanks .script-cta')!).color).toBe(accent);
    } else {
      expect(getComputedStyle(element.querySelector('.finish-btn')!).color).toBe('rgb(18, 48, 77)');
    }
  });

  if (portrait) {
    it('uses dark hook and CTA text on the light portrait canvas', () => {
      component.select(component.categories[0]);
      component.questions = [question];
      component.phase = 'hook';
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      expect(getComputedStyle(element.querySelector('.script-title')!).color).toBe('rgb(18, 48, 77)');
      component.phase = 'cta';
      fixture.detectChanges();
      expect(getComputedStyle(element.querySelector('.script-title')!).color).toBe('rgb(18, 48, 77)');
      expect(getComputedStyle(element.querySelector('.script-cta')!).color)
        .toBe(getComputedStyle(element.querySelector('.subject')!).color);
    });
  }

  it('lets the admin select exact available questions from a bilingual answer table', async () => {
    const preview = {
      id: '0123456789abcdef01234567',
      questionId: 'H-1',
      questionText: 'English question',
      assameseQuestionText: 'অসমীয়া প্ৰশ্ন',
      options: ['Answer A', 'Answer B'],
      assameseOptions: ['উত্তৰ C', 'উত্তৰ D'],
      correctAnswer: 'Answer B',
      assameseCorrectAnswer: 'উত্তৰ D'
    };
    api.get.and.resolveTo([preview]);
    component.select(component.categories[0]);
    component.questionSelectionMode = true;
    await component.loadAvailableQuestions();
    fixture.detectChanges();

    const table = fixture.nativeElement.querySelector('.question-table') as HTMLTableElement;
    expect(table.textContent).toContain('English question');
    expect(table.textContent).toContain('Answer A');
    expect(table.textContent).toContain('Answer B');
    expect(table.textContent).toContain('অসমীয়া প্ৰশ্ন');
    expect(table.textContent).toContain('উত্তৰ C');
    expect(table.textContent).toContain('উত্তৰ D');
    expect(table.textContent).toContain('Answer B');
    expect(table.textContent).toContain('উত্তৰ D');
    const checkbox = table.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(component.selectedQuestionIds).toEqual([preview.id]);
    expect(fixture.nativeElement.querySelector('.selected-count').textContent).toContain('1');

    await component.start();
    expect(api.send).toHaveBeenCalledOnceWith('post', '/simulation', {
      category: 'History', count: 1, language: 'both', mode, questionIds: [preview.id]
    });
  });

  it('renders Assamese below the question and matching options and preserves the answer reveal', () => {
    component.questions = [{
      ...question, questionText: 'What is the capital of Assam?', language: 'en',
      options: ['Jorhat', 'Dispur'],
      translation: { questionText: 'অসমৰ ৰাজধানী কি?', options: ['যোৰহাট', 'দিছপুৰ'] }
    }];
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.question [lang="en"]')?.textContent).toBe('What is the capital of Assam?');
    expect(element.querySelector('.question .translation')?.textContent).toBe('অসমৰ ৰাজধানী কি?');
    expect(element.querySelector('.question .translation')?.getAttribute('lang')).toBe('as');
    const options = element.querySelectorAll('.options li');
    expect(options[0].querySelector('.translation')?.textContent).toBe('যোৰহাট');
    expect(options[1].querySelector('.translation')?.textContent).toBe('দিছপুৰ');
    expect(getComputedStyle(options[1].querySelector('.translation')!).display).toBe('block');
    component.revealed = true;
    fixture.detectChanges();
    expect(options[0].classList.contains('correct')).toBeFalse();
    expect(options[1].classList.contains('correct')).toBeTrue();
    expect(options[1].querySelector('.translation')?.textContent).toBe('দিছপুৰ');
  });

  it('does not render empty translation lines for missing or partial translations', () => {
    component.questions = [question];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.translation').length).toBe(0);
    component.questions = [{ ...question, translation: { questionText: '', options: ['', 'দিছপুৰ'] } }];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.question .translation')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.options .translation').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.options .translation').textContent).toBe('দিছপুৰ');
  });

  it('splits only regular simulation into equal left and right halves when a reference image exists', () => {
    const referenceImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
    component.questions = [{ ...question, referenceImage }];
    component.phase = 'question';
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const body = element.querySelector('.body')!;
    expect(body.classList.contains('with-reference')).toBe(!portrait);
    const image = element.querySelector<HTMLImageElement>('.reference-image img');
    if (portrait) {
      expect(image).toBeNull();
    } else {
      expect(image!.src).toBe(referenceImage);
      expect(getComputedStyle(image!).objectFit).toBe('contain');
      const left = element.querySelector('.question-content')!.getBoundingClientRect();
      const right = element.querySelector('.reference-image')!.getBoundingClientRect();
      expect(Math.abs(left.width - right.width)).toBeLessThan(1);
      expect(right.left).toBeGreaterThan(left.right);
      component.revealed = true;
      fixture.detectChanges();
      expect(element.querySelector('.options li.correct')).not.toBeNull();
      expect(element.querySelector('.reference-image img')).not.toBeNull();
    }
    component.questions = [question];
    fixture.detectChanges();
    expect(element.querySelector('.body.with-reference')).toBeNull();
    expect(element.querySelector('.reference-image')).toBeNull();
    expect(getComputedStyle(element.querySelector('.body')!).display).toBe('flex');
  });

  if (!portrait) {
    it('reports a failed reference image and restores the full-width question layout', () => {
      component.questions = [{ ...question, referenceImage: 'invalid' }];
      fixture.detectChanges();
      fixture.nativeElement.querySelector('.reference-image img').dispatchEvent(new Event('error'));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.body.with-reference')).toBeNull();
      expect(fixture.nativeElement.querySelector('.reference-image')).toBeNull();
      expect(fixture.nativeElement.querySelector('.image-error[role="alert"]').textContent).toContain('could not be displayed');
      component.questions = [{ ...question, id: 'question-2', referenceImage: 'another-image' }];
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.body.with-reference')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('.image-error')).toBeNull();
    });
  }

  it('reveals English and Assamese explanations together only after time is up', () => {
    component.questions = [{
      ...question, language: 'en', explanation: 'Dispur is the capital of Assam.',
      translation: { questionText: '', options: [], explanation: 'দিছপুৰ অসমৰ ৰাজধানী।' }
    }];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.explain')).toBeNull();
    component.revealed = true;
    fixture.detectChanges();
    const explanation = fixture.nativeElement.querySelector('.explain') as HTMLElement;
    expect(explanation.querySelector('[lang="en"]')?.textContent).toBe('Dispur is the capital of Assam.');
    expect(explanation.querySelector('[lang="as"]')?.textContent).toBe('দিছপুৰ অসমৰ ৰাজধানী।');
    expect(getComputedStyle(explanation.querySelector('.translation')!).display).toBe('block');
  });

  it('shows an Assamese explanation even without an English explanation', () => {
    component.questions = [{
      ...question, translation: { questionText: '', options: [], explanation: 'দিছপুৰ অসমৰ ৰাজধানী।' }
    }];
    component.revealed = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.explain [lang="as"]').textContent).toBe('দিছপুৰ অসমৰ ৰাজধানী।');
    component.questions = [question];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.explain')).toBeNull();
    component.questions = [{ ...question, explanation: 'English explanation' }];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.explain').textContent).toContain('English explanation');
    expect(fixture.nativeElement.querySelector('.explain .translation')).toBeNull();
  });

  it('keeps an exhausted subject selectable for reset while blocking starts', () => {
    component.categories = [subject(0)];
    fixture.detectChanges();
    const card: HTMLButtonElement = fixture.nativeElement.querySelector('.subject-card');
    expect(card.disabled).toBeFalse();
    card.click();
    fixture.detectChanges();
    expect(component.category).toBe('History');
    expect(component.canStart).toBeFalse();
    expect(fixture.nativeElement.querySelector('.launch-btn').disabled).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('No unused active questions remain');
    const buttons: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.launch button');
    expect(buttons[1].disabled).toBeFalse();
  });

  it('renders a clearly styled reset button with a decorative icon and readable disabled state', () => {
    component.select(component.categories[0]);
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.reset-btn');
    expect(button.textContent).toContain('Reset subject history');
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(getComputedStyle(button).backgroundColor).toBe('rgb(255, 251, 235)');
    expect(getComputedStyle(button).color).toBe('rgb(146, 64, 14)');
    expect(button.getBoundingClientRect().height).toBeGreaterThanOrEqual(48);
    component.categories = [subject(10, false)];
    fixture.detectChanges();
    expect(button.disabled).toBeTrue();
    expect(getComputedStyle(button).color).toBe('rgb(100, 116, 139)');
  });

  it('allows resetting history even when all questions in the subject are inactive', () => {
    component.categories = [{ ...subject(0), active: 0 }];
    fixture.detectChanges();
    const card: HTMLButtonElement = fixture.nativeElement.querySelector('.subject-card');
    expect(card.disabled).toBeFalse();
    card.click();
    fixture.detectChanges();
    expect(component.category).toBe('History');
    expect(component.canStart).toBeFalse();
    expect(fixture.nativeElement.querySelector('.reset-btn').disabled).toBeFalse();
  });

  it('ignores stale category responses that finish after a newer refresh', async () => {
    let resolveOlder!: (categories: ReturnType<typeof subject>[]) => void;
    api.get.and.returnValue(new Promise<ReturnType<typeof subject>[]>((resolve) => { resolveOlder = resolve; }));
    const older = component.load();
    api.get.and.resolveTo([subject(0)]);
    await component.load();
    resolveOlder([subject(10, false)]);
    await older;
    expect(component.categories[0].remaining).toBe(0);
    expect(component.categories[0].canReset).toBeTrue();
  });

  it('ignores errors from an older refresh after a newer one succeeds', async () => {
    let rejectOlder!: (reason: Error) => void;
    api.get.and.returnValue(new Promise<ReturnType<typeof subject>[]>((_resolve, reject) => { rejectOlder = reject; }));
    const older = component.load();
    api.get.and.resolveTo([subject(0)]);
    await component.load();
    rejectOlder(new Error('Outdated failure'));
    await older;
    expect(component.error).toBe('');
    expect(component.categories[0].remaining).toBe(0);
  });

  it('starts with POST, prevents duplicate starts and refreshes shared history', async () => {
    component.select(component.categories[0]);
    component.language = 'as';
    const pending = component.start();
    await component.start();
    await pending;
    expect(api.send).toHaveBeenCalledOnceWith('post', '/simulation', { category: 'History', count: 5, language: 'as', mode });
    expect(component.questions).toEqual([question]);
    expect(component.waiting).toBe(!portrait);
    if (portrait) expect(component.phase).toBe('hook');
    expect(component.starting).toBeFalse();
    expect(api.get).toHaveBeenCalledTimes(2);
    component.stop();
    expect(component.questions).toEqual([]);
    expect(api.get).toHaveBeenCalledTimes(3);
  });

  if (!portrait) it('runs automatically: reveals on time up, advances after 3s and ends on a thank-you screen until Exit', () => {
    jasmine.clock().install();
    try {
      component.category = 'History';
      component.seconds = 2;
      component.questions = [question, { ...question, id: 'question-2' }];
      component.waiting = true;
      component.begin();
      jasmine.clock().tick(1000);
      expect(component.revealed).toBeFalse();
      jasmine.clock().tick(1000);
      expect(component.revealed).toBeTrue();
      jasmine.clock().tick(2999);
      expect(component.index).toBe(0);
      jasmine.clock().tick(1);
      expect(component.index).toBe(1);
      expect(component.revealed).toBeFalse();
      expect(component.remaining).toBe(2);
      jasmine.clock().tick(2000 + 3000);
      expect(component.finished).toBeTrue();
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Thank you!');
      jasmine.clock().tick(60000);
      expect(component.questions.length).toBe(2);
      (fixture.nativeElement.querySelector('.finish-btn') as HTMLButtonElement).click();
      expect(component.questions).toEqual([]);
      expect(component.finished).toBeFalse();
    } finally {
      jasmine.clock().uninstall();
    }
  });

  if (!portrait) it('manual playback has no timer and uses eye and arrow controls for navigation', () => {
    jasmine.clock().install();
    try {
      component.playbackMode = 'manual';
      component.seconds = 2;
      component.questions = [question, { ...question, id: 'question-2' }];
      component.waiting = true;
      component.begin();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.countdown')).toBeNull();
      expect(fixture.nativeElement.querySelector('[name="seconds"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('.manual-next svg circle')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[aria-label="Full screen"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[aria-label="End simulation"]')).not.toBeNull();
      expect(component.index).toBe(0);
      expect(component.revealed).toBeFalse();
      expect(component.remaining).toBe(0);

      component.manualNext();
      expect(component.revealed).toBeTrue();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.manual-next svg path').getAttribute('d')).toContain('M5 12h14');

      component.manualNext();
      expect(component.index).toBe(1);
      expect(component.revealed).toBeFalse();
      expect(component.remaining).toBe(0);
      jasmine.clock().tick(10000);
      expect(component.index).toBe(1);
      expect(component.revealed).toBeFalse();
      component.manualNext();
      expect(component.revealed).toBeTrue();
      component.manualNext();
      expect(component.finished).toBeTrue();
    } finally {
      jasmine.clock().uninstall();
    }
  });

  if (!portrait) it('offers an optional manual timer with a configurable duration', () => {
    component.playbackMode = 'manual';
    fixture.detectChanges();
    const checkbox = fixture.nativeElement.querySelector('[name="manualTimerEnabled"]') as HTMLInputElement;
    expect(checkbox.checked).toBeFalse();
    expect(fixture.nativeElement.querySelector('[name="seconds"]')).toBeNull();
    checkbox.click();
    fixture.detectChanges();
    expect(component.manualTimerEnabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('[name="seconds"]')).not.toBeNull();
  });

  if (!portrait) it('keeps the question in the left column in manual mode without an image', () => {
    component.playbackMode = 'manual';
    component.questions = [question];
    component.waiting = true;
    component.begin();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const body = element.querySelector('.body') as HTMLElement;
    const content = element.querySelector('.question-content') as HTMLElement;
    expect(body.classList.contains('with-reference')).toBeTrue();
    expect(content.getBoundingClientRect().width).toBeLessThan(body.getBoundingClientRect().width * 0.51);
    expect(element.querySelector('.reference-image')).toBeNull();
    component.manualNext();
    fixture.detectChanges();
    expect(body.classList.contains('with-reference')).toBeTrue();
    expect(content.getBoundingClientRect().width).toBeLessThan(body.getBoundingClientRect().width * 0.51);
  });

  if (!portrait) it('sizes the manual countdown to fill most of the available right-hand panel', () => {
    component.playbackMode = 'manual';
    component.manualTimerEnabled = true;
    component.questions = [question];
    component.waiting = true;
    component.begin();
    component.startManualTimer();
    fixture.detectChanges();
    const stage = fixture.nativeElement.querySelector('.stage') as HTMLElement;
    stage.style.width = '900px';
    stage.style.height = '650px';
    const panel = fixture.nativeElement.querySelector('.manual-timer') as HTMLElement;
    const countdown = panel.querySelector('.countdown') as HTMLElement;
    const panelBounds = panel.getBoundingClientRect();
    const countdownBounds = countdown.getBoundingClientRect();
    const availableSize = Math.min(panelBounds.width, panelBounds.height);
    expect(countdownBounds.width).toBeGreaterThan(availableSize * 0.69);
    expect(countdownBounds.width).toBeLessThan(availableSize * 0.71);
    expect(countdownBounds.height).toBeCloseTo(countdownBounds.width, 0);
    expect(parseFloat(getComputedStyle(countdown.querySelector('.value')!).fontSize)).toBeGreaterThan(countdownBounds.width * 0.29);
    expect(getComputedStyle(countdown).borderRadius).toBe('50%');
    expect(getComputedStyle(countdown).boxShadow).not.toBe('none');
    expect(getComputedStyle(countdown.querySelector('.ring')!).filter).toBe('none');
    component.remaining = 2;
    fixture.detectChanges();
    expect(getComputedStyle(countdown).borderRadius).toBe('50%');
    expect(getComputedStyle(countdown).boxShadow).not.toBe('none');
    expect(getComputedStyle(countdown.querySelector('.ring')!).filter).toBe('none');
  });

  if (!portrait) it('starts each manual countdown on demand and reveals the image and answer at zero', () => {
    jasmine.clock().install();
    try {
      component.playbackMode = 'manual';
      component.manualTimerEnabled = true;
      component.seconds = 2;
      component.questions = [{ ...question, referenceImage: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' }, { ...question, id: 'question-2' }];
      component.waiting = true;
      component.begin();
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('.body.with-reference .manual-timer')).not.toBeNull();
      expect(element.querySelector('.manual-timer .countdown')).toBeNull();
      expect(element.querySelector('.reference-image')).toBeNull();
      jasmine.clock().tick(5000);
      expect(component.remaining).toBe(2);
      expect(component.revealed).toBeFalse();
      (element.querySelector('[aria-label="Start timer"]') as HTMLButtonElement).click();
      component.startManualTimer();
      fixture.detectChanges();
      expect(element.querySelector('[aria-label="Start timer"]')).toBeNull();
      expect(element.querySelector('.manual-timer .countdown')?.textContent).toContain('2');
      jasmine.clock().tick(1000);
      expect(component.remaining).toBe(1);
      expect(component.revealed).toBeFalse();
      jasmine.clock().tick(1000);
      fixture.detectChanges();
      expect(component.revealed).toBeTrue();
      expect(element.querySelector('.manual-timer')).toBeNull();
      expect(element.querySelector('.reference-image img')).not.toBeNull();
      expect(element.querySelector('.options li.correct')).not.toBeNull();
      jasmine.clock().tick(10000);
      expect(component.index).toBe(0);

      component.manualNext();
      fixture.detectChanges();
      expect(component.index).toBe(1);
      expect(component.remaining).toBe(2);
      expect(element.querySelector('.body.with-reference .manual-timer')).not.toBeNull();
      expect(element.querySelector('.manual-timer .countdown')).toBeNull();
      expect(element.querySelector('.reference-image')).toBeNull();
      (element.querySelector('[aria-label="Start timer"]') as HTMLButtonElement).click();
      component.manualNext();
      fixture.detectChanges();
      expect(component.revealed).toBeTrue();
      expect(element.querySelector('.body.with-reference')).not.toBeNull();
      jasmine.clock().tick(5000);
      expect(component.index).toBe(1);
      component.manualNext();
      expect(component.finished).toBeTrue();
    } finally {
      jasmine.clock().uninstall();
    }
  });

  if (!portrait) it('clears a running manual countdown when the simulation ends', () => {
    jasmine.clock().install();
    try {
      component.playbackMode = 'manual';
      component.manualTimerEnabled = true;
      component.questions = [question];
      component.waiting = true;
      component.begin();
      component.startManualTimer();
      component.stop();
      jasmine.clock().tick(10000);
      expect(component.timerRunning).toBeFalse();
      expect(component.revealed).toBeFalse();
      expect(component.questions).toEqual([]);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  if (!portrait) it('does not request fullscreen when starting in manual playback', async () => {
    component.select(component.categories[0]);
    component.playbackMode = 'manual';
    await component.start();
    fixture.detectChanges();
    expect(fixture.nativeElement.requestFullscreen).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[aria-label="Full screen"]')).not.toBeNull();
  });

  it('does not reset history when confirmation is cancelled', async () => {
    component.select(component.categories[0]);
    spyOn(window, 'confirm').and.returnValue(false);
    await component.resetHistory();
    expect(api.send).not.toHaveBeenCalled();
    expect(component.resetting).toBeFalse();
  });

  it('uses the larger responsive sizes for question and option text', () => {
    component.questions = [question];
    fixture.detectChanges();
    const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const viewportWidth = window.innerWidth;
    const stage = fixture.nativeElement.querySelector('.stage') as HTMLElement;
    const style = getComputedStyle(stage);
    const contentWidth = stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const questionSize = portrait ? 0.052 * contentWidth : Math.max(1.85 * rootSize, Math.min(0.035 * viewportWidth, 3.4 * rootSize));
    const optionSize = portrait ? 0.043 * contentWidth : Math.max(1.45 * rootSize, Math.min(0.023 * viewportWidth, 2.2 * rootSize));
    expect(parseFloat(getComputedStyle(fixture.nativeElement.querySelector('.question')).fontSize)).toBeCloseTo(questionSize, 1);
    expect(parseFloat(getComputedStyle(fixture.nativeElement.querySelector('.options .text')).fontSize)).toBeCloseTo(optionSize, 1);
  });

  if (portrait) {
    it('manually advances every Shorts phase and reveals each answer on demand', () => {
      jasmine.clock().install();
      try {
        component.playbackMode = 'manual';
        component.questions = [question, { ...question, id: 'question-2' }];
        component.waiting = true;
        component.begin();
        fixture.detectChanges();
        expect(component.phase).toBe('hook');
        expect(fixture.nativeElement.querySelector('[aria-label="Next phase"]')).not.toBeNull();
        jasmine.clock().tick(60000);
        expect(component.phase).toBe('hook');

        component.manualNext();
        expect(component.phase).toBe('question');
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[aria-label="Show answer"]')).not.toBeNull();
        component.manualNext();
        expect(component.phase).toBe('answer');
        expect(component.revealed).toBeTrue();
        component.manualNext();
        expect(component.phase).toBe('question');
        expect(component.index).toBe(1);
        component.manualNext();
        expect(component.phase).toBe('answer');
        component.manualNext();
        expect(component.phase).toBe('cta');
        jasmine.clock().tick(60000);
        expect(component.finished).toBeFalse();
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[aria-label="Finish simulation"]')).not.toBeNull();
        component.manualNext();
        expect(component.finished).toBeTrue();
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('supports an optional on-demand countdown in manual Shorts playback', () => {
      jasmine.clock().install();
      try {
        component.playbackMode = 'manual';
        component.manualTimerEnabled = true;
        component.seconds = 2;
        component.questions = [question];
        component.waiting = true;
        component.begin();
        component.manualNext();
        expect(component.phase).toBe('question');
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('[aria-label="Start timer"]')).not.toBeNull();

        component.startManualTimer();
        fixture.detectChanges();
        expect(component.phase).toBe('countdown');
        jasmine.clock().tick(1000);
        expect(component.remaining).toBe(1);
        jasmine.clock().tick(1000);
        expect(component.phase).toBe('answer');
        expect(component.revealed).toBeTrue();
        expect(component.timerRunning).toBeFalse();
        component.manualNext();
        expect(component.phase).toBe('cta');
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('keeps the header and question in place when the countdown appears', () => {
      component.category = 'Assam Geography';
      component.questions = [question];
      for (const width of [280, 600]) {
        fixture.nativeElement.style.width = `${width}px`;
        component.phase = 'question';
        fixture.detectChanges();
        const header = fixture.nativeElement.querySelector('.top') as HTMLElement;
        const timer = fixture.nativeElement.querySelector('.countdown') as HTMLElement;
        const questionElement = fixture.nativeElement.querySelector('.question') as HTMLElement;
        const height = header.getBoundingClientRect().height;
        const questionTop = questionElement.getBoundingClientRect().top;
        expect(getComputedStyle(timer).visibility).toBe('hidden');
        expect(timer.getAttribute('aria-hidden')).toBe('true');
        component.phase = 'countdown';
        component.remaining = 5;
        fixture.detectChanges();
        expect(getComputedStyle(timer).visibility).toBe('visible');
        expect(timer.hasAttribute('aria-hidden')).toBeFalse();
        expect(header.getBoundingClientRect().height).toBeCloseTo(height, 1);
        expect(questionElement.getBoundingClientRect().top).toBeCloseTo(questionTop, 1);
        component.phase = 'answer';
        component.revealed = true;
        fixture.detectChanges();
        expect(header.getBoundingClientRect().height).toBeCloseTo(height, 1);
        expect(getComputedStyle(timer).visibility).toBe('hidden');
        component.revealed = false;
      }
    });

    it('starts the hook immediately after loading without a second Start screen', async () => {
      component.select(component.categories[0]);
      await component.start();
      fixture.detectChanges();
      expect(component.waiting).toBeFalse();
      expect(component.phase).toBe('hook');
      expect(fixture.nativeElement.querySelector('.start-btn')).toBeNull();
      expect(fixture.nativeElement.querySelector('.script-title').textContent).toBe(component.hookText);
    });

    it('uses the requested 25-second default timeline and a single hook and CTA for multiple questions', () => {
      jasmine.clock().install();
      try {
        component.questions = [question, { ...question, id: 'question-2' }];
        component.count = 1;
        expect(component.shortsDuration).toBe(25);
        component.count = 2;
        expect(component.shortsDuration).toBe(43);
        component.waiting = true;
        component.begin();
        const expectPhase = (phase: string) => {
          expect(component.phase).toBe(phase);
          fixture.detectChanges();
          expect(fixture.nativeElement.querySelector('.phase-label')).toBeNull();
        };
        expectPhase('hook');
        expect(fixture.nativeElement.querySelector('.script-title').textContent).toBe(component.hookText);
        jasmine.clock().tick(2999);
        expectPhase('hook');
        jasmine.clock().tick(1);
        expectPhase('question');
        expect(getComputedStyle(fixture.nativeElement.querySelector('.countdown')).visibility).toBe('hidden');
        jasmine.clock().tick(6999);
        expectPhase('question');
        jasmine.clock().tick(1);
        expectPhase('countdown');
        expect(component.remaining).toBe(5);
        expect(fixture.nativeElement.querySelector('.question')).not.toBeNull();
        expect(fixture.nativeElement.querySelectorAll('.options li').length).toBe(2);
        for (const remaining of [4, 3, 2, 1]) {
          jasmine.clock().tick(1000);
          expect(component.remaining).toBe(remaining);
          expect(component.revealed).toBeFalse();
        }
        jasmine.clock().tick(1000);
        expectPhase('answer');
        expect(component.revealed).toBeTrue();
        expect(fixture.nativeElement.querySelector('.answer-banner')).toBeNull();
        expect(fixture.nativeElement.querySelector('.options li.correct .text').textContent).toContain('B');
        jasmine.clock().tick(5999);
        expectPhase('answer');
        jasmine.clock().tick(1);
        expectPhase('question');
        expect(component.index).toBe(1);
        jasmine.clock().tick(7000 + 5000 + 6000);
        expectPhase('cta');
        expect(fixture.nativeElement.querySelector('.script-title').textContent).toBe(component.ctaPrompt);
        expect(fixture.nativeElement.querySelector('.script-cta').textContent).toBe(component.ctaText);
        jasmine.clock().tick(3999);
        expect(component.finished).toBeFalse();
        jasmine.clock().tick(1);
        expect(component.finished).toBeTrue();
        fixture.detectChanges();
        expect(fixture.nativeElement.textContent).toContain('Thank you!');
        expect(fixture.nativeElement.textContent).not.toContain('You completed');
        expect(fixture.nativeElement.querySelector('.top')).toBeNull();
        expect(fixture.nativeElement.querySelector('.steps')).toBeNull();
        expect(fixture.nativeElement.querySelector('.tools')).toBeNull();
        expect(fixture.nativeElement.querySelector('.finish-btn')).toBeNull();
        expect(fixture.nativeElement.querySelector('.thanks .logo')).not.toBeNull();
        const thanks = fixture.nativeElement.querySelector('.thanks') as HTMLElement;
        expect(thanks.querySelector('.script-cta')?.textContent).toBe('Follow for More');
        expect(Array.from(thanks.children).map((child) => child.className)).toEqual(['intro-title', 'plate', 'script-cta']);
        expect(getComputedStyle(thanks).alignItems).toBe('center');
        jasmine.clock().tick(2999);
        expect(component.finished).toBeTrue();
        expect(component.questions.length).toBe(2);
        jasmine.clock().tick(1);
        expect(component.questions).toEqual([]);
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('.picker')).not.toBeNull();
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('edits text and timing from the picker, validates settings and uses custom durations', async () => {
      component.select(component.categories[0]);
      const edit = (name: string, value: string) => {
        const input = fixture.nativeElement.querySelector(`[name="${name}"]`) as HTMLInputElement;
        input.value = value;
        input.dispatchEvent(new Event('input'));
        fixture.detectChanges();
      };
      edit('hookText', 'Custom hook');
      edit('ctaPrompt', 'Your score?');
      edit('ctaText', 'Follow us!');
      expect(fixture.nativeElement.querySelector('[name="answerLabel"]')).toBeNull();
      for (const name of ['hookSeconds', 'questionSeconds', 'seconds', 'answerSeconds', 'ctaSeconds']) edit(name, '1');
      expect(component.shortsDuration).toBe(17);
      edit('hookSeconds', '0');
      expect(component.canStart).toBeFalse();
      await component.start();
      expect(api.send).not.toHaveBeenCalled();
      expect(component.error).toContain('whole number');
      edit('hookSeconds', '1');
      edit('ctaText', ' ');
      expect(component.shortsValidation).toContain('Enter the hook');
      edit('ctaText', 'Follow us!');
      expect(component.canStart).toBeTrue();
      jasmine.clock().install();
      try {
        component.questions = [question];
        component.waiting = true;
        component.begin();
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('.script-title').textContent).toBe('Custom hook');
        jasmine.clock().tick(1000);
        expect(component.phase).toBe('question');
        jasmine.clock().tick(1000);
        expect(component.phase).toBe('countdown');
        jasmine.clock().tick(1000);
        expect(component.phase).toBe('answer');
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('.answer-banner')).toBeNull();
        expect(fixture.nativeElement.querySelectorAll('.options li.correct').length).toBe(1);
        jasmine.clock().tick(1000);
        expect(component.phase).toBe('cta');
        jasmine.clock().tick(1000);
        expect(component.finished).toBeTrue();
      } finally {
        jasmine.clock().uninstall();
      }
    });

    it('can hide explanations and disable sound, and cancels pending phases when stopped', () => {
      const audio = spyOn(window, 'AudioContext').and.callThrough();
      component.soundEnabled = false;
      component.showExplanation = false;
      component.questions = [{ ...question, explanation: 'Explanation' }];
      component.waiting = true;
      jasmine.clock().install();
      try {
        component.begin();
        jasmine.clock().tick(15000);
        fixture.detectChanges();
        expect(component.phase).toBe('answer');
        expect(fixture.nativeElement.querySelector('.explain')).toBeNull();
        expect(fixture.nativeElement.querySelector('.answer-banner')).toBeNull();
        expect(fixture.nativeElement.querySelectorAll('.options li.correct').length).toBe(1);
        component.stop();
        jasmine.clock().tick(60000);
        expect(component.questions).toEqual([]);
        expect(component.finished).toBeFalse();
      } finally {
        jasmine.clock().uninstall();
      }
      expect(audio).not.toHaveBeenCalled();
    });

    it('keeps a 9:16 canvas and stacked cards through intro, bilingual reveal and completion at different widths', () => {
      component.category = 'History';
      component.questions = [{
        ...question, language: 'en', questionText: 'What is the capital of Assam?',
        options: ['Jorhat', 'Dispur', 'Guwahati', 'Tezpur'],
        explanation: 'Dispur is the capital of Assam.',
        translation: {
          questionText: 'অসমৰ ৰাজধানী কি?', options: ['যোৰহাট', 'দিছপুৰ', 'গুৱাহাটী', 'তেজপুৰ'],
          explanation: 'দিছপুৰ অসমৰ ৰাজধানী।'
        }
      }];
      for (const width of [280, 600]) {
        fixture.nativeElement.style.width = `${width}px`;
        for (const state of ['intro', 'question', 'reveal', 'finished']) {
          component.waiting = state === 'intro';
          component.revealed = state === 'reveal';
          component.finished = state === 'finished';
          fixture.detectChanges();
          const stage = fixture.nativeElement.querySelector('.stage') as HTMLElement;
          const bounds = stage.getBoundingClientRect();
          expect(bounds.width / bounds.height).toBeCloseTo(9 / 16, 3);
          expect(bounds.width).toBeLessThanOrEqual(width);
          expect(stage.scrollWidth).toBeLessThanOrEqual(stage.clientWidth);
          if (state === 'question' || state === 'reveal') {
            const cards = stage.querySelectorAll<HTMLElement>('.options li');
            expect(cards.length).toBe(4);
            expect(cards[0].offsetLeft).toBe(cards[1].offsetLeft);
            expect(cards[1].offsetTop).toBeGreaterThan(cards[0].offsetTop);
            expect(stage.querySelector('.question .translation')).not.toBeNull();
          }
          if (state === 'reveal') expect(stage.querySelector('.explain')).not.toBeNull();
          if (state === 'finished') expect(stage.textContent).toContain('Thank you!');
        }
      }
    });
  }

  if (!portrait) it('beeps throughout each countdown, keeps the time-up tone and stays silent during reveals and after finish', () => {
    const frequency = jasmine.createSpyObj<AudioParam>('frequency', ['setValueAtTime']);
    frequency.value = 0;
    const oscillator = jasmine.createSpyObj<OscillatorNode>('OscillatorNode', ['connect', 'start', 'stop'], {
      frequency
    });
    const gain = jasmine.createSpyObj<GainNode>('GainNode', ['connect'], {
      gain: jasmine.createSpyObj<AudioParam>('AudioParam', ['setValueAtTime', 'exponentialRampToValueAtTime'])
    });
    oscillator.connect.and.callFake(() => gain);
    const audio = jasmine.createSpyObj<AudioContext>('AudioContext', ['createOscillator', 'createGain', 'close'], {
      currentTime: 0, state: 'running',
      destination: jasmine.createSpyObj<AudioDestinationNode>('destination', ['connect'])
    });
    audio.createOscillator.and.returnValue(oscillator);
    audio.createGain.and.returnValue(gain);
    audio.close.and.resolveTo();
    spyOn(window, 'AudioContext').and.returnValue(audio);

    jasmine.clock().install();
    try {
      component.seconds = 5;
      component.questions = [question, { ...question, id: 'question-2' }];
      component.waiting = true;
      component.begin();
      expect(audio.createOscillator).not.toHaveBeenCalled();
      for (let second = 1; second <= 5; second++) {
        jasmine.clock().tick(1000);
        expect(audio.createOscillator).toHaveBeenCalledTimes(second);
        expect(oscillator.frequency.value).toBe(second === 5 ? 1320 : 880);
        expect(oscillator.stop).toHaveBeenCalledWith((second === 5 ? 0.45 : 0.15) + 0.02);
      }
      expect(component.revealed).toBeTrue();
      jasmine.clock().tick(component.revealMs);
      expect(component.index).toBe(1);
      expect(audio.createOscillator).toHaveBeenCalledTimes(5);
      jasmine.clock().tick(5000);
      expect(audio.createOscillator).toHaveBeenCalledTimes(10);
      jasmine.clock().tick(component.revealMs + 10000);
      expect(component.finished).toBeTrue();
      expect(audio.createOscillator).toHaveBeenCalledTimes(10);
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('confirms the scope and refreshes available questions after reset', async () => {
    component.categories = [subject(0)];
    component.select(component.categories[0]);
    api.get.and.resolveTo([subject(10, false)]);
    const confirm = spyOn(window, 'confirm').and.returnValue(true);
    await component.resetHistory();
    expect(confirm).toHaveBeenCalledWith(jasmine.stringContaining('for all admins'));
    expect(confirm).toHaveBeenCalledWith(jasmine.stringContaining(portrait ? '9:16 simulation history' : 'regular simulation history'));
    expect(confirm).toHaveBeenCalledWith(jasmine.stringContaining('The other simulation format'));
    expect(api.send).toHaveBeenCalledOnceWith('post', '/simulation/reset', { category: 'History', mode });
    expect(component.maxCount).toBe(10);
    expect(component.canStart).toBeTrue();
    expect(component.selectedCategory?.canReset).toBeFalse();
    expect(component.notice).toContain('has been reset');
  });

  it('surfaces reset and start failures without clearing saved history locally', async () => {
    component.select(component.categories[0]);
    api.send.and.rejectWith(new Error('Failure'));
    spyOn(window, 'confirm').and.returnValue(true);
    await component.resetHistory();
    expect(component.error).toBe('Request failed.');
    expect(component.notice).toBe('');
    expect(component.selectedCategory?.canReset).toBeTrue();
    expect(component.resetting).toBeFalse();
    await component.start();
    expect(component.error).toBe('Request failed.');
    expect(component.questions).toEqual([]);
    expect(component.starting).toBeFalse();
  });
});
}
