import { CommonModule } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Subject } from 'rxjs';

import { PracticeSocketService, ServerMessage } from '../../core/practice-socket.service';
import { PracticeComponent } from './practice.component';

describe('PracticeComponent', () => {
  let fixture: ComponentFixture<PracticeComponent>;
  let messages$: Subject<ServerMessage>;
  const sent: unknown[] = [];

  beforeEach(async () => {
    sessionStorage.clear();
    messages$ = new Subject<ServerMessage>();
    sent.length = 0;

    await TestBed.configureTestingModule({
      declarations: [PracticeComponent],
      imports: [CommonModule, RouterTestingModule, HttpClientTestingModule, NoopAnimationsModule, MatCardModule, MatButtonModule, MatProgressSpinnerModule, MatSnackBarModule],
      providers: [{
        provide: PracticeSocketService,
        useValue: { messages$, connected$: new Subject<boolean>(), send: (m: unknown) => sent.push(m), disconnect: () => undefined }
      }]
    }).compileComponents();

    fixture = TestBed.createComponent(PracticeComponent);
    fixture.detectChanges();
  });

  it('shows a spinner while waiting for questions', () => {
    expect(fixture.nativeElement.querySelector('.page-loading mat-spinner')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Getting your questions ready');
  });

  it('requests a session on init and renders questions from the socket', () => {
    expect(sent[0]).toEqual({ type: 'session.resume' });

    messages$.next({
      type: 'session.started',
      attemptId: 'a1',
      totalQuestions: 1,
      categories: [],
      pack: 'subject',
      mock: null,
      pyq: null,
      kind: 'practice',
      questions: [{ id: 'q1', questionText: 'Sample question', options: ['A', 'B'], subject: 'GK', topic: 'History', difficulty: 'Easy' }],
      answers: {},
      timer: { totalSeconds: 60, remainingSeconds: 60 },
      markedForReview: []
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Sample question');
  });
});
