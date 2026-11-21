/** All runtime configuration comes from environment variables (see .env.example). */
const env = (k: string, d = '') => (process.env[k] ?? d).trim();

export const config = {
  port: Number(env('PORT', '3000')),
  appUrl: env('APP_URL', 'http://localhost:3000').replace(/\/$/, ''),
  databaseUrl: env('DATABASE_URL', 'postgres://rideora:rideora@localhost:5432/rideora'),
  databaseSsl: env('DATABASE_SSL') === 'true',
  jwtSecret: env('JWT_SECRET'),
  jwtExpires: env('JWT_EXPIRES', '12h'),
  adminEmail: env('ADMIN_EMAIL', 'admin@example.com'),
  adminPassword: env('ADMIN_PASSWORD'),
  region: env('REGION', 'generic'),
  seedDemo: env('SEED_DEMO') === 'true',
  webDist: env('WEB_DIST', ''),
  trustProxy: env('TRUST_PROXY', 'true') === 'true',
  googleMapsKey: env('GOOGLE_MAPS_API_KEY'),
  payments: {
    provider: env('PAYMENT_PROVIDER', 'none') as 'none' | 'razorpay' | 'stripe',
    razorpayKeyId: env('RAZORPAY_KEY_ID'),
    razorpayKeySecret: env('RAZORPAY_KEY_SECRET'),
    stripeSecretKey: env('STRIPE_SECRET_KEY'),
  },
  smtp: {
    host: env('SMTP_HOST'),
    port: Number(env('SMTP_PORT', '587')),
    secure: env('SMTP_SECURE') === 'true',
    user: env('SMTP_USER'),
    pass: env('SMTP_PASS'),
    from: env('MAIL_FROM'),
  },
};

export function assertConfig() {
  const problems: string[] = [];
  if (!config.jwtSecret || config.jwtSecret.length < 32) problems.push('JWT_SECRET must be set to a random string of at least 32 characters');
  if (config.payments.provider === 'razorpay' && (!config.payments.razorpayKeyId || !config.payments.razorpayKeySecret)) problems.push('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required when PAYMENT_PROVIDER=razorpay');
  if (config.payments.provider === 'stripe' && !config.payments.stripeSecretKey) problems.push('STRIPE_SECRET_KEY is required when PAYMENT_PROVIDER=stripe');
  if (problems.length) {
    console.error('Configuration problems:\n - ' + problems.join('\n - '));
    process.exit(1);
  }
}
