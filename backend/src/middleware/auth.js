const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from database
      const userResult = await query(
        'SELECT id, email, first_name, last_name, user_type, is_verified FROM users WHERE id = $1',
        [decoded.id]
      );

      if (userResult.rows.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Invalid token. User not found.'
        });
      }

      const user = userResult.rows[0];

      if (!user.is_verified) {
        return res.status(401).json({
          success: false,
          error: 'Account not verified. Please check your email.'
        });
      }

      req.user = user;
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired. Please log in again.',
          code: 'TOKEN_EXPIRED'
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Invalid token. Please log in again.'
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error in authentication.'
    });
  }
};

// Role-based access control middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. Authentication required.'
      });
    }

    if (!roles.includes(req.user.user_type)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Insufficient permissions.'
      });
    }

    next();
  };
};

// Optional auth - doesn't fail if no token, but adds user if token exists
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const userResult = await query(
          'SELECT id, email, first_name, last_name, user_type, is_verified FROM users WHERE id = $1',
          [decoded.id]
        );

        if (userResult.rows.length > 0 && userResult.rows[0].is_verified) {
          req.user = userResult.rows[0];
        }
      } catch (jwtError) {
        // Ignore invalid tokens for optional auth
      }
    }

    next();
  } catch (error) {
    next();
  }
};

module.exports = { auth, authorize, optionalAuth };