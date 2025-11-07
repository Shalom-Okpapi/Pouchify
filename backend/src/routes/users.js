const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { auth, authorize } = require('../middleware/auth');
const router = express.Router();

// All user routes require authentication
router.use(auth);

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', async (req, res) => {
  try {
    const userResult = await query(
      `SELECT id, email, first_name, last_name, user_type, shop_name, paypal_email,
              stripe_account_id, profile_image_url, is_verified, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const user = userResult.rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        userType: user.user_type,
        shopName: user.shop_name,
        paypalEmail: user.paypal_email,
        stripeAccountId: user.stripe_account_id,
        profileImageUrl: user.profile_image_url,
        isVerified: user.is_verified,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      }
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching profile'
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', [
  body('firstName').optional().trim().isLength({ min: 1 }).withMessage('First name cannot be empty'),
  body('lastName').optional().trim().isLength({ min: 1 }).withMessage('Last name cannot be empty'),
  body('shopName').optional().trim().isLength({ min: 1 }).withMessage('Shop name cannot be empty'),
  body('paypalEmail').optional().isEmail().normalizeEmail().withMessage('Valid PayPal email required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { firstName, lastName, shopName, paypalEmail } = req.body;
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (firstName !== undefined) {
      updates.push(`first_name = $${paramIndex}`);
      values.push(firstName);
      paramIndex++;
    }

    if (lastName !== undefined) {
      updates.push(`last_name = $${paramIndex}`);
      values.push(lastName);
      paramIndex++;
    }

    if (shopName !== undefined) {
      updates.push(`shop_name = $${paramIndex}`);
      values.push(shopName);
      paramIndex++;
    }

    if (paypalEmail !== undefined) {
      updates.push(`paypal_email = $${paramIndex}`);
      values.push(paypalEmail);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update'
      });
    }

    values.push(req.user.id);

    const updateQuery = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, email, first_name, last_name, user_type, shop_name, paypal_email,
                stripe_account_id, profile_image_url, is_verified, created_at, updated_at
    `;

    const result = await query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const updatedUser = result.rows[0];

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        userType: updatedUser.user_type,
        shopName: updatedUser.shop_name,
        paypalEmail: updatedUser.paypal_email,
        stripeAccountId: updatedUser.stripe_account_id,
        profileImageUrl: updatedUser.profile_image_url,
        isVerified: updatedUser.is_verified,
        createdAt: updatedUser.created_at,
        updatedAt: updatedUser.updated_at
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error updating profile'
    });
  }
});

// @route   GET /api/users/artist-shop
// @desc    Get artist shop information (for artists only)
// @access  Private (Artist only)
router.get('/artist-shop', authorize('artist'), async (req, res) => {
  try {
    const artistId = req.user.id;

    // Get artist info
    const artistQuery = `
      SELECT id, first_name, last_name, shop_name, profile_image_url, created_at
      FROM users
      WHERE id = $1 AND user_type = 'artist'
    `;

    const artistResult = await query(artistQuery, [artistId]);

    if (artistResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Artist shop not found'
      });
    }

    const artist = artistResult.rows[0];

    // Get artist's design count
    const designCountQuery = `
      SELECT COUNT(*) as count
      FROM designs
      WHERE artist_id = $1 AND design_status = 'approved'
    `;

    const designCountResult = await query(designCountQuery, [artistId]);
    const designCount = parseInt(designCountResult.rows[0].count);

    // Get artist's total sales
    const salesQuery = `
      SELECT SUM(oi.quantity * oi.unit_price) as total_sales,
             COUNT(DISTINCT o.id) as total_orders
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN product_designs pd ON oi.product_design_id = pd.id
      JOIN designs d ON pd.design_id = d.id
      WHERE d.artist_id = $1 AND o.order_status != 'cancelled'
    `;

    const salesResult = await query(salesQuery, [artistId]);
    const sales = salesResult.rows[0];

    res.json({
      success: true,
      data: {
        artist: {
          id: artist.id,
          firstName: artist.first_name,
          lastName: artist.last_name,
          shopName: artist.shop_name,
          profileImageUrl: artist.profile_image_url,
          memberSince: artist.created_at
        },
        stats: {
          designCount,
          totalSales: parseFloat(sales.total_sales) || 0,
          totalOrders: parseInt(sales.total_orders) || 0
        }
      }
    });

  } catch (error) {
    console.error('Get artist shop error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching artist shop'
    });
  }
});

// TODO: Add profile picture upload endpoint
// This will be implemented with the file upload system

module.exports = router;