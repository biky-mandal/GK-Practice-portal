import { Component, OnInit, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { PricingService } from '../../core/pricing.service';
import { packageImageFor } from '../../shared/package-images';
import { LANGUAGE_NOTE, NO_SUBSCRIPTION_NOTE, PYQ_PITCH } from '../../shared/pricing';

interface SubjectRow {
  name: string;
  mcq: number;
  marks: number;
}

interface Paper {
  grade: string;
  name: string;
  duration: string;
  questions: number;
  marks: number;
  negative: string;
  subjects: string[];
  breakdown?: SubjectRow[];
  note: string;
}

const GRADE_IV_SUBJECTS = ['English', 'Social Studies', 'Mathematics', 'General Knowledge', 'Mental Ability and Logical Reasoning'];

const PAPERS: Paper[] = [
  {
    grade: 'Grade-III',
    name: 'Driver (HSLC)',
    duration: '3 hours',
    questions: 150,
    marks: 150,
    negative: '1/4th of the marks per wrong answer (0.25 on a 1-mark question)',
    subjects: ['Social Studies', 'General Knowledge', 'Logical Reasoning and Mental Ability', 'General English', 'General Mathematics', 'Road Transport'],
    breakdown: [
      { name: 'Social Studies', mcq: 20, marks: 20 },
      { name: 'General Knowledge', mcq: 30, marks: 30 },
      { name: 'Logical Reasoning and Mental Ability', mcq: 20, marks: 20 },
      { name: 'General English', mcq: 30, marks: 30 },
      { name: 'General Mathematics', mcq: 30, marks: 30 },
      { name: 'Road Transport', mcq: 20, marks: 20 }
    ],
    note: 'Road Transport covers traffic rules, vehicle regulations and road safety. Question counts per subject are approximate; the total stays 150.'
  },
  {
    grade: 'Grade-III',
    name: 'Higher Secondary (HSSLC)',
    duration: '3 hours',
    questions: 150,
    marks: 150,
    negative: '1/4th of the marks per wrong answer (0.25 on a 1-mark question)',
    subjects: ['Social Studies', 'General Knowledge', 'Logical Reasoning and Mental Ability', 'General English', 'General Mathematics'],
    breakdown: [
      { name: 'Social Studies', mcq: 30, marks: 30 },
      { name: 'General Knowledge', mcq: 30, marks: 30 },
      { name: 'Logical Reasoning and Mental Ability', mcq: 20, marks: 20 },
      { name: 'General English', mcq: 35, marks: 35 },
      { name: 'General Mathematics', mcq: 35, marks: 35 }
    ],
    note: 'General English and General Mathematics carry the highest weightage. Focus on them along with General Knowledge.'
  },
  {
    grade: 'Grade-III',
    name: 'Bachelor\u2019s Degree',
    duration: '3 hours',
    questions: 150,
    marks: 175,
    negative: '1/4th of the marks per wrong answer (0.25 on 1 mark, 0.50 on 2 marks)',
    subjects: ['Social Studies', 'General Knowledge', 'Logical Reasoning and Mental Ability', 'General Mathematics', 'General English', 'Reading Comprehension and English Language'],
    breakdown: [
      { name: 'Social Studies', mcq: 30, marks: 30 },
      { name: 'General Knowledge', mcq: 35, marks: 35 },
      { name: 'Logical Reasoning and Mental Ability', mcq: 20, marks: 20 },
      { name: 'General Mathematics', mcq: 30, marks: 30 },
      { name: 'General English', mcq: 10, marks: 10 },
      { name: 'Reading Comprehension and English Language', mcq: 25, marks: 50 }
    ],
    note: 'The only paper where total marks (175) exceed the number of questions. Reading Comprehension and English Language questions carry 2 marks each, so a wrong answer costs 0.50.'
  },
  {
    grade: 'Grade-IV',
    name: 'Class VIII',
    duration: '2 hours 30 minutes',
    questions: 135,
    marks: 135,
    negative: '0.25 marks per wrong answer',
    subjects: GRADE_IV_SUBJECTS,
    note: 'Based on the SCERT Assam Elementary School Pass level syllabus. Every question carries 1 mark.'
  },
  {
    grade: 'Grade-IV',
    name: 'Class X (Matriculation)',
    duration: '2 hours 30 minutes',
    questions: 135,
    marks: 135,
    negative: '0.25 marks per wrong answer',
    subjects: GRADE_IV_SUBJECTS,
    note: 'Follows the HSLC syllabus of the Board of Secondary Education, Assam. ITI-pass candidates in listed trades also apply here. Candidates qualified above HSSLC are not eligible for Grade-IV posts.'
  }
];

const FACTS = [
  { label: 'Exam', value: 'Assam Direct Recruitment Examination (ADRE 3.0)' },
  { label: 'Posts', value: 'Grade-III and Grade-IV' },
  { label: 'Expected vacancies', value: '10,000 - 15,000 (to be confirmed)' },
  { label: 'Organisation', value: 'State Level Recruitment Commission (SLRC)' },
  { label: 'Exam authority', value: 'Assam State School Education Board (ASSEB), formerly SEBA' },
  { label: 'Expected exam date', value: 'Second half of 2026, after the Assembly elections' },
  { label: 'Mode', value: 'Offline (OMR-based)' },
  { label: 'Type', value: 'Written examination, multiple choice questions' },
  { label: 'Medium', value: 'Assamese, Bengali, Bodo, English and Hindi' }
];

const SYLLABUS = [
  { icon: '🌏', subject: 'General Knowledge', text: 'Current affairs (national and international), new inventions, scientific observations, world organisations, famous places in India, and general awareness about India and Assam.' },
  { icon: '📚', subject: 'Social Studies', text: 'Physical Geography of India and the world, economic and social geography, Geography of Assam, Ancient, Medieval and Modern Indian History, Freedom Struggle, History of Assam, Indian Constitution and basic Civics.' },
  { icon: '✍️', subject: 'General English', text: 'Sentence correction, error spotting, fill in the blanks, idioms and phrases, synonyms, antonyms, one-word substitution, cloze test and subject-verb agreement. Reading Comprehension tests passage-based comprehension, vocabulary and inference.' },
  { icon: '🧮', subject: 'General Mathematics', text: 'Number system, percentage, profit and loss, simple and compound interest, time and work, time speed and distance, ratio and proportion, averages and basic geometry.' },
  { icon: '🧩', subject: 'Logical Reasoning and Mental Ability', text: 'Number series, coding-decoding, analogies, blood relations, direction sense, statement and conclusion, embedded figures, pattern recognition and syllogism.' }
];

@Component({
  selector: 'app-adre',
  templateUrl: './adre.component.html',
  styleUrls: ['./adre.component.css']
})
export class AdreComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly pricing = inject(PricingService);
  readonly packageImageFor = packageImageFor;

  ngOnInit() {
    this.pricing.load();
  }
  get plans() { return this.pricing.plansFor('adre'); }
  get subjectPlan() { return this.plans.find((plan) => plan.id === 'subject'); }
  readonly note = NO_SUBSCRIPTION_NOTE;
  readonly languageNote = LANGUAGE_NOTE;
  readonly papers = PAPERS;
  readonly facts = FACTS;
  readonly syllabus = SYLLABUS;
  selectedPaper = 0;

  get paper(): Paper {
    return this.papers[this.selectedPaper];
  }

  readonly pyq = PYQ_PITCH;
  readonly pyqYears = ['ADRE 1.0 (2022)', 'ADRE 2.0 (2024)'];
  readonly pyqPapers = ['Grade-III · Paper-III (HSSLC)', 'Grade-III · Paper-IV (Degree)', 'Grade-III · Paper-V (Driver)', 'Grade-IV · Paper-I (HSLC)', 'Grade-IV · Paper-II (Class VIII)'];

  readonly included = [
    { icon: '📜', title: '10 Previous Year papers', text: 'ADRE 1.0 (2022) and ADRE 2.0 (2024), all five papers each, in the original order with a real exam timer.' },
    { icon: '📝', title: '2,000+ section-wise questions', text: 'Category-wise and section-wise questions tagged for ADRE 3.0 so every session targets what you are preparing for.' },
    { icon: '⏱️', title: 'Real exam timing', text: 'One minute per question, tracked on the server. Pause and resume whenever life interrupts.' },
    { icon: '🔒', title: 'No answer spoilers', text: 'Answers and explanations unlock only after you submit, just like the real paper.' },
    { icon: '📊', title: 'Analytics that guide revision', text: 'Accuracy by category in pie and bar charts, so you know where to spend your next hour.' }
  ];

  readonly faqs = [
    { q: 'What are the PYQ papers?', a: 'Previous Year Question papers from ADRE 1.0 (2022) and ADRE 2.0 (2024). Each exam has five papers (Grade-III Paper-III, IV, V and Grade-IV Paper-I, II), so the PYQ Test Series includes 10 full papers you can attempt in the original order with a timer.' },
    { q: 'Is this a subscription?', a: 'No. Each ADRE 3.0 Test Series is a one-time payment. You are never billed again and you keep access.' },
    { q: 'Can I try before buying?', a: 'Yes. A free daily sample of ADRE 3.0 questions is available before you buy. Every question is shown in English and Assamese together.' },
  { q: 'Which Test Series should I buy?', a: 'Subject Wise Practice for topic-by-topic preparation, PYQ Practice for the real ADRE 1.0 (2022) and ADRE 2.0 (2024) papers, and the 10 Full Length Mocks for exam-day simulation. Each is a separate one-time purchase.' },
    { q: 'Will new questions be added?', a: 'Yes. Updates to the Test Series are included in your one-time purchase.' },
    { q: 'Is the ADRE 3.0 syllabus official?', a: 'Not yet. The syllabus and pattern here follow ADRE 2.0 (released 15 July 2024) and the SLRC framework. ADRE 3.0 may introduce changes such as a two-phase exam. We update this page as soon as SLRC publishes the official syllabus.' }
  ];

  get startLink(): string {
    return this.auth.userSignal() ? '/dashboard' : '/login';
  }

  scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
