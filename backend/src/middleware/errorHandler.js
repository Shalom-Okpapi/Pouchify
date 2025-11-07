const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error(err);

  // PostgreSQL error handling
  if (err.code === '23505') {
    const message = 'Duplicate entry. This resource already exists.';
    error = { message, statusCode: 400 };
  }

  if (err.code === '23503') {
    const message = 'Foreign key constraint violation. Referenced resource does not exist.';
    error = { message, statusCode: 400 };
  }

  if (err.code === '23502') {
    const message = 'Required field is missing.';
    error = { message, statusCode: 400 };
  }

  // JWT error handling
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token. Please log in again.';
    error = { message, statusCode: 401 };
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired. Please log in again.';
    error = { message, statusCode: 401 };
  }

  // Validation errors
  if (err.type === 'entity.parse.failed') {
    const message = 'Invalid JSON in request body.';
    error = { message, statusCode: 400 };
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    const message = 'File too large. Maximum size is 50MB.';
    error = { message, statusCode: 400 };
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    const message = 'Too many files uploaded.';
    error = { message, statusCode: 400 };
  }

  // Stripe errors
  if (err.type === 'StripeCardError') {
    const message = 'Your card was declined.';
    error = { message, statusCode: 400 };
  }

  if (err.type === 'StripeRateLimitError') {
    const message = 'Too many requests to Stripe. Please try again later.';
    error = { message, statusCode: 429 };
  }

  if (err.type === 'StripeInvalidRequestError') {
    const message = 'Invalid request to Stripe.';
    error = { message, statusCode: 400 };
  }

  if (err.type === 'StripeAPIError') {
    const message = 'Stripe API error. Please try again later.';
    error = { message, statusCode: 500 };
  }

  if (err.type === 'StripeConnectionError') {
    const message = 'Could not connect to Stripe. Please try again later.';
    error = { message, statusCode: 500 };
  }

  // AWS S3 errors
  if (err.code === 'NoSuchBucket') {
    const message = 'File storage bucket not found.';
    error = { message, statusCode: 500 };
  }

  if (err.code === 'AccessDenied') {
    const message = 'Access denied to file storage.';
    error = { message, statusCode: 500 };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;