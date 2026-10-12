function validate(schema) {
  return (req, res, next) => {
    const errors = schema(req);
    if (errors.length) return res.status(400).json({ message: 'Invalid request', errors });
    return next();
  };
}

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

module.exports = { validate, isEmail, isObject };
