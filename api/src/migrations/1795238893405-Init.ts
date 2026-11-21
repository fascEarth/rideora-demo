import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1795238893405 implements MigrationInterface {
    name = 'Init1795238893405'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "email" character varying(190) NOT NULL, "password_hash" character varying(100) NOT NULL, "role" character varying(20) NOT NULL DEFAULT 'dispatcher', "driver_id" uuid, "active" boolean NOT NULL DEFAULT true, "last_login_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE TABLE "settings" ("key" character varying(60) NOT NULL, "value" jsonb NOT NULL, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c8639b7626fa94ba8265628f214" PRIMARY KEY ("key"))`);
        await queryRunner.query(`CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(80) NOT NULL, "type" character varying(20) NOT NULL DEFAULT 'sedan', "seats" integer NOT NULL DEFAULT '4', "bags" integer NOT NULL DEFAULT '2', "base" numeric(12,2) NOT NULL DEFAULT '0', "per_km" numeric(12,2) NOT NULL DEFAULT '0', "per_hour" numeric(12,2) NOT NULL DEFAULT '0', "min_fare" numeric(12,2) NOT NULL DEFAULT '0', "description" text NOT NULL DEFAULT '', "active" boolean NOT NULL DEFAULT true, "sort" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "places" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(160) NOT NULL, "type" character varying(20) NOT NULL DEFAULT 'landmark', "lat" double precision, "lng" double precision, "sort" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_1afab86e226b4c3bc9a74465c12" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "extras" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "price" numeric(12,2) NOT NULL DEFAULT '0', "active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_e07ed57e910c6cfc15f350141a2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "promos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(40) NOT NULL, "kind" character varying(10) NOT NULL DEFAULT 'pct', "value" numeric(12,2) NOT NULL DEFAULT '0', "active" boolean NOT NULL DEFAULT true, "max_uses" integer, "valid_until" date, "note" character varying(200) NOT NULL DEFAULT '', CONSTRAINT "PK_ac05363b0734f3842a720d20bcc" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_feda3c4fa78f0abecfdead3cfe" ON "promos" ("code") `);
        await queryRunner.query(`CREATE TABLE "drivers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "phone" character varying(40) NOT NULL DEFAULT '', "email" character varying(190) NOT NULL DEFAULT '', "licence" character varying(60) NOT NULL DEFAULT '', "languages" character varying(120) NOT NULL DEFAULT '', "rating" numeric(3,1) NOT NULL DEFAULT '5', "status" character varying(20) NOT NULL DEFAULT 'Available', CONSTRAINT "PK_92ab3fb69e566d3eb0cae896047" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "vehicles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "plate" character varying(30) NOT NULL, "model" character varying(80) NOT NULL, "category_id" uuid, "color" character varying(40) NOT NULL DEFAULT '', "year" integer, "status" character varying(20) NOT NULL DEFAULT 'Available', CONSTRAINT "PK_18d8646b59304dce4af3a9e35b6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "bookings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ref" character varying(12) NOT NULL, "type" character varying(12) NOT NULL, "pickup" character varying(300) NOT NULL, "dropoff" character varying(300) NOT NULL DEFAULT '', "date" date NOT NULL, "time" character varying(5) NOT NULL, "return_date" date, "return_time" character varying(5), "hours" integer NOT NULL DEFAULT '0', "km" numeric(8,1) NOT NULL DEFAULT '0', "km_source" character varying(12) NOT NULL DEFAULT 'estimate', "pax" integer NOT NULL DEFAULT '1', "bags" integer NOT NULL DEFAULT '0', "category_id" uuid, "category_name" character varying(80) NOT NULL DEFAULT '', "extras" jsonb NOT NULL DEFAULT '{}', "promo" character varying(40) NOT NULL DEFAULT '', "lines" jsonb NOT NULL DEFAULT '[]', "total" numeric(12,2) NOT NULL, "currency" character varying(3) NOT NULL, "name" character varying(120) NOT NULL, "email" character varying(190) NOT NULL, "phone" character varying(40) NOT NULL, "flight" character varying(20) NOT NULL DEFAULT '', "notes" text NOT NULL DEFAULT '', "pay_method" character varying(12) NOT NULL, "pay_status" character varying(12) NOT NULL DEFAULT 'unpaid', "pay_provider" character varying(12) NOT NULL DEFAULT '', "pay_ref" character varying(120) NOT NULL DEFAULT '', "pay_order" character varying(120) NOT NULL DEFAULT '', "status" character varying(12) NOT NULL DEFAULT 'Pending', "driver_id" uuid, "vehicle_id" uuid, "source" character varying(12) NOT NULL DEFAULT 'website', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ec8df769a1b47362e49f0322b3" ON "bookings" ("ref") `);
        await queryRunner.query(`CREATE INDEX "IDX_48b267d894e32a25ebde4b207a" ON "bookings" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_fc98f12b2b3d9a4ec90b8fc5c5" ON "bookings" ("date", "time") `);
        await queryRunner.query(`CREATE TABLE "booking_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "booking_id" uuid NOT NULL, "message" character varying(300) NOT NULL, "actor" character varying(120) NOT NULL DEFAULT 'system', "at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bb7037dff63ec344eba13da5d0b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f71c073e8e26aca6917ea146c8" ON "booking_events" ("booking_id") `);
        await queryRunner.query(`CREATE TABLE "enquiries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "email" character varying(190) NOT NULL, "phone" character varying(40) NOT NULL DEFAULT '', "message" text NOT NULL, "status" character varying(12) NOT NULL DEFAULT 'New', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_1516c8a887df94dc119a1db749e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "booking_events" ADD CONSTRAINT "FK_f71c073e8e26aca6917ea146c80" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "booking_events" DROP CONSTRAINT "FK_f71c073e8e26aca6917ea146c80"`);
        await queryRunner.query(`DROP TABLE "enquiries"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f71c073e8e26aca6917ea146c8"`);
        await queryRunner.query(`DROP TABLE "booking_events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fc98f12b2b3d9a4ec90b8fc5c5"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_48b267d894e32a25ebde4b207a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ec8df769a1b47362e49f0322b3"`);
        await queryRunner.query(`DROP TABLE "bookings"`);
        await queryRunner.query(`DROP TABLE "vehicles"`);
        await queryRunner.query(`DROP TABLE "drivers"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_feda3c4fa78f0abecfdead3cfe"`);
        await queryRunner.query(`DROP TABLE "promos"`);
        await queryRunner.query(`DROP TABLE "extras"`);
        await queryRunner.query(`DROP TABLE "places"`);
        await queryRunner.query(`DROP TABLE "categories"`);
        await queryRunner.query(`DROP TABLE "settings"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
