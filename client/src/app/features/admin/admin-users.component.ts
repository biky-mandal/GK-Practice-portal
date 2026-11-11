import { Component, OnInit, inject } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { AdminApi, Page } from './admin.api';
import { ADMIN_STYLES } from './admin-styles';

interface UserRow {
  id: string;
  email: string | null;
  name: string | null;
  phoneNumber: string | null;
  role: string;
  tier: string;
  purchases: Array<{ pack: string; amount: number }>;
  lastLoginAt: string | null;
  createdAt: string;
  locked: boolean;
}


@Component({
  selector: 'app-admin-users',
  template: `
    <div class="card">
      <h2>Users</h2>
      <div class="toolbar">
        <input class="search" placeholder="Search name, email or phone" [(ngModel)]="search" (keyup.enter)="load(1)" />
        <select [(ngModel)]="role" (change)="load(1)">
          <option value="">All roles</option><option value="user">Users</option><option value="admin">Admins</option><option value="superadmin">Super admins</option>
        </select>
        <button class="btn primary" (click)="load(1)">Search</button>
        <button class="btn" *ngIf="canManage" (click)="creating = !creating">{{ creating ? 'Close' : 'Add user' }}</button>
      </div>

      <div *ngIf="creating && canManage" class="card" style="background: #f8fbff">
        <div class="grid">
          <label class="field">Name<input [(ngModel)]="form.name" /></label>
          <label class="field">Email<input type="email" [(ngModel)]="form.email" /></label>
          <label class="field">Password<input type="password" autocomplete="new-password" [(ngModel)]="form.password" /></label>
          <label class="field">Role
            <select [(ngModel)]="form.role"><option value="user">User</option><option value="admin">Admin</option><option value="superadmin">Super admin</option></select>
          </label>
        </div>
        <div class="chips" style="margin: 10px 0">
          <button type="button" class="chip" *ngFor="let p of packs" [class.on]="form.packs.includes(p.id)" (click)="togglePack(p.id)">{{ p.name }}</button>
        </div>
        <p class="muted">Password: 4 to 72 characters.</p>
        <button class="btn primary" (click)="create()">Create user</button>
      </div>

      <div class="scroll">
        <table>
          <tr><th>User</th><th>Role</th><th>Access</th><th>Last login</th><th></th></tr>
          <tr *ngFor="let u of data?.items">
            <td>
              <strong>{{ u.name || '-' }}</strong><br />
              <small class="muted">{{ u.email || u.phoneNumber }}</small>
              <span class="badge red" *ngIf="u.locked"> locked</span>
            </td>
            <td>
              <select [ngModel]="u.role" (ngModelChange)="setRole(u, $event)" [disabled]="u.id === me?.id || !canManage">
                <option value="user">User</option><option value="admin">Admin</option><option value="superadmin">Super admin</option>
              </select>
            </td>
            <td>
              <span class="badge" [class.green]="u.tier !== 'guest' && u.tier !== 'admin'" [class.purple]="u.tier === 'admin'">{{ u.tier }}</span>
              <span class="badge amber" *ngFor="let p of u.purchases">{{ packName(p.pack) }}
                <a *ngIf="canManage" style="cursor: pointer" title="Revoke" (click)="revoke(u, p.pack)">×</a></span>
            </td>
            <td>{{ u.lastLoginAt ? (u.lastLoginAt | date: 'short') : 'Never' }}</td>
            <td>
              <div class="actions" style="flex-wrap: wrap; min-width: 260px" *ngIf="canManage">
              <button class="btn small" *ngFor="let p of packs" (click)="grant(u, p.id)" [disabled]="has(u, p.id)">+ {{ p.name }}</button>
              <button class="btn small" (click)="resetPassword(u)">Reset password</button>
              <button class="btn small" *ngIf="u.locked" (click)="unlock(u)">Unlock</button>
              <button class="btn small" (click)="signOut(u)">Sign out</button>
              <button class="btn small danger" [disabled]="u.id === me?.id" (click)="remove(u)">Delete</button>
              </div>
            </td>
          </tr>
        </table>
        <div class="empty" *ngIf="data && !data.items.length">No users found.</div>
      </div>
      <div class="pager" *ngIf="data">
        <span>{{ data.total }} users</span>
        <button class="btn small" [disabled]="page === 1" (click)="load(page - 1)">Previous</button>
        <span>Page {{ page }}</span>
        <button class="btn small" [disabled]="page * data.pageSize >= data.total" (click)="load(page + 1)">Next</button>
      </div>
      <p class="ok" *ngIf="notice">{{ notice }}</p>
      <p class="error" *ngIf="error">{{ error }}</p>
    </div>
  `,
  styles: [ADMIN_STYLES]
})
export class AdminUsersComponent implements OnInit {
  private readonly api = inject(AdminApi);
  readonly me = inject(AuthService).userSignal();
  readonly canManage = this.me?.role === 'superadmin';

  search = '';
  role = '';
  data: Page<UserRow> | null = null;
  page = 1;
  error = '';
  notice = '';
  creating = false;
  form = { name: '', email: '', password: '', role: 'user', packs: [] as string[] };

  ngOnInit() {
    this.api.get<Array<{ pack: string; name: string }>>('/packages')
      .then((rows) => { this.packs = rows.map((row) => ({ id: row.pack, name: row.name })); }).catch((error) => this.fail(error));
    this.load(1);
  }

  packs: Array<{ id: string; name: string }> = [];

  packName(id: string) {
    return this.packs.find((p) => p.id === id)?.name ?? id;
  }

  has(u: UserRow, pack: string) {
    return u.purchases.some((p) => p.pack === pack);
  }

  togglePack(pack: string) {
    const index = this.form.packs.indexOf(pack);
    if (index >= 0) this.form.packs.splice(index, 1);
    else this.form.packs.push(pack);
  }

  async load(page: number) {
    this.page = page;
    try {
      this.data = await this.api.get<Page<UserRow>>('/users', { search: this.search, role: this.role, page });
    } catch (e) {
      this.fail(e);
    }
  }

  // Runs an action, then reloads the list; surfaces the server's message on failure.
  private async run(action: () => Promise<unknown>, success = '') {
    this.error = '';
    this.notice = '';
    try {
      await action();
      this.notice = success;
      await this.load(this.page);
    } catch (e) {
      this.fail(e);
    }
  }

  private fail(e: unknown) {
    this.error = this.api.message(e);
  }

  create() {
    this.run(async () => {
      await this.api.send('post', '/users', this.form);
      this.form = { name: '', email: '', password: '', role: 'user', packs: [] };
      this.creating = false;
    }, 'User created.');
  }

  setRole(u: UserRow, role: string) {
    if (role === u.role) return;
    this.run(() => this.api.send('patch', `/users/${u.id}`, { role }), 'Role updated.');
  }

  grant(u: UserRow, pack: string) {
    this.run(() => this.api.send('post', `/users/${u.id}/purchases`, { pack, amount: 0 }), 'Test Series granted.');
  }

  revoke(u: UserRow, pack: string) {
    if (!confirm(`Revoke ${this.packName(pack)} from this user?`)) return;
    this.run(() => this.api.send('delete', `/users/${u.id}/purchases/${pack}`), 'Test Series revoked.');
  }

  resetPassword(u: UserRow) {
    const password = prompt('New password (4+ characters):');
    if (!password) return;
    this.run(() => this.api.send('post', `/users/${u.id}/password`, { password }), 'Password reset. The user was signed out everywhere.');
  }

  unlock(u: UserRow) {
    this.run(() => this.api.send('post', `/users/${u.id}/unlock`), 'Account unlocked.');
  }

  signOut(u: UserRow) {
    this.run(() => this.api.send('post', `/users/${u.id}/sign-out`), 'User signed out everywhere.');
  }

  remove(u: UserRow) {
    if (!confirm(`Delete ${u.email || u.name}? Their tests and sessions are deleted too.`)) return;
    this.run(() => this.api.send('delete', `/users/${u.id}`), 'User deleted.');
  }
}
