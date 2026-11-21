import {
  Column, CreateDateColumn, Entity, Index, ManyToOne, JoinColumn, OneToMany, PrimaryColumn,
  PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

/** numeric columns come back from pg as strings; convert to numbers */
export const num = { to: (v: number | null) => v, from: (v: string | null) => (v === null || v === undefined ? null : Number(v)) };

export type Role = 'admin' | 'dispatcher' | 'driver';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 120 }) name: string;
  @Index({ unique: true }) @Column({ length: 190 }) email: string;
  @Column({ name: 'password_hash', length: 100 }) passwordHash: string;
  @Column({ length: 20, default: 'dispatcher' }) role: Role;
  @Column({ name: 'driver_id', type: 'uuid', nullable: true }) driverId: string | null;
  @Column({ default: true }) active: boolean;
  @Column({ name: 'last_login_at', type: 'timestamptz', nullable: true }) lastLoginAt: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}

@Entity('settings')
export class Setting {
  @PrimaryColumn({ length: 60 }) key: string;
  @Column({ type: 'jsonb' }) value: any;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 80 }) name: string;
  @Column({ length: 20, default: 'sedan' }) type: string;
  @Column({ type: 'int', default: 4 }) seats: number;
  @Column({ type: 'int', default: 2 }) bags: number;
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: num }) base: number;
  @Column({ name: 'per_km', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: num }) perKm: number;
  @Column({ name: 'per_hour', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: num }) perHour: number;
  @Column({ name: 'min_fare', type: 'numeric', precision: 12, scale: 2, default: 0, transformer: num }) minFare: number;
  @Column({ type: 'text', default: '' }) description: string;
  @Column({ default: true }) active: boolean;
  @Column({ type: 'int', default: 0 }) sort: number;
}

@Entity('places')
export class Place {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 160 }) name: string;
  @Column({ length: 20, default: 'landmark' }) type: string;
  @Column({ type: 'double precision', nullable: true }) lat: number | null;
  @Column({ type: 'double precision', nullable: true }) lng: number | null;
  @Column({ type: 'int', default: 0 }) sort: number;
}

@Entity('extras')
export class Extra {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 120 }) name: string;
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: num }) price: number;
  @Column({ default: true }) active: boolean;
}

@Entity('promos')
export class Promo {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ length: 40 }) code: string;
  @Column({ length: 10, default: 'pct' }) kind: 'pct' | 'flat';
  @Column({ type: 'numeric', precision: 12, scale: 2, default: 0, transformer: num }) value: number;
  @Column({ default: true }) active: boolean;
  @Column({ name: 'max_uses', type: 'int', nullable: true }) maxUses: number | null;
  @Column({ name: 'valid_until', type: 'date', nullable: true }) validUntil: string | null;
  @Column({ length: 200, default: '' }) note: string;
}

@Entity('drivers')
export class Driver {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 120 }) name: string;
  @Column({ length: 40, default: '' }) phone: string;
  @Column({ length: 190, default: '' }) email: string;
  @Column({ length: 60, default: '' }) licence: string;
  @Column({ length: 120, default: '' }) languages: string;
  @Column({ type: 'numeric', precision: 3, scale: 1, default: 5, transformer: num }) rating: number;
  @Column({ length: 20, default: 'Available' }) status: string;
}

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 30 }) plate: string;
  @Column({ length: 80 }) model: string;
  @Column({ name: 'category_id', type: 'uuid', nullable: true }) categoryId: string | null;
  @Column({ length: 40, default: '' }) color: string;
  @Column({ type: 'int', nullable: true }) year: number | null;
  @Column({ length: 20, default: 'Available' }) status: string;
}

export const BOOKING_STATUSES = ['Pending', 'Confirmed', 'Assigned', 'On trip', 'Completed', 'Cancelled'] as const;

@Entity('bookings')
@Index(['date', 'time'])
export class Booking {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column({ length: 12 }) ref: string;
  @Column({ length: 12 }) type: 'oneway' | 'round' | 'hourly' | 'airport';
  @Column({ length: 300 }) pickup: string;
  @Column({ length: 300, default: '' }) dropoff: string;
  @Column({ type: 'date' }) date: string;
  @Column({ length: 5 }) time: string;
  @Column({ name: 'return_date', type: 'date', nullable: true }) returnDate: string | null;
  @Column({ name: 'return_time', length: 5, nullable: true }) returnTime: string | null;
  @Column({ type: 'int', default: 0 }) hours: number;
  @Column({ type: 'numeric', precision: 8, scale: 1, default: 0, transformer: num }) km: number;
  @Column({ name: 'km_source', length: 12, default: 'estimate' }) kmSource: string;
  @Column({ type: 'int', default: 1 }) pax: number;
  @Column({ type: 'int', default: 0 }) bags: number;
  @Column({ name: 'category_id', type: 'uuid', nullable: true }) categoryId: string | null;
  @Column({ name: 'category_name', length: 80, default: '' }) categoryName: string;
  @Column({ type: 'jsonb', default: () => "'{}'" }) extras: Record<string, number>;
  @Column({ length: 40, default: '' }) promo: string;
  @Column({ type: 'jsonb', default: () => "'[]'" }) lines: [string, number][];
  @Column({ type: 'numeric', precision: 12, scale: 2, transformer: num }) total: number;
  @Column({ length: 3 }) currency: string;
  @Column({ length: 120 }) name: string;
  @Column({ length: 190 }) email: string;
  @Column({ length: 40 }) phone: string;
  @Column({ length: 20, default: '' }) flight: string;
  @Column({ type: 'text', default: '' }) notes: string;
  @Column({ name: 'pay_method', length: 12 }) payMethod: 'card' | 'cash' | 'account';
  @Column({ name: 'pay_status', length: 12, default: 'unpaid' }) payStatus: 'unpaid' | 'pending' | 'paid' | 'refund_due' | 'refunded' | 'failed';
  @Column({ name: 'pay_provider', length: 12, default: '' }) payProvider: string;
  @Column({ name: 'pay_ref', length: 120, default: '' }) payRef: string;
  @Column({ name: 'pay_order', length: 120, default: '' }) payOrder: string;
  @Index() @Column({ length: 12, default: 'Pending' }) status: string;
  @Column({ name: 'driver_id', type: 'uuid', nullable: true }) driverId: string | null;
  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true }) vehicleId: string | null;
  @Column({ length: 12, default: 'website' }) source: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
  @OneToMany(() => BookingEvent, (e) => e.booking) events: BookingEvent[];
}

@Entity('booking_events')
export class BookingEvent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ name: 'booking_id', type: 'uuid' }) bookingId: string;
  @ManyToOne(() => Booking, (b) => b.events, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'booking_id' }) booking: Booking;
  @Column({ length: 300 }) message: string;
  @Column({ length: 120, default: 'system' }) actor: string;
  @CreateDateColumn({ name: 'at', type: 'timestamptz' }) at: Date;
}

@Entity('enquiries')
export class Enquiry {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ length: 120 }) name: string;
  @Column({ length: 190 }) email: string;
  @Column({ length: 40, default: '' }) phone: string;
  @Column({ type: 'text' }) message: string;
  @Column({ length: 12, default: 'New' }) status: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
}

export const ENTITIES = [User, Setting, Category, Place, Extra, Promo, Driver, Vehicle, Booking, BookingEvent, Enquiry];
