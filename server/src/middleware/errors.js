function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(error, req, res, next) { // eslint-disable-line no-unused-vars
  const status = error.status || (error.name === 'ValidationError' ? 400 : error.code === 11000 ? 409 : 500);
  const message = status === 500 ? 'Internal server error' : error.code === 11000 ? 'An account with that email already exists' : error.message;
  if (status === 500) console.error(error);
  res.status(status).json({
    message,
    ...(error.name === 'ValidationError' && { errors: Object.values(error.errors).map((item) => item.message) }),
  });
}

module.exports = { notFound, errorHandler };
