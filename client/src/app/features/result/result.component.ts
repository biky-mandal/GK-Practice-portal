import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/auth.service';
import { ChartBar, ChartSlice } from '../../shared/charts/charts';

type ReviewTab = 'all' | 'correct' | 'incorrect' | 'unanswered' | 'review';

interface ReviewItem {
  number: number;
  status: 'correct' | 'incorrect' | 'unanswered';
  subject: string;
  categories?: string[];
  markedForReview: boolean;
  questionText: string;
  options: string[];
  selectedAnswer?: number;
  correctOption: number;
  explanation?: string;
  commonMisconceptions?: string[];
  optionExplanations?: string[];
  translation?: {
    questionText: string;
    options: string[];
    explanation?: string;
    optionExplanations?: string[];
    commonMisconceptions?: string[];
  } | null;
}

@Component({
  selector: 'app-result',
  templateUrl: './result.component.html',
  styleUrls: ['./result.component.css']
})
export class ResultComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  isLoading = true;
  loadError = false;
  get fromRecentTests(): boolean {
    return this.route.snapshot.queryParamMap.get('from') === 'recent-tests';
  }
  tab: ReviewTab = 'all';
  items: ReviewItem[] = [];
  outcomeSlices: ChartSlice[] = [];
  subjectBars: ChartBar[] = [];
  timeBars: ChartBar[] = [];

  readonly tabs: Array<{ key: ReviewTab; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'correct', label: 'Correct' },
    { key: 'incorrect', label: 'Incorrect' },
    { key: 'unanswered', label: 'Unanswered' },
    { key: 'review', label: 'Marked for review' }
  ];

  optionNote(item: ReviewItem, index: number): string {
    return item.optionExplanations?.[index] ?? '';
  }

  hasOptionExplanations(item: ReviewItem): boolean {
    return (item.optionExplanations ?? []).some((text) => Boolean(text));
  }

  count(tab: ReviewTab): number {
    return this.items.filter((item) => this.matches(item, tab)).length;
  }

  // Groups the current tab's questions into one section per subject.
  get sections(): Array<{ subject: string; items: ReviewItem[] }> {
    const groups = new Map<string, ReviewItem[]>();
    for (const item of this.items.filter((entry) => this.matches(entry, this.tab))) {
      groups.set(item.subject, [...(groups.get(item.subject) ?? []), item]);
    }
    return Array.from(groups, ([subject, items]) => ({ subject, items }));
  }

  private matches(item: ReviewItem, tab: ReviewTab): boolean {
    return tab === 'all' || (tab === 'review' ? item.markedForReview : item.status === tab);
  }

  private buildCharts() {
    this.items = (this.result.review ?? []).map((item: any, index: number): ReviewItem => ({
      ...item,
      number: index + 1,
      status: item.selectedAnswer === undefined ? 'unanswered' : item.isCorrect ? 'correct' : 'incorrect'
    }));

    this.outcomeSlices = [
      { label: 'Correct', value: this.result.correctAnswers, color: '#34a96b' },
      { label: 'Incorrect', value: this.result.incorrectAnswers, color: '#e0584f' },
      { label: 'Unanswered', value: this.result.unansweredQuestions, color: '#b8c4d3' }
    ];

    const bySubject = new Map<string, { correct: number; total: number }>();
    for (const item of this.items) {
      const entry = bySubject.get(item.subject) ?? { correct: 0, total: 0 };
      entry.total += 1;
      if (item.status === 'correct') entry.correct += 1;
      bySubject.set(item.subject, entry);
    }
    this.subjectBars = Array.from(bySubject, ([subject, value]) => ({
      label: subject,
      value: Math.round((value.correct / value.total) * 100),
      caption: `${value.correct}/${value.total}`
    }));

    const used = Math.round((this.result.timeTakenSeconds ?? 0) / 60 * 10) / 10;
    const allotted = Math.round((this.result.totalSeconds ?? 0) / 60 * 10) / 10;
    this.timeBars = allotted
      ? [
          { label: 'Time used', value: used, color: '#6b8ede', caption: `${used} min` },
          { label: 'Time allotted', value: allotted, color: '#b8c4d3', caption: `${allotted} min` }
        ]
      : [];
  }

  result: any = {
    score: 0,
    totalQuestions: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    unansweredQuestions: 0,
    percentage: 0,
    review: []
  };

  ngOnInit(): void {
    this.loadResult();
  }

  loadResult(): void {
    const attemptId = this.route.snapshot.paramMap.get('attemptId');
    if (!attemptId) {
      this.router.navigateByUrl('/dashboard');
      return;
    }

    this.isLoading = true;
    this.loadError = false;
    this.http.get(`${this.auth.apiBase}/tests/${attemptId}/result`).subscribe({
      next: (response: any) => {
        this.result = response.data ?? this.result;
        this.buildCharts();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.loadError = true;
      }
    });
  }
}
