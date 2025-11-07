const express = require('express');
const { authorize } = require('../middleware/auth');
const router = express.Router();

// All artist routes require artist authentication
router.use(authorize('artist'));

// @route   GET /api/artist/earnings
// @desc    Get artist earnings
// @access  Private (Artist only)
router.get('/earnings', (req, res) => {
  res.json({
    success: false,
    message: 'Artist earnings endpoint - TODO: Implement earnings system'
  });
});

// @route   GET /api/artist/dashboard-stats
// @desc    Get dashboard metrics
// @access  Private (Artist only)
router.get('/dashboard-stats', (req, res) => {
  res.json({
    success: false,
    message: 'Dashboard stats endpoint - TODO: Implement analytics'
  });
});

// TODO: Implement remaining artist dashboard endpoints

module.exports = router;