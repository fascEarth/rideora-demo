import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Type, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { DataSource, EntityTarget } from 'typeorm';
import { Auth, clean, Schema } from '../common';
import { Category, Driver, Extra, Place, Promo, Vehicle } from '../entities';

interface CrudOptions { order?: Record<string, 'ASC' | 'DESC'>; transform?: (v: any) => any }

/** Builds a list/create/update/delete controller for a simple table. Staff can read; admins can change. */
function crud(path: string, entity: EntityTarget<any>, schema: Schema, opts: CrudOptions = {}): Type<any> {
  @Controller(`api/admin/${path}`)
  class CrudController {
    constructor(private ds: DataSource) {}
    private get repo() { return this.ds.getRepository(entity); }

    @Get() @Auth('admin', 'dispatcher')
    list() { return this.repo.find({ order: opts.order || {} }); }

    @Post() @Auth('admin')
    async create(@Body() body: any) {
      let v = clean(body, schema);
      if (opts.transform) v = opts.transform(v);
      try { return await this.repo.save(this.repo.create(v)); } catch (e) { throw this.dbError(e); }
    }

    @Patch(':id') @Auth('admin')
    async update(@Param('id', ParseUUIDPipe) id: string, @Body() body: any) {
      const row = await this.repo.findOne({ where: { id } as any });
      if (!row) throw new NotFoundException();
      let v = clean(body, schema, true);
      if (opts.transform) v = opts.transform(v);
      Object.assign(row, v);
      try { return await this.repo.save(row); } catch (e) { throw this.dbError(e); }
    }

    @Delete(':id') @Auth('admin')
    async remove(@Param('id', ParseUUIDPipe) id: string) {
      await this.repo.delete(id);
      return { ok: true };
    }

    private dbError(e: any) {
      if (e?.code === '23505') return new ConflictException('That already exists');
      return new BadRequestException(e?.message || 'Could not save');
    }
  }
  Object.defineProperty(CrudController, 'name', { value: `Crud_${path}` });
  return CrudController;
}

const money = { type: 'number', min: 0, max: 1e7 } as const;

export const CRUD_CONTROLLERS = [
  crud('categories', Category, {
    name: { type: 'string', required: true, max: 80 }, type: { type: 'enum', values: ['sedan', 'lux', 'suv', 'van', 'bus', 'ev'] },
    seats: { type: 'int', min: 1, max: 60 }, bags: { type: 'int', min: 0, max: 60 }, base: money, perKm: money, perHour: money, minFare: money,
    description: { type: 'text', max: 500 }, active: { type: 'bool' }, sort: { type: 'int', min: 0, max: 999 },
  }, { order: { sort: 'ASC', name: 'ASC' } }),
  crud('places', Place, {
    name: { type: 'string', required: true, max: 160 }, type: { type: 'enum', values: ['airport', 'station', 'district', 'landmark', 'hotel', 'city', 'port'] },
    lat: { type: 'number', min: -90, max: 90, nullable: true }, lng: { type: 'number', min: -180, max: 180, nullable: true }, sort: { type: 'int', min: 0, max: 9999 },
  }, { order: { sort: 'ASC', name: 'ASC' } }),
  crud('extras', Extra, { name: { type: 'string', required: true, max: 120 }, price: money, active: { type: 'bool' } }, { order: { name: 'ASC' } }),
  crud('promos', Promo, {
    code: { type: 'string', required: true, max: 40 }, kind: { type: 'enum', values: ['pct', 'flat'] }, value: money, active: { type: 'bool' },
    maxUses: { type: 'int', min: 1, max: 1e6, nullable: true }, validUntil: { type: 'date', nullable: true }, note: { type: 'string', max: 200 },
  }, { order: { code: 'ASC' }, transform: (v) => (v.code !== undefined ? { ...v, code: String(v.code).toUpperCase().replace(/[^A-Z0-9_-]/g, '') } : v) }),
  crud('vehicles', Vehicle, {
    plate: { type: 'string', required: true, max: 30 }, model: { type: 'string', required: true, max: 80 }, categoryId: { type: 'uuid', nullable: true },
    color: { type: 'string', max: 40 }, year: { type: 'int', min: 1950, max: 2100, nullable: true }, status: { type: 'enum', values: ['Available', 'On trip', 'Maintenance'] },
  }, { order: { plate: 'ASC' } }),
  crud('drivers', Driver, {
    name: { type: 'string', required: true, max: 120 }, phone: { type: 'string', max: 40 }, email: { type: 'string', max: 190 }, licence: { type: 'string', max: 60 },
    languages: { type: 'string', max: 120 }, rating: { type: 'number', min: 0, max: 5 }, status: { type: 'enum', values: ['Available', 'On trip', 'Off duty'] },
  }, { order: { name: 'ASC' } }),
];
