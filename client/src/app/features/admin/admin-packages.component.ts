import { Component, OnDestroy, OnInit, TemplateRef, ViewChild, inject } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { PackPrice } from '../../core/pricing.service';
import { PLANS } from '../../shared/pricing';
import { AdminApi } from './admin.api';
import { ADMIN_STYLES } from './admin-styles';

interface ContentOption {
  id: string;
  name: string;
  description: string;
  group: 'adre' | 'police-forest';
  access: string[];
  archived: boolean;
  sortOrder: number;
}

interface ContentCatalog {
  options: ContentOption[];
  modes: Array<{ id: string; name: string }>;
}

@Component({
  selector: 'app-admin-packages',
  template: `
    <section class="card">
      <div class="toolbar"><div><h2>Packages</h2><p class="muted">Manage the packages shown to learners. New packages can bundle existing practice content.</p></div>
        <div class="actions">
          <button class="btn" (click)="openContentManager()" [disabled]="loading || loadFailed">Manage content options</button>
          <button class="btn primary" (click)="create()" [disabled]="saving || loading || loadFailed">Create package</button>
        </div>
      </div>
      <p *ngIf="loading" role="status">Loading packages...</p>
      <p class="error" *ngIf="error" role="alert">{{ error }}</p>
      <button *ngIf="loadFailed" class="btn" (click)="load()">Retry loading</button>
      <p *ngIf="notice" role="status">{{ notice }}</p>
      <div class="scroll"><table *ngIf="!loading && !loadFailed">
        <thead><tr><th>Package</th><th>Collection</th><th>Price</th><th>Status</th><th>Order</th><th>Actions</th></tr></thead>
        <tbody><tr *ngFor="let p of packages">
          <td><strong>{{ p.name }}</strong><br><small>{{ p.pack }}</small></td>
          <td>{{ p.group === 'adre' ? 'ADRE' : 'Police / Forest' }}</td>
          <td>{{ p.price | currency:'INR' }}</td>
          <td>{{ p.archived ? 'Archived' : !p.visible ? 'Hidden' : p.enabled ? 'On sale' : 'Not on sale' }}</td>
          <td>{{ p.sortOrder }}</td>
          <td><button class="btn small" (click)="edit(p)" [disabled]="saving || loadFailed">Edit</button>
            <button class="btn small" (click)="archive(p)" [disabled]="saving || contentSaving">{{ p.archived ? 'Restore' : 'Archive' }}</button></td>
        </tr></tbody>
      </table></div>
    </section>
    <ng-template #contentManager>
    <section class="card popup">
      <div class="toolbar"><div><h2>Content options</h2>
        <p class="muted">Create reusable choices for packages. Each option unlocks one or more existing practice modes, not a new question bank.</p></div>
        <button type="button" class="btn" (click)="managerDialog?.close()" aria-label="Close content options">Close</button>
        <button class="btn primary" (click)="newContent()" [disabled]="contentSaving || loading || loadFailed">Add content option</button>
      </div>
      <p class="error" *ngIf="contentError" role="alert">{{ contentError }}</p>
      <p *ngIf="contentNotice" role="status">{{ contentNotice }}</p>
      <div class="scroll"><table>
        <thead><tr><th>Option</th><th>Collection</th><th>Unlocks</th><th>Status</th><th></th></tr></thead>
        <tbody><tr *ngFor="let option of contentOptions">
          <td><strong>{{ option.name }}</strong><br><small>{{ option.id }}</small></td>
          <td>{{ groupName(option.group) }}</td><td>{{ modeNames(option.access) }}</td>
          <td>{{ option.archived ? 'Archived' : 'Active' }}</td>
          <td><button class="btn small" (click)="editContent(option)" [disabled]="contentSaving || saving">Edit</button></td>
        </tr></tbody>
      </table></div>
    </section>
    </ng-template>
    <ng-template #contentEditor>
    <section class="card popup" *ngIf="contentDraft as c">
      <div class="toolbar">
        <h2>{{ creatingContent ? 'Add content option' : 'Edit content option' }}</h2>
        <button type="button" class="btn" (click)="closeContentEditor()" [disabled]="contentSaving" aria-label="Close content editor">Close</button>
      </div>
      <form #contentForm="ngForm" (ngSubmit)="saveContent()">
        <p class="muted">Changes to mappings apply when a package is next saved. Existing packages and purchases keep their saved access. The five original packages must still unlock their own practice mode.</p>
        <div class="fields">
          <label>Option ID<input name="contentId" [(ngModel)]="c.id" required pattern="[a-z][a-z0-9-]{0,59}" maxlength="60" [disabled]="!creatingContent || contentSaving"></label>
          <label>Display name<input name="contentName" [(ngModel)]="c.name" required maxlength="120"></label>
          <label>Collection<select name="contentGroup" [(ngModel)]="c.group"><option value="adre">ADRE 3.0</option><option value="police-forest">Assam Police and Forest</option></select></label>
          <label>Display order<input name="contentOrder" type="number" [(ngModel)]="c.sortOrder" required min="0" max="10000" step="1"></label>
        </div>
        <label>Description<textarea name="contentDescription" [(ngModel)]="c.description" maxlength="500" rows="2"></textarea></label>
        <fieldset><legend>Practice modes unlocked</legend>
          <label class="check" *ngFor="let mode of practiceModes">
            <input type="checkbox" [checked]="c.access.includes(mode.id)" (change)="toggleContentMode(mode.id)" [disabled]="contentSaving || (!creatingContent && mode.id === c.id)">{{ mode.name }}
          </label>
        </fieldset>
        <label class="check"><input type="checkbox" name="contentArchived" [(ngModel)]="c.archived">Archived (not offered for new selections)</label>
        <p class="error" *ngIf="contentError" role="alert">{{ contentError }}</p>
        <div class="actions">
          <button type="submit" class="btn primary" [disabled]="contentSaving || contentForm.invalid || !c.access.length">{{ contentSaving ? 'Saving...' : 'Save content option' }}</button>
          <button type="button" class="btn" (click)="closeContentEditor()" [disabled]="contentSaving">Cancel</button>
        </div>
      </form>
    </section>
    </ng-template>
    <ng-template #packageEditor>
    <section class="card popup" *ngIf="draft as d">
      <div class="toolbar">
        <h2>{{ creating ? 'Create package' : 'Edit package' }}</h2>
        <button type="button" class="btn" (click)="closePackageEditor()" [disabled]="saving" aria-label="Close package editor">Close</button>
      </div>
      <p class="muted">Existing purchases keep the content granted at purchase time. Archiving or hiding stops new purchases, not existing access.</p>
      <form #form="ngForm" (ngSubmit)="save()">
        <div class="fields">
          <label>Package ID<input name="pack" [(ngModel)]="d.pack" [disabled]="!creating || saving" required pattern="[a-z][a-z0-9-]{0,59}" maxlength="60"><small>Lowercase letters, digits and hyphens; cannot be changed later.</small></label>
          <label>Name<input name="name" [(ngModel)]="d.name" required maxlength="160"></label>
          <label>Collection<select name="group" [(ngModel)]="d.group"><option value="adre">ADRE</option><option value="police-forest">Assam Police and Forest</option></select></label>
          <label>Display order<input name="sortOrder" type="number" [(ngModel)]="d.sortOrder" required min="0" max="10000" step="1"></label>
          <label>Selling price (INR)<input name="price" type="number" [(ngModel)]="d.price" required min="0" max="100000" step="0.01"></label>
          <label>Original price (optional)<input name="originalPrice" type="number" [(ngModel)]="d.originalPrice" min="0" max="100000" step="0.01"></label>
        </div>
        <label>Description<textarea name="description" [(ngModel)]="d.description" maxlength="1000" rows="3"></textarea></label>
        <label>Features (one per line, up to 20)<textarea name="perks" [(ngModel)]="perksText" rows="6"></textarea></label>
        <fieldset class="content-picker"><legend>Content unlocked</legend>
          <div class="toolbar">
            <p class="muted">Choose what learners can practise with this package. You can combine both collections.</p>
            <button type="button" class="btn small" (click)="openContentManager()" [disabled]="saving">Manage options</button>
          </div>
          <p class="muted">This preview uses the current option mappings. Save the package to apply them to future purchases; existing learners keep their access.</p>
          <div class="selection-summary" aria-live="polite">{{ selectedContentIds.length }} selected · {{ d.access.length }} practice modes unlocked</div>
          <section class="content-group" *ngFor="let group of contentGroups">
            <div class="toolbar">
              <h3>{{ group.label }} <small>{{ optionsFor(group.id).length }} options</small></h3>
              <button type="button" class="btn small" (click)="selectGroup(group.id)" [disabled]="saving || !activeOptionsFor(group.id).length">{{ groupSelected(group.id) ? 'Clear group' : 'Select all' }}</button>
            </div>
            <div class="content-grid">
              <label class="content-choice" *ngFor="let content of optionsFor(group.id)" [class.selected]="selectedContentIds.includes(content.id)" [class.archived]="content.archived">
                <input type="checkbox" [checked]="selectedContentIds.includes(content.id)" (change)="toggleAccess(content.id)"
                  [disabled]="saving || (content.archived && !selectedContentIds.includes(content.id))">
                <span class="choice-copy"><strong>{{ content.name }}</strong>
                  <span>{{ content.description }}</span>
                  <small>Unlocks: {{ modeNames(content.access) }}</small>
                  <span class="choice-state">{{ content.archived ? 'Archived - retained selection' : selectedContentIds.includes(content.id) ? 'Selected' : 'Select option' }}</span>
                </span>
              </label>
            </div>
            <p class="muted" *ngIf="!optionsFor(group.id).length">No active content options in this collection. Add one with Manage options.</p>
          </section>
          <div class="access-preview" *ngIf="d.access.length"><strong>Access preview</strong><p>{{ modeNames(d.access) }}</p></div>
          <p class="muted" *ngIf="!selectedContentIds.length">Select at least one content option to save this package.</p>
        </fieldset>
        <div class="options">
          <label class="check"><input type="checkbox" name="visible" [(ngModel)]="d.visible">Show to users</label>
          <label class="check"><input type="checkbox" name="enabled" [(ngModel)]="d.enabled">Available for purchase</label>
          <label class="check"><input type="checkbox" name="highlight" [(ngModel)]="d.highlight">Featured</label>
          <label class="check"><input type="checkbox" name="archived" [(ngModel)]="d.archived">Archived</label>
        </div>
        <p class="error" *ngIf="editError" role="alert">{{ editError }}</p>
        <div class="actions">
          <button class="btn primary" type="submit" [disabled]="saving || contentSaving || loadFailed || form.invalid || !selectedContentIds.length || !d.access.length">{{ saving ? 'Saving...' : 'Save package' }}</button>
          <button class="btn" type="button" (click)="closePackageEditor()" [disabled]="saving">Cancel</button>
        </div>
      </form>
    </section>
    </ng-template>
  `,
  styles: [ADMIN_STYLES, `
    .toolbar, .options { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; justify-content: space-between; }
    .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
    label { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
    .check { flex-direction: row; align-items: center; justify-content: flex-start; }
    .check input { width: auto; }
    input, select, textarea { padding: 10px; border: 1px solid #d3deea; border-radius: 8px; font: inherit; max-width: 100%; }
    fieldset { border: 1px solid #d3deea; border-radius: 8px; margin: 0 0 16px; }
    small { color: #536a82; } td button { margin: 3px; }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .content-picker { padding: 20px; }
    .content-picker legend { padding: 0 8px; font-size: 1.1rem; font-weight: 700; color: #173b5b; }
    .selection-summary { padding: 10px 14px; border-radius: 8px; background: #eef4fb; color: #173b5b; font-weight: 600; }
    .content-group { margin: 16px 0 24px; }
    .content-group h3 { margin: 10px 0; color: #173b5b; }
    .content-group h3 small { font-size: .8rem; font-weight: 400; margin-left: 8px; }
    .content-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 12px; }
    .content-choice { display: flex; flex-direction: row; align-items: flex-start; gap: 12px; margin: 0; padding: 16px;
      border: 2px solid #e1e8f0; border-radius: 12px; background: #fff; cursor: pointer; min-width: 0; }
    .content-choice:hover { border-color: #93afca; }
    .content-choice.selected { border-color: #267558; background: #f0faf5; }
    .content-choice:focus-within { outline: 3px solid #adcbe8; outline-offset: 2px; }
    .content-choice input { width: 18px; height: 18px; margin: 3px 0 0; flex-shrink: 0; accent-color: #267558; }
    .choice-copy { display: flex; flex-direction: column; gap: 6px; overflow-wrap: anywhere; color: #536a82; }
    .choice-copy strong { color: #173b5b; }
    .choice-state { font-size: .78rem; font-weight: 700; }
    .selected .choice-state { color: #216346; }
    .archived { border-style: dashed; }
    .access-preview { border-top: 1px solid #d3deea; padding-top: 16px; color: #173b5b; }
    .access-preview p { margin-bottom: 0; }
    .popup { box-sizing: border-box; margin: 0; padding: 24px; max-height: 90dvh; overflow-y: auto; }
    @media (max-width: 600px) {
      .popup { padding: 16px; }
      .fields { grid-template-columns: minmax(0, 1fr); }
    }
  `]
})
export class AdminPackagesComponent implements OnInit, OnDestroy {
  private readonly api = inject(AdminApi);
  private readonly dialog = inject(MatDialog);
  @ViewChild('packageEditor', { static: true }) private packageEditor!: TemplateRef<unknown>;
  @ViewChild('contentManager', { static: true }) private contentManager!: TemplateRef<unknown>;
  @ViewChild('contentEditor', { static: true }) private contentEditor!: TemplateRef<unknown>;
  private packageDialog: MatDialogRef<unknown> | null = null;
  private contentDialog: MatDialogRef<unknown> | null = null;
  managerDialog: MatDialogRef<unknown> | null = null;
  readonly contentGroups: Array<{ id: ContentOption['group']; label: string }> = [
    { id: 'adre', label: 'ADRE 3.0' }, { id: 'police-forest', label: 'Assam Police and Forest' }
  ];
  contentOptions: ContentOption[] = [];
  practiceModes: ContentCatalog['modes'] = [];
  selectedContentIds: string[] = [];
  contentDraft: ContentOption | null = null;
  creatingContent = false;
  contentSaving = false;
  contentError = '';
  contentNotice = '';
  packages: PackPrice[] = [];
  draft: PackPrice | null = null;
  perksText = '';
  creating = false;
  loading = false;
  loadFailed = false;
  saving = false;
  error = '';
  editError = '';
  notice = '';

  ngOnInit() { void this.load(); }

  ngOnDestroy() {
    this.contentDialog?.close();
    this.managerDialog?.close();
    this.packageDialog?.close();
  }

  openContentManager() {
    if (this.managerDialog) return;
    const ref = this.dialog.open(this.contentManager, {
      width: '1100px', maxWidth: '96vw', maxHeight: '90dvh', ariaLabel: 'Manage content options'
    });
    this.managerDialog = ref;
    ref.afterClosed().subscribe(() => { this.managerDialog = null; });
  }

  private openPackageEditor() {
    if (this.packageDialog) return;
    const ref = this.dialog.open(this.packageEditor, {
      width: '1100px', maxWidth: '96vw', maxHeight: '90dvh',
      ariaLabel: this.creating ? 'Create package' : 'Edit package'
    });
    this.packageDialog = ref;
    ref.afterClosed().subscribe(() => { this.packageDialog = null; this.draft = null; });
  }

  private openContentEditor() {
    if (this.contentDialog) return;
    const ref = this.dialog.open(this.contentEditor, {
      width: '850px', maxWidth: '96vw', maxHeight: '90dvh',
      ariaLabel: this.creatingContent ? 'Add content option' : 'Edit content option'
    });
    this.contentDialog = ref;
    ref.afterClosed().subscribe(() => { this.contentDialog = null; this.contentDraft = null; });
  }

  closePackageEditor() {
    if (this.saving) return;
    this.packageDialog?.close();
  }

  closeContentEditor() {
    if (this.contentSaving) return;
    this.contentDialog?.close();
  }

  async load() {
    this.loading = true;
    this.loadFailed = false;
    this.error = '';
    try {
      const [packages, catalog] = await Promise.all([
        this.api.get<PackPrice[]>('/packages'), this.api.get<ContentCatalog>('/package-content')
      ]);
      this.packages = packages;
      this.contentOptions = catalog.options;
      this.practiceModes = catalog.modes;
    }
    catch (error) { this.error = this.api.message(error); this.loadFailed = true; }
    finally { this.loading = false; }
  }

  create() {
    this.creating = true;
    this.editError = '';
    this.notice = '';
    this.perksText = '';
    this.selectedContentIds = [];
    this.draft = { pack: '', name: '', description: '', perks: [], group: 'adre', access: [],
      price: 0, originalPrice: null, enabled: false, visible: false, archived: false, highlight: false, sortOrder: this.packages.length };
    this.openPackageEditor();
  }

  edit(pack: PackPrice) {
    this.creating = false;
    this.editError = '';
    this.notice = '';
    this.draft = { ...pack, access: [...pack.access] };
    this.selectedContentIds = [...(pack.contentOptions ?? pack.access)];
    this.updateAccess();
    this.perksText = (pack.perks ?? PLANS.find((plan) => plan.id === pack.pack)?.perks ?? []).join('\n');
    this.openPackageEditor();
  }

  toggleAccess(id: string) {
    if (!this.draft || this.saving) return;
    const option = this.contentOptions.find((entry) => entry.id === id);
    if (!option || (option.archived && !this.selectedContentIds.includes(id))) return;
    this.selectedContentIds = this.selectedContentIds.includes(id) ? this.selectedContentIds.filter((entry) => entry !== id) : [...this.selectedContentIds, id];
    this.updateAccess();
  }

  groupName(group: ContentOption['group']) { return this.contentGroups.find((entry) => entry.id === group)?.label; }

  modeNames(access: string[]) {
    return access.map((id) => this.practiceModes.find((mode) => mode.id === id)?.name ?? id).join(' · ');
  }

  optionsFor(group: ContentOption['group']) {
    return this.contentOptions.filter((option) => option.group === group && (!option.archived || this.selectedContentIds.includes(option.id)));
  }

  activeOptionsFor(group: ContentOption['group']) {
    return this.contentOptions.filter((option) => option.group === group && !option.archived);
  }

  groupSelected(group: ContentOption['group']) {
    const options = this.activeOptionsFor(group);
    return options.length > 0 && options.every((option) => this.selectedContentIds.includes(option.id));
  }

  selectGroup(group: ContentOption['group']) {
    if (this.saving) return;
    const ids = this.activeOptionsFor(group).map((option) => option.id);
    this.selectedContentIds = this.groupSelected(group) ? this.selectedContentIds.filter((id) => !ids.includes(id))
      : [...new Set([...this.selectedContentIds, ...ids])];
    this.updateAccess();
  }

  private updateAccess() {
    if (this.draft) this.draft.access = [...new Set(this.contentOptions.filter((option) => this.selectedContentIds.includes(option.id))
      .flatMap((option) => option.access))];
  }

  newContent() {
    this.creatingContent = true;
    this.contentError = this.contentNotice = '';
    this.contentDraft = { id: '', name: '', description: '', group: 'adre', access: [], archived: false, sortOrder: this.contentOptions.length };
    this.openContentEditor();
  }

  editContent(option: ContentOption) {
    this.creatingContent = false;
    this.contentError = this.contentNotice = '';
    this.contentDraft = { ...option, access: [...option.access] };
    this.openContentEditor();
  }

  toggleContentMode(id: string) {
    if (!this.contentDraft || this.contentSaving || (!this.creatingContent && id === this.contentDraft.id)) return;
    this.contentDraft.access = this.contentDraft.access.includes(id) ? this.contentDraft.access.filter((mode) => mode !== id) : [...this.contentDraft.access, id];
  }

  async saveContent() {
    if (!this.contentDraft || this.contentSaving || this.saving) return;
    this.contentError = '';
    const { id, ...details } = this.contentDraft;
    if (!details.name.trim() || !details.access.length) {
      this.contentError = 'Enter a name and select at least one practice mode.';
      return;
    }
    this.contentSaving = true;
    if (this.contentDialog) this.contentDialog.disableClose = true;
    try {
      this.contentOptions = await this.api.send<ContentOption[]>(this.creatingContent ? 'post' : 'put',
        this.creatingContent ? '/package-content' : `/package-content/${id}`, this.creatingContent ? { id, details } : details);
      this.contentDraft = null;
      this.contentDialog?.close();
      this.contentNotice = 'Content option saved. Save a package to apply its selected mappings.';
      this.updateAccess();
    } catch (error) { this.contentError = this.api.message(error); }
    finally {
      this.contentSaving = false;
      if (this.contentDialog) this.contentDialog.disableClose = false;
    }
  }

  async save() {
    if (!this.draft || this.saving || this.contentSaving || this.loadFailed) return;
    const { pack, ...details } = this.draft;
    details.contentOptions = [...this.selectedContentIds];
    details.perks = this.perksText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    this.editError = '';
    if (!details.name.trim() || !details.access.length || !details.contentOptions.length || details.perks.length > 20 || details.perks.some((perk) => perk.length > 250)) {
      this.editError = 'Enter a name, select content, and provide up to 20 features of at most 250 characters each.';
      return;
    }
    if (details.originalPrice != null && details.originalPrice <= details.price) {
      this.editError = 'Original price must be greater than the selling price.';
      return;
    }
    this.saving = true;
    if (this.packageDialog) this.packageDialog.disableClose = true;
    try {
      this.packages = await this.api.send<PackPrice[]>(this.creating ? 'post' : 'put', this.creating ? '/packages' : `/packages/${pack}`,
        this.creating ? { pack, details } : details);
      this.draft = null;
      this.packageDialog?.close();
      this.notice = 'Package saved.';
    } catch (error) { this.editError = this.api.message(error); }
    finally {
      this.saving = false;
      if (this.packageDialog) this.packageDialog.disableClose = false;
    }
  }

  async archive(pack: PackPrice) {
    if (this.saving || this.contentSaving) return;
    if (!confirm(`${pack.archived ? 'Restore' : 'Archive'} "${pack.name}"? Existing purchases keep their access.`)) return;
    this.saving = true;
    this.error = '';
    const { pack: id, contentOptions, ...details } = pack;
    try {
      this.packages = await this.api.send<PackPrice[]>('put', `/packages/${id}`, {
        ...details, perks: details.perks ?? PLANS.find((plan) => plan.id === id)?.perks ?? [], archived: !pack.archived
      });
      if (this.draft?.pack === id) this.draft = null;
      this.notice = pack.archived ? 'Package restored.' : 'Package archived.';
    } catch (error) { this.error = this.api.message(error); }
    finally { this.saving = false; }
  }
}
