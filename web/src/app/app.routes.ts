import { Routes } from '@angular/router';
import { adminGuard, driverGuard, staffGuard } from './core/api';
import { PublicLayout, Terms } from './public/layout';
import { Home } from './public/home';
import { Book } from './public/book';
import { Manage, Paid } from './public/manage';
import { AdminShell, Login } from './admin/shell';
import { Bookings, Dashboard, Dispatch, Enquiries } from './admin/ops';
import { BrandPage, ContentPage, DriversPage, PlacesPage, PricingPage, PromosPage, SettingsPage, UsersPage, VehiclesPage } from './admin/setup';
import { DriverTrips } from './driver/trips';

export const routes: Routes = [
  { path: 'admin/login', component: Login, title: 'Sign in' },
  {
    path: 'admin', component: AdminShell, canActivate: [staffGuard], children: [
      { path: '', component: Dashboard, title: 'Dashboard' },
      { path: 'bookings', component: Bookings, title: 'Bookings' },
      { path: 'dispatch', component: Dispatch, title: 'Dispatch' },
      { path: 'enquiries', component: Enquiries, title: 'Enquiries' },
      { path: 'vehicles', component: VehiclesPage, title: 'Vehicles' },
      { path: 'drivers', component: DriversPage, title: 'Drivers' },
      { path: 'pricing', component: PricingPage, canActivate: [adminGuard], title: 'Fleet & pricing' },
      { path: 'promos', component: PromosPage, canActivate: [adminGuard], title: 'Promotions' },
      { path: 'places', component: PlacesPage, canActivate: [adminGuard], title: 'Places' },
      { path: 'content', component: ContentPage, canActivate: [adminGuard], title: 'Website content' },
      { path: 'brand', component: BrandPage, canActivate: [adminGuard], title: 'Branding' },
      { path: 'users', component: UsersPage, canActivate: [adminGuard], title: 'Staff logins' },
      { path: 'settings', component: SettingsPage, canActivate: [adminGuard], title: 'Settings' },
    ],
  },
  { path: 'driver/login', component: Login, title: 'Driver sign in' },
  { path: 'driver', component: DriverTrips, canActivate: [driverGuard], title: 'My trips' },
  {
    path: '', component: PublicLayout, children: [
      { path: '', component: Home },
      { path: 'book', component: Book, title: 'Choose your ride' },
      { path: 'booking/paid', component: Paid, title: 'Payment' },
      { path: 'manage', component: Manage, title: 'Manage booking' },
      { path: 'terms', component: Terms, title: 'Terms' },
    ],
  },
  { path: '**', redirectTo: '' },
];
