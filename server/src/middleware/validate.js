const { ZodError } = require('zod');
const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

function formatZodError(error) {
  return error.issues.map((i) => ({
    field: i.path.join('.') || '(root)',
    message: i.message,
  }));
}

/**
 * Validates and REPLACES req.body / req.query / req.params with the parsed result,
 * so controllers only ever see whitelisted, coerced values.
 */
function validate(schemas = {}) {
  return (req, _res, next) => {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
      if (schemas.query) req.validatedQuery = schemas.query.parse(req.query ?? {});
      if (schemas.params) req.params = schemas.params.parse(req.params ?? {});
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return next(ApiError.badRequest('Validation failed', formatZodError(err)));
      }
      next(err);
    }
  };
}

/** Rejects a request whose route params are not valid ObjectIds. */
function validateObjectId(...paramNames) {
  const names = paramNames.length ? paramNames : ['id'];
  return (req, _res, next) => {
    for (const name of names) {
      const value = req.params[name];
      if (value !== undefined && !mongoose.Types.ObjectId.isValid(value)) {
        return next(ApiError.badRequest(`Invalid ${name}`));
      }
    }
    next();
  };
}

module.exports = { validate, validateObjectId };
