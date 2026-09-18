import { HttpError } from './errorHandler.js';

/**
 * Validates req[source] against a zod schema and replaces it with the parsed value.
 */
export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return next(new HttpError(400, 'Validation failed', result.error.flatten().fieldErrors));
  }
  req[source] = result.data;
  next();
};
