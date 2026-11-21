import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api';
import { Badge, Icon, Ui } from '../core/ui';

export interface Col { k: string; label: string; fmt?: (r: any) => string; sub?: (r: any) => string; num?: boolean; badge?: (r: any) => string }
export interface Field { k: string; label: string; type: 'text' | 'number' | 'textarea' | 'select' | 'check' | 'email' | 'date' | 'password' | 'color'; options?: () => [string, string][]; wide?: boolean; placeholder?: string; hint?: string }
export interface CrudSource { list(): Promise<any[]>; save(row: any | null, v: any): Promise<void>; remove(row: any): Promise<void> }

export const restSource = (api: Api, path: string): CrudSource => ({
  list: () => api.get(`admin/${path}`),
  save: async (row, v) => { row ? await api.patch(`admin/${path}/${row.id}`, v) : await api.post(`admin/${path}`, v); },
  remove: async (row) => { await api.del(`admin/${path}/${row.id}`); },
});

/** Table with add / edit / delete in a dialog. Used for vehicles, drivers, places, promos, users and website lists. */
@Component({
  selector: 'app-crud',
  imports: [FormsModule, Badge, Icon],
  template: `
  <div class="card">
    <h2><span>{{ title() }}</span>@if (canEdit()) { <button class="btn dark sm" (click)="open(null)">Add {{ noun() }}</button> }</h2>
    @if (hint()) { <p class="sub">{{ hint() }}</p> }
    @if (err()) { <p class="err">{{ err() }}</p> }
    @if (loading()) { <div class="loading"><span class="spin"></span></div> }
    @else if (!rows().length) { <div class="empty">Nothing here yet.</div> }
    @else {
      <div style="overflow-x:auto"><table class="tbl stack"><thead><tr>@for (c of cols(); track c.k) { <th [class.num]="c.num">{{ c.label }}</th> }@if (canEdit()) {<th></th>}</tr></thead>
      <tbody>@for (r of rows(); track $index) { <tr>
        @for (c of cols(); track c.k) { <td [class.num]="c.num" [attr.data-l]="c.label">
          @if (c.badge) { <app-badge [value]="c.badge(r)" /> } @else { {{ c.fmt ? c.fmt(r) : r[c.k] }} }
          @if (c.sub) { <small>{{ c.sub(r) }}</small> } </td> }
        @if (canEdit()) { <td class="acts"><button class="lnk" (click)="open(r)">Edit</button><button class="lnk del" (click)="remove(r)">Delete</button></td> }
      </tr> }</tbody></table></div>
    }
  </div>
  @if (editing(); as e) {
    <div class="md" (click)="editing.set(null)"><div class="md-c" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
      <div class="md-h"><h3>{{ e.row ? 'Edit' : 'Add' }} {{ noun() }}</h3><button class="x" (click)="editing.set(null)" aria-label="Close"><app-icon name="x" /></button></div>
      <form class="form" (ngSubmit)="save()" novalidate>
        @for (f of fields(); track f.k) {
          @switch (f.type) {
            @case ('check') { <label class="chk wide"><input type="checkbox" [name]="f.k" [(ngModel)]="e.v[f.k]"><span>{{ f.label }}</span></label> }
            @case ('textarea') { <label class="fl wide"><span>{{ f.label }}</span><textarea [name]="f.k" rows="3" [(ngModel)]="e.v[f.k]"></textarea></label> }
            @case ('select') { <label class="fl" [class.wide]="f.wide"><span>{{ f.label }}</span><select [name]="f.k" [(ngModel)]="e.v[f.k]">@for (o of f.options!(); track o[0]) { <option [ngValue]="o[0]">{{ o[1] }}</option> }</select></label> }
            @default { <label class="fl" [class.wide]="f.wide"><span>{{ f.label }}</span><input [type]="f.type" [name]="f.k" [(ngModel)]="e.v[f.k]" [placeholder]="f.placeholder || ''" [attr.step]="f.type === 'number' ? 'any' : null" [attr.autocomplete]="f.type === 'password' ? 'new-password' : null">@if (f.hint) {<small class="muted">{{ f.hint }}</small>}</label> }
          }
        }
        @if (formErr()) { <p class="errmsg wide">{{ formErr() }}</p> }
        <div class="md-f wide"><button type="button" class="btn ghost" (click)="editing.set(null)">Cancel</button><button class="btn dark" type="submit" [disabled]="busy()">{{ busy() ? 'Saving…' : 'Save' }}</button></div>
      </form></div></div>
  }`,
})
export class Crud implements OnInit {
  private ui = inject(Ui);
  title = input(''); noun = input('item'); hint = input('');
  cols = input.required<Col[]>(); fields = input.required<Field[]>(); source = input.required<CrudSource>();
  defaults = input<any>({}); canEdit = input(true);
  /** Optional hook to turn form values into the payload (e.g. drop an empty password). */
  prepare = input<(v: any, row: any) => any>((v) => v);
  rows = signal<any[]>([]); loading = signal(true); err = signal(''); busy = signal(false); formErr = signal('');
  editing = signal<{ row: any; v: any } | null>(null);

  ngOnInit() { this.load(); }
  async load() {
    this.loading.set(true);
    try { this.rows.set(await this.source().list()); this.err.set(''); } catch (e: any) { this.err.set(e.message); }
    this.loading.set(false);
  }
  open(row: any) {
    const v: any = {};
    for (const f of this.fields()) v[f.k] = row ? (row[f.k] ?? (f.type === 'check' ? false : '')) : (this.defaults()[f.k] ?? (f.type === 'check' ? true : f.type === 'select' ? f.options!()[0]?.[0] ?? '' : ''));
    this.formErr.set(''); this.editing.set({ row, v });
  }
  async save() {
    const e = this.editing(); if (!e) return;
    const v: any = {};
    for (const f of this.fields()) {
      let x = e.v[f.k];
      if (f.type === 'number') x = x === '' || x === null || x === undefined ? null : Number(x);
      if (typeof x === 'string') x = x.trim();
      v[f.k] = x;
    }
    this.busy.set(true); this.formErr.set('');
    try { await this.source().save(e.row, this.prepare()(v, e.row)); this.editing.set(null); this.ui.toast('Saved'); await this.load(); }
    catch (x: any) { this.formErr.set(x.message); }
    this.busy.set(false);
  }
  async remove(row: any) {
    if (!(await this.ui.confirm(`Delete this ${this.noun()}? This can't be undone.`, 'Delete'))) return;
    try { await this.source().remove(row); this.ui.toast('Deleted'); await this.load(); } catch (e: any) { this.ui.toast(e.message); }
  }
}
