import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { ResultComponent } from './result.component';
import { MathTextDirective } from '../../shared/math-text.directive';
import { BarChartComponent, PieChartComponent } from '../../shared/charts/charts';

describe('ResultComponent', () => {
  let component: ResultComponent;
  let fixture: ComponentFixture<ResultComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ResultComponent],
      imports: [
        RouterTestingModule,
        HttpClientTestingModule,
        NoopAnimationsModule,
        MatCardModule,
        MatButtonModule,
        MathTextDirective,
        BarChartComponent,
        PieChartComponent
      ],
      providers: [{
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: convertToParamMap({ attemptId: 'attempt-1' }), queryParamMap: convertToParamMap({ from: 'recent-tests' }) } }
      }]
    }).compileComponents();

    fixture = TestBed.createComponent(ResultComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows every option, the attempted answer, and a link back to recent tests', () => {
    TestBed.inject(HttpTestingController).expectOne((request) => request.url.endsWith('/tests/attempt-1/result')).flush({
      data: {
        score: 0, totalQuestions: 1, correctAnswers: 0, incorrectAnswers: 1, unansweredQuestions: 0, percentage: 0,
        review: [{ questionText: 'Question?', subject: 'General', options: ['First', 'Second', 'Third', 'Fourth'], selectedAnswer: 1, correctOption: 0, isCorrect: false }]
      }
    });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const options = element.querySelectorAll('.answer-options li');
    expect(options.length).toBe(4);
    expect(options[0].textContent).toContain('First');
    expect(options[0].textContent).toContain('Correct answer');
    expect(options[1].textContent).toContain('Second');
    expect(options[1].textContent).toContain('Your answer');
    expect(options[3].textContent).toContain('Fourth');
    expect(element.textContent).toContain('Back to Recent Tests');
  });

  it('shows an error and retries when the result cannot be loaded', () => {
    const http = TestBed.inject(HttpTestingController);
    http.expectOne((request) => request.url.endsWith('/tests/attempt-1/result')).flush('error', { status: 500, statusText: 'Error' });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain('Could not load');
    component.loadResult();
    http.expectOne((request) => request.url.endsWith('/tests/attempt-1/result')).flush({ data: {
      score: 0, correctAnswers: 0, incorrectAnswers: 0, unansweredQuestions: 0, review: []
    } });
    expect(component.loadError).toBeFalse();
  });
});
