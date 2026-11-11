import { Component, OnInit, inject } from '@angular/core';
import { AdminApi } from './admin.api';
import { ADMIN_STYLES } from './admin-styles';
import { ActivatedRoute } from '@angular/router';

interface CategoryRow {
  id: string;
  name: string;
  count: number;
  editName?: string;
}

@Component({
  selector: 'app-admin-categories',
  template: `
    <div class="card">
      <h2>{{ isExams ? 'Exam management' : 'Subjects / categories' }}</h2>
      <p class="muted">{{ isExams ? 'These appear in question filters, the question editor and upload form.' : 'These appear in the question editor, upload form and practice screens.' }} Renaming updates every question that uses it; deleting removes it from those questions.</p>
      <form (ngSubmit)="add()" style="display: flex; gap: 8px; margin: 12px 0">
        <input name="newName" [(ngModel)]="newName" maxlength="100" [placeholder]="isExams ? 'New exam' : 'New subject / category'" style="flex: 1" />
        <button class="btn primary" type="submit" [disabled]="!newName.trim()">Add</button>
      </form>
      <div class="scroll">
        <table>
          <tr><th>Name</th><th>Questions</th><th></th></tr>
          <tr *ngFor="let c of rows">
            <td>
              <ng-container *ngIf="c.editName === undefined; else editing">{{ c.name }}</ng-container>
              <ng-template #editing><input [(ngModel)]="c.editName" maxlength="100" style="width: 100%" (keyup.enter)="save(c)" /></ng-template>
            </td>
            <td>{{ c.count }}</td>
            <td class="actions">
              <ng-container *ngIf="c.editName === undefined; else editButtons">
                <button type="button" class="ib" aria-label="Edit" title="Edit" (click)="c.editName = c.name">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"></path><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"></path></svg>
                </button>
                <button type="button" class="ib danger" aria-label="Delete" title="Delete" (click)="remove(c)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="m19 6-1 14H6L5 6"></path><path d="M10 11v5M14 11v5"></path></svg>
                </button>
              </ng-container>
              <ng-template #editButtons>
                <button type="button" class="ib" aria-label="Save" title="Save" (click)="save(c)">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5L20 7"></path></svg>
                </button>
                <button type="button" class="ib" aria-label="Cancel" title="Cancel" (click)="c.editName = undefined">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"></path></svg>
                </button>
              </ng-template>
            </td>
          </tr>
        </table>
      </div>
      <p class="error" *ngIf="error">{{ error }}</p>
    </div>
  `,
  styles: [ADMIN_STYLES, `
    .actions { white-space: nowrap; }
    .ib + .ib { margin-left: 0.5rem; }
    .ib { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border: 1px solid #d3deea; border-radius: 8px; background: #fff; color: #173b5b; cursor: pointer; }
    .ib:hover { background: #eef4fb; }
    .ib.danger { color: #b9332e; }
    .ib.danger:hover { background: #fdeceb; }
    .ib svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  `]
})
export class AdminCategoriesComponent implements OnInit {
  private readonly api = inject(AdminApi);
  readonly isExams = inject(ActivatedRoute).snapshot.data['manageExams'] === true;
  private readonly endpoint = this.isExams ? '/exams' : '/categories';
  rows: CategoryRow[] = [];
  newName = '';
  error = '';

  ngOnInit() {
    this.load();
  }

  async load() {
    try {
      this.rows = await this.api.get<CategoryRow[]>(this.endpoint);
    } catch (e) {
      this.error = this.api.message(e);
    }
  }

  private async run(action: () => Promise<unknown>) {
    this.error = '';
    try {
      await action();
      await this.load();
    } catch (e) {
      this.error = this.api.message(e);
    }
  }

  add() {
    const name = this.newName.trim();
    if (!name) return;
    return this.run(async () => {
      await this.api.send('post', this.endpoint, { name });
      this.newName = '';
    });
  }

  save(c: CategoryRow) {
    const name = (c.editName ?? '').trim();
    if (!name || name === c.name) {
      c.editName = undefined;
      return;
    }
    return this.run(() => this.api.send('put', `${this.endpoint}/${c.id}`, { name }));
  }

  remove(c: CategoryRow) {
    if (!confirm(`Delete "${c.name}"? It will be removed from ${c.count} question(s).`)) return;
    return this.run(() => this.api.send('delete', `${this.endpoint}/${c.id}`));
  }
}
