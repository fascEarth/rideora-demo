import {
  BadRequestException, CanActivate, createParamDecorator, ExecutionContext, ForbiddenException, Injectable,
  SetMetadata, UnauthorizedException, applyDecorators, UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '../entities';

/* ---------------- input validation ---------------- */
export type FieldType = 'string' | 'text' | 'number' | 'int' | 'bool' | 'enum' | 'date' | 'time' | 'email' | 'uuid' | 'color';
export interface FieldSpec { type: FieldType; required?: boolean; max?: number; min?: number; values?: readonly string[]; nullable?: boolean }
export type Schema = Record<string, FieldSpec>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Keeps only the fields in the schema, converts and checks each. Throws 400 with a readable message. */
export function clean<T = any>(input: any, schema: Schema, partial = false): T {
  if (!input || typeof input !== 'object') throw new BadRequestException('Invalid request body');
  const out: any = {};
  for (const [k, s] of Object.entries(schema)) {
    let v = input[k];
    const missing = v === undefined || v === null || v === '';
    if (missing) {
      if (s.required && !partial) throw new BadRequestException(`${k} is required`);
      if (v === undefined) continue;
      if (s.nullable || s.type === 'uuid' || s.type === 'date' || s.type === 'number' || s.type === 'int') { out[k] = null; continue; }
      if (s.type === 'bool') { out[k] = false; continue; }
      out[k] = ''; continue;
    }
    switch (s.type) {
      case 'string': case 'text': case 'color': {
        v = String(v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
        if (s.type !== 'text') v = v.replace(/\s+/g, ' ');
        v = v.trim();
        const max = s.max ?? (s.type === 'text' ? 5000 : 200);
        if (v.length > max) throw new BadRequestException(`${k} is too long (max ${max})`);
        if (s.type === 'color' && !/^#[0-9a-f]{6}$/i.test(v)) throw new BadRequestException(`${k} must be a colour like #FFC62B`);
        break;
      }
      case 'email': v = String(v).trim().toLowerCase(); if (!EMAIL.test(v) || v.length > 190) throw new BadRequestException(`${k} must be a valid email`); break;
      case 'number': case 'int': {
        v = Number(v);
        if (!Number.isFinite(v)) throw new BadRequestException(`${k} must be a number`);
        if (s.type === 'int') v = Math.round(v);
        if (s.min !== undefined && v < s.min) throw new BadRequestException(`${k} must be at least ${s.min}`);
        if (s.max !== undefined && v > s.max) throw new BadRequestException(`${k} must be at most ${s.max}`);
        break;
      }
      case 'bool': v = v === true || v === 'true' || v === 1 || v === '1'; break;
      case 'enum': v = String(v); if (!s.values.includes(v)) throw new BadRequestException(`${k} must be one of: ${s.values.join(', ')}`); break;
      case 'date': v = String(v); if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || isNaN(Date.parse(v))) throw new BadRequestException(`${k} must be a date (YYYY-MM-DD)`); break;
      case 'time': v = String(v); if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) throw new BadRequestException(`${k} must be a time (HH:mm)`); break;
      case 'uuid': v = String(v); if (!UUID.test(v)) throw new BadRequestException(`${k} is not a valid id`); break;
    }
    out[k] = v;
  }
  return out as T;
}

/* ---------------- auth ---------------- */
export interface AuthUser { id: string; email: string; name: string; role: Role; driverId: string | null }

export const ROLES_KEY = 'roles';
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const h = String(req.headers.authorization || '');
    const token = h.startsWith('Bearer ') ? h.slice(7) : '';
    if (!token) throw new UnauthorizedException('Please sign in');
    try {
      const p: any = await this.jwt.verifyAsync(token);
      req.user = { id: p.sub, email: p.email, name: p.name, role: p.role, driverId: p.driverId || null } as AuthUser;
    } catch {
      throw new UnauthorizedException('Your session has expired. Please sign in again');
    }
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (roles?.length && !roles.includes(req.user.role)) throw new ForbiddenException('You do not have access to this');
    return true;
  }
}

/** Require a signed-in user with one of these roles. */
export const Auth = (...roles: Role[]) => applyDecorators(SetMetadata(ROLES_KEY, roles), UseGuards(AuthGuard));
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);

export const todayIn = (tz: string) => {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
  catch { return new Date().toISOString().slice(0, 10); }
};
export const nowTimeIn = (tz: string) => {
  try { return new Intl.DateTimeFormat('en-GB', { timeZone: tz || 'UTC', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date()); }
  catch { return new Date().toISOString().slice(11, 16); }
};
export const addDaysStr = (d: string, n: number) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
