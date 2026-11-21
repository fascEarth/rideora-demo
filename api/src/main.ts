import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { assertConfig, config } from './config';
import { SettingsService } from './services/core.services';

async function bootstrap() {
  assertConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: false });
  if (config.trustProxy) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.useBodyParser('json', { limit: '200kb' });
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
        frameSrc: ['https://api.razorpay.com', 'https://checkout.razorpay.com'],
        formAction: ["'self'", 'https://checkout.stripe.com', 'https://api.razorpay.com'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: config.appUrl.startsWith('https') ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // Serve the Angular website and admin app from the same origin.
  const dist = config.webDist || join(__dirname, '..', '..', 'web', 'dist', 'web', 'browser');
  if (existsSync(join(dist, 'index.html'))) {
    const settings = app.get(SettingsService);
    const template = readFileSync(join(dist, 'index.html'), 'utf8');
    const esc = (s: string) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    app.useStaticAssets(dist, { index: false, maxAge: '7d', setHeaders: (res, path) => { if (path.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); } });
    app.use(async (req: any, res: any, next: any) => {
      if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path.startsWith('/api/') || /\.[a-z0-9]+$/i.test(req.path)) return next();
      const [brand, content] = await Promise.all([settings.brand(), settings.content()]);
      const html = template
        .replace(/<title>.*?<\/title>/, `<title>${esc(brand.name)}${brand.tagline ? ' | ' + esc(brand.tagline) : ''}</title>`)
        .replace('</head>', `<meta name="description" content="${esc(content.metaDescription || brand.tagline || '')}"><meta name="theme-color" content="${esc(brand.primary)}"><meta property="og:title" content="${esc(brand.name)}"><meta property="og:description" content="${esc(content.metaDescription || '')}"><meta property="og:url" content="${esc(config.appUrl + req.path)}"></head>`);
      res.setHeader('Cache-Control', 'no-cache');
      res.type('html').send(html);
    });
  } else {
    Logger.warn(`Website build not found at ${dist}; serving the API only`, 'Web');
  }
  await app.listen(config.port, '0.0.0.0');
  Logger.log(`Rideora is running on ${config.appUrl} (port ${config.port})`, 'Bootstrap');
}
bootstrap();
