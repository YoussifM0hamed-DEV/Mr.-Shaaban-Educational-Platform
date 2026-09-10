const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');

const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/error');
const { apiLimiter } = require('./middleware/rateLimit');
const { LOCAL_DIR } = require('./config/cloudinary');
const logger = require('./utils/logger');

const app = express();

// Behind a proxy (Render, Heroku, nginx) so secure cookies and rate limiting see the real IP.
app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin(origin, callback) {
      // Same-origin and server-to-server calls arrive without an Origin header.
      if (!origin) return callback(null, true);
      if (env.allowedOrigins.includes(origin.replace(/\/$/, ''))) return callback(null, true);
      return callback(new Error(`Origin not allowed by CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })
);

app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser(env.COOKIE_SECRET));

// Strips $ and . operators from user input so query objects cannot be injected.
app.use(mongoSanitize({ replaceWith: '_' }));

if (!env.isProd) app.use(morgan('dev'));

// Local fallback storage, only used when Cloudinary is not configured.
app.use('/uploads', express.static(LOCAL_DIR, { maxAge: '7d' }));

app.use('/api', apiLimiter, routes);

/**
 * Serve the built React app when it is sitting next to the API.
 *
 * That is the single-service setup. When the front end is deployed separately,
 * for example on Vercel, this build simply is not here and the API runs on its
 * own, so the check has to be for the folder rather than for production mode.
 */
const clientDist = path.resolve(__dirname, '../../client/dist');
if (env.isProd && fs.existsSync(path.join(clientDist, 'index.html'))) {
  logger.info('Serving the client build from this process');
  app.use(express.static(clientDist));
  app.get(/^\/(?!api|uploads).*/, (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
} else if (env.isProd) {
  logger.info('No client build found next to the API, running as an API-only service');
  app.get('/', (_req, res) =>
    res.json({ success: true, message: 'API is running. The web app is deployed separately.' })
  );
}

app.use(notFound);
app.use(errorHandler);

module.exports = app;
