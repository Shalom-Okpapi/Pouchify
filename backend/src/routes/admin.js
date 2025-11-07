const express = require('express');
const { authorize } = require('../middleware/auth');
const router = express.Router();

// All admin routes require admin authentication
router.use(authorize('admin'));

// @route   GET /api/admin/users
// @desc    Get all users
// @access  Private (Admin only)
router.get('/users', (req, res) => {
  res.json({
    success: false,
    message: 'Admin users endpoint - TODO: Implement admin panel'
  });
});

// @route   GET /api/admin/orders
// @desc    Get all orders
// @access  Private (Admin only)
router.get('/orders', (req, res) => {
  res.json({
    success: false,
    message: 'Admin orders endpoint - TODO: Implement admin panel'
  });
});

// TODO: Implement remaining admin panel endpoints

module.exports = router;