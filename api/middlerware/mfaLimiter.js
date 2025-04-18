const rateLimit = require('express-rate-limit');

const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per window
  message: 'Too many attempts, please try again later'
});

module.exports = mfaLimiter;