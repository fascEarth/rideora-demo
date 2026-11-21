/** Starting data for a new install. Everything here is editable in the CMS. */

export interface RegionPreset {
  label: string; city: string; currency: string; locale: string; timezone: string; factor: number;
  tax: number; taxLabel: string; phone: string; address: string;
  places: [string, string, number, number][];
}

export const PRESETS: Record<string, RegionPreset> = {
  dubai: {
    label: 'Dubai, UAE', city: 'Dubai', currency: 'AED', locale: 'en-AE', timezone: 'Asia/Dubai', factor: 1, tax: 5, taxLabel: 'VAT',
    phone: '+971 4 000 0000', address: 'Dubai, UAE',
    places: [['Dubai International Airport (DXB)', 'airport', 25.2532, 55.3657], ['Al Maktoum Airport (DWC)', 'airport', 24.896, 55.1614], ['Downtown Dubai', 'district', 25.1972, 55.2744], ['Dubai Mall', 'landmark', 25.1985, 55.2796], ['Dubai Marina', 'district', 25.0805, 55.1403], ['JBR Beach', 'landmark', 25.078, 55.134], ['Palm Jumeirah', 'district', 25.1124, 55.139], ['Business Bay', 'district', 25.186, 55.265], ['Deira City Centre', 'landmark', 25.2522, 55.3304], ['Expo City Dubai', 'landmark', 24.9631, 55.1474], ['Abu Dhabi Corniche', 'city', 24.4764, 54.3705], ['Sharjah City', 'city', 25.3463, 55.4209]],
  },
  london: {
    label: 'London, UK', city: 'London', currency: 'GBP', locale: 'en-GB', timezone: 'Europe/London', factor: 0.5, tax: 20, taxLabel: 'VAT',
    phone: '+44 20 0000 0000', address: 'London, UK',
    places: [['Heathrow Airport (LHR)', 'airport', 51.47, -0.4543], ['Gatwick Airport (LGW)', 'airport', 51.1537, -0.1821], ['London City Airport (LCY)', 'airport', 51.5048, 0.0495], ['Westminster', 'district', 51.4995, -0.1248], ['Canary Wharf', 'district', 51.5054, -0.0235], ["King's Cross St Pancras", 'station', 51.5308, -0.1238], ['Paddington Station', 'station', 51.5154, -0.1755], ['Wembley Stadium', 'landmark', 51.556, -0.2795], ['Oxford', 'city', 51.752, -1.2577], ['Cambridge', 'city', 52.2053, 0.1218]],
  },
  chennai: {
    label: 'Chennai, India', city: 'Chennai', currency: 'INR', locale: 'en-IN', timezone: 'Asia/Kolkata', factor: 8, tax: 5, taxLabel: 'GST',
    phone: '+91 44 0000 0000', address: 'Chennai, India',
    places: [['Chennai Airport (MAA)', 'airport', 12.9941, 80.1709], ['Chennai Central', 'station', 13.0827, 80.2757], ['T. Nagar', 'district', 13.0418, 80.2341], ['Anna Nagar', 'district', 13.085, 80.2101], ['OMR Sholinganallur', 'district', 12.901, 80.2279], ['Guindy', 'district', 13.0067, 80.2206], ['Marina Beach', 'landmark', 13.05, 80.2824], ['Mahabalipuram', 'city', 12.6208, 80.1945], ['Puducherry', 'city', 11.9416, 79.8083], ['Vellore', 'city', 12.9165, 79.1325]],
  },
  generic: {
    label: 'Generic (USD)', city: 'Your city', currency: 'USD', locale: 'en-US', timezone: 'UTC', factor: 0.3, tax: 0, taxLabel: 'Tax',
    phone: '', address: '', places: [],
  },
};

const nice = (v: number) => (v < 20 ? Math.round(v * 100) / 100 : Math.round(v));

/** Base rates are written in AED and scaled by the region factor. */
export const BASE_CATEGORIES = [
  { name: 'Economy sedan', type: 'sedan', seats: 4, bags: 2, base: 25, perKm: 2.2, perHour: 70, minFare: 50, description: 'Toyota Camry or similar. Comfortable everyday rides at fixed prices.' },
  { name: 'Business sedan', type: 'lux', seats: 3, bags: 2, base: 40, perKm: 3.2, perHour: 110, minFare: 90, description: 'Lexus ES or similar. Quiet cabin and a professional chauffeur.' },
  { name: 'SUV', type: 'suv', seats: 6, bags: 4, base: 45, perKm: 3.5, perHour: 120, minFare: 100, description: 'Toyota Land Cruiser or similar. Room for families and extra luggage.' },
  { name: 'Van / MPV', type: 'van', seats: 7, bags: 6, base: 55, perKm: 4, perHour: 140, minFare: 120, description: 'Kia Carnival or similar. Space for groups and bags.' },
  { name: 'First class', type: 'lux', seats: 3, bags: 2, base: 90, perKm: 6.5, perHour: 250, minFare: 220, description: 'Mercedes S-Class or similar. Our most refined ride.' },
  { name: 'Minibus', type: 'bus', seats: 14, bags: 12, base: 120, perKm: 7, perHour: 260, minFare: 300, description: 'Toyota Coaster or similar. Group transfers, events and tours.' },
];

export function scaledCategories(factor: number) {
  return BASE_CATEGORIES.map((c, i) => ({ ...c, base: nice(c.base * factor), perKm: nice(c.perKm * factor), perHour: nice(c.perHour * factor), minFare: nice(c.minFare * factor), active: true, sort: i }));
}
export function scaledExtras(factor: number) {
  return [
    { name: 'Child seat', price: nice(20 * factor), active: true },
    { name: 'Meet & greet with name sign', price: nice(40 * factor), active: true },
    { name: 'Extra stop on the way', price: nice(25 * factor), active: true },
  ];
}

export function defaultBrand(p: RegionPreset) {
  return {
    name: 'Rideora', tagline: 'Cabs, vans and chauffeurs, booked in a minute', primary: '#FFC62B',
    city: p.city, phone: p.phone, whatsapp: p.phone, email: '', address: p.address,
    currency: p.currency, locale: p.locale, timezone: p.timezone, notifyEmail: '', logoText: '',
  };
}

export function defaultPricing(p: RegionPreset) {
  return {
    taxLabel: p.taxLabel, tax: p.tax, airportFee: nice(25 * p.factor), nightPct: 20, nightStart: 22, nightEnd: 6,
    roundDisc: 10, minHours: 2, kmPerHour: 20, cancelHours: 2, minNoticeMinutes: 60,
    payCash: true, payAccount: false, payCard: true,
  };
}

export const DEFAULT_CONTENT = {
  heroTitle: 'Rides you can book, track and trust.',
  heroSub: 'Fixed fares, professional drivers and a car for every trip, from a quick airport run to a full day with a chauffeur.',
  about: 'We are a licensed private-hire company with a modern fleet and drivers who know the city. Every fare is agreed before you travel.',
  metaDescription: 'Book airport transfers, city rides and chauffeurs online with fixed fares.',
  features: [
    { icon: 'tag', t: 'Fixed fares', d: 'The price you see is the price you pay. No surge.' },
    { icon: 'plane', t: 'Flight tracking', d: 'Airport pickups follow your actual landing time.' },
    { icon: 'shield', t: 'Vetted drivers', d: 'Licensed, background-checked and rated after every trip.' },
    { icon: 'headset', t: 'Support around the clock', d: 'Call, chat or email us any time, day or night.' },
  ],
  services: [
    { icon: 'plane', t: 'Airport transfers', d: 'Meet and greet at arrivals, help with bags and a driver who waits if your flight is late.' },
    { icon: 'city', t: 'City rides', d: 'Point-to-point trips across the city at a fare fixed when you book.' },
    { icon: 'clock', t: 'Chauffeur by the hour', d: 'Keep a car and driver for meetings, shopping or a day out.' },
    { icon: 'road', t: 'Intercity trips', d: 'Comfortable long-distance rides between cities, with return options.' },
    { icon: 'brief', t: 'Corporate accounts', d: 'Monthly invoicing and priority booking for your team.' },
    { icon: 'group', t: 'Events and groups', d: 'Vans and minibuses for weddings, conferences, tours and teams.' },
  ],
  faq: [
    { q: 'How is my fare calculated?', a: 'Fares are based on distance and vehicle type, or on hours for chauffeur bookings. Airport fees, night surcharges, extras and tax are shown line by line before you confirm.' },
    { q: 'Can I cancel or change my booking?', a: 'Use Manage booking with your reference and email to cancel online. Contact us to change times or addresses.' },
    { q: 'What happens if my flight is delayed?', a: 'Add your flight number when you book. Your driver tracks the flight and adjusts the pickup time.' },
    { q: 'Do you provide child seats?', a: 'Yes. Add child seats as an extra during booking.' },
    { q: 'How can I pay?', a: 'Pay online by card when you book, or pay the driver at the end of the trip.' },
  ],
  terms: 'Fares are fixed at booking. Free waiting time is included for airport pickups. Cancellations made online before the cut-off are free; card payments are refunded to the original card.',
};
