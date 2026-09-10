const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const num = (v, d) => (v === undefined || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: num(process.env.PORT, 5000),

  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/shaaban_platform',

  JWT_SECRET: process.env.JWT_SECRET || 'dev_only_insecure_secret_change_me',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  COOKIE_SECRET: process.env.COOKIE_SECRET || 'dev_only_insecure_cookie_secret',

  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',

  PLATFORM_NAME: process.env.PLATFORM_NAME || 'Mr. Shaaban Educational Platform',
  TEACHER_NAME: process.env.TEACHER_NAME || 'Mr. Shaaban',
  TEACHER_EMAIL: (process.env.TEACHER_EMAIL || '').toLowerCase(),
  // No default on purpose: a password shipped in source is a password everyone knows.
  TEACHER_PASSWORD: process.env.TEACHER_PASSWORD || '',
  TEACHER_SUBJECT: process.env.TEACHER_SUBJECT || 'Arabic',

  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',

  INACTIVE_DAYS_THRESHOLD: num(process.env.INACTIVE_DAYS_THRESHOLD, 14),
  AT_RISK_DAYS_THRESHOLD: num(process.env.AT_RISK_DAYS_THRESHOLD, 5),
  VIDEO_COMPLETION_THRESHOLD: num(process.env.VIDEO_COMPLETION_THRESHOLD, 90),

  ZOOM_ACCOUNT_ID: process.env.ZOOM_ACCOUNT_ID || '',
  ZOOM_CLIENT_ID: process.env.ZOOM_CLIENT_ID || '',
  ZOOM_CLIENT_SECRET: process.env.ZOOM_CLIENT_SECRET || '',

  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: num(process.env.SMTP_PORT, 465),
  SMTP_SECURE: String(process.env.SMTP_SECURE ?? 'true') === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: (process.env.SMTP_PASS || '').replace(/\s+/g, ''),
  MAIL_FROM: process.env.MAIL_FROM || '',
  PASSWORD_RESET_TTL_MINUTES: num(process.env.PASSWORD_RESET_TTL_MINUTES, 60),
};

env.isProd = env.NODE_ENV === 'production';

// CLIENT_URL may hold several origins, comma separated, so a preview deployment
// and the live site can both talk to one API.
// The first one is the canonical site. Every link we put in an email must be
// built from this, never from CLIENT_URL, which may be a list.
env.allowedOrigins = env.CLIENT_URL.split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

env.primaryOrigin = env.allowedOrigins[0] || 'http://localhost:5173';
env.cloudinaryConfigured = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
);
env.mailConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
env.zoomConfigured = Boolean(
  env.ZOOM_ACCOUNT_ID && env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET
);
// Gmail rejects a From address that is not the authenticated account.
env.mailFrom = env.MAIL_FROM || (env.SMTP_USER ? `${env.PLATFORM_NAME} <${env.SMTP_USER}>` : '');

if (env.isProd) {
  const required = ['JWT_SECRET', 'COOKIE_SECRET', 'MONGODB_URI'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
  }
}

module.exports = env;
