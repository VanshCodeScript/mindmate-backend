/**
 * optionalAuth middleware
 * ---------------------
 * If a valid JWT is present → attaches `req.user` (the full Mongoose doc) and `req.auth` (decoded token).
 * If the token is missing or invalid → continues without error (req.user stays undefined).
 *
 * This lets routes work in both authenticated and dev/anonymous modes.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = () => process.env.JWT_SECRET || 'your-super-secret-key-change-this-in-production-min-32-chars';

module.exports = async function optionalAuth(req, _res, next) {
  req.user = undefined;
  req.auth = undefined;

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return next();

    const token = authHeader.split(' ')[1];
    if (!token) return next();

    const decoded = jwt.verify(token, JWT_SECRET());

    // Attach the lightweight decoded claims for quick checks
    req.auth = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    // Attach the full User document so the route can mutate and save it
    const user = await User.findById(decoded.id);
    if (user) {
      req.user = user;
    }
  } catch (_err) {
    // Token invalid / expired — silently ignore (this is *optional* auth)
  }

  return next();
};
