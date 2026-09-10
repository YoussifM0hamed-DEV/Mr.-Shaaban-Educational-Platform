const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const logger = require('../utils/logger');

function notFound(req, _res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

/** Centralized error handler. Never leaks stack traces or driver internals in production. */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Something went wrong';
  let details = err.details;

  // Mongoose validation
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
  }

  // Bad ObjectId
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid value for ${err.path}`;
    details = undefined;
  }

  // Duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    message =
      field === 'email'
        ? 'An account with this email already exists'
        : `Duplicate value for ${field}`;
    details = undefined;
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid session';
  }

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} ->`, err.stack || err.message);
  } else {
    logger.debug(`${req.method} ${req.originalUrl} -> ${statusCode}: ${message}`);
  }

  const body = { success: false, message };
  if (details) body.details = details;
  if (!env.isProd && statusCode >= 500) body.stack = err.stack;

  res.status(statusCode).json(body);
}

module.exports = { notFound, errorHandler };
