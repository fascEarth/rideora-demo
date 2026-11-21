import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { config } from './config';
import { dataSourceOptions } from './data-source';
import { ENTITIES } from './entities';
import { DistanceService, MailService, SettingsService } from './services/core.services';
import { PaymentService } from './services/payment.service';
import { BookingService } from './services/booking.service';
import { SeedService } from './services/seed.service';
import { AdminController, AuthController, DriverController, PublicController, UsersController } from './controllers/app.controllers';
import { CRUD_CONTROLLERS } from './controllers/crud.controller';
import { AuthGuard } from './common';

@Module({
  imports: [
    TypeOrmModule.forRoot(dataSourceOptions),
    TypeOrmModule.forFeature(ENTITIES),
    JwtModule.register({ global: true, secret: config.jwtSecret, signOptions: { expiresIn: config.jwtExpires as any } }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 240 }]),
  ],
  controllers: [AuthController, PublicController, AdminController, UsersController, DriverController, ...CRUD_CONTROLLERS],
  providers: [
    SettingsService, DistanceService, MailService, PaymentService, BookingService, SeedService, AuthGuard,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
