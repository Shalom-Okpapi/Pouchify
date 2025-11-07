const express = require('express');
const { query } = require('../config/database');
const { optionalAuth } = require('../middleware/auth');
const router = express.Router();

// @route   GET /api/products
// @desc    Get all active products with optional filtering
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      category,
      minPrice,
      maxPrice,
      search
    } = req.query;

    const offset = (page - 1) * limit;
    let whereClause = 'WHERE p.is_active = true';
    let queryParams = [];
    let paramIndex = 1;

    // Add category filter
    if (category) {
      whereClause += ` AND p.base_product_type = $${paramIndex}`;
      queryParams.push(category);
      paramIndex++;
    }

    // Add price range filter
    if (minPrice) {
      whereClause += ` AND p.base_price >= $${paramIndex}`;
      queryParams.push(parseFloat(minPrice));
      paramIndex++;
    }

    if (maxPrice) {
      whereClause += ` AND p.base_price <= $${paramIndex}`;
      queryParams.push(parseFloat(maxPrice));
      paramIndex++;
    }

    // Add search filter
    if (search) {
      whereClause += ` AND (p.description ILIKE $${paramIndex} OR p.base_product_type ILIKE $${paramIndex})`;
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Validate sort field
    const validSortFields = ['created_at', 'base_price', 'base_product_type'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Get products with design count
    const productsQuery = `
      SELECT
        p.id,
        p.base_product_type,
        p.base_price,
        p.description,
        p.product_images,
        p.created_at,
        COUNT(DISTINCT pd.id) as design_count
      FROM products p
      LEFT JOIN product_designs pd ON p.id = pd.product_id AND pd.is_active = true
      LEFT JOIN designs d ON pd.design_id = d.id AND d.design_status = 'approved' AND d.is_public = true
      ${whereClause}
      GROUP BY p.id, p.base_product_type, p.base_price, p.description, p.product_images, p.created_at
      ORDER BY p.${sortField} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(parseInt(limit), offset);

    const productsResult = await query(productsQuery, queryParams);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT p.id) as total
      FROM products p
      ${whereClause}
    `;

    const countResult = await query(countQuery, queryParams.slice(0, -2));
    const totalProducts = parseInt(countResult.rows[0].total);

    const totalPages = Math.ceil(totalProducts / limit);

    res.json({
      success: true,
      data: {
        products: productsResult.rows.map(product => ({
          id: product.id,
          baseProductType: product.base_product_type,
          basePrice: parseFloat(product.base_price),
          description: product.description,
          productImages: product.product_images || [],
          designCount: parseInt(product.design_count),
          createdAt: product.created_at
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalProducts,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching products'
    });
  }
});

// @route   GET /api/products/:id
// @desc    Get product details with designs
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get product details
    const productQuery = `
      SELECT id, base_product_type, base_price, description, product_images, created_at
      FROM products
      WHERE id = $1 AND is_active = true
    `;

    const productResult = await query(productQuery, [id]);

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const product = productResult.rows[0];

    // Get designs for this product
    const designsQuery = `
      SELECT
        d.id,
        d.design_name,
        d.preview_image_url,
        d.tags,
        d.created_at,
        u.first_name,
        u.last_name,
        u.shop_name,
        pd.final_price,
        pd.artist_price_markup
      FROM designs d
      JOIN users u ON d.artist_id = u.id
      JOIN product_designs pd ON d.id = pd.design_id
      WHERE pd.product_id = $1
        AND d.design_status = 'approved'
        AND d.is_public = true
        AND pd.is_active = true
      ORDER BY d.created_at DESC
    `;

    const designsResult = await query(designQuery, [id]);

    res.json({
      success: true,
      data: {
        product: {
          id: product.id,
          baseProductType: product.base_product_type,
          basePrice: parseFloat(product.base_price),
          description: product.description,
          productImages: product.product_images || [],
          createdAt: product.created_at
        },
        designs: designsResult.rows.map(design => ({
          id: design.id,
          designName: design.design_name,
          previewImageUrl: design.preview_image_url,
          tags: design.tags || [],
          createdAt: design.created_at,
          artist: {
            firstName: design.first_name,
            lastName: design.last_name,
            shopName: design.shop_name
          },
          pricing: {
            finalPrice: parseFloat(design.final_price),
            artistMarkup: parseFloat(design.artist_price_markup)
          }
        }))
      }
    });

  } catch (error) {
    console.error('Get product details error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching product details'
    });
  }
});

// @route   GET /api/products/featured
// @desc    Get featured products and designs
// @access  Public
router.get('/featured', optionalAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Get featured designs across all products
    const featuredDesignsQuery = `
      SELECT
        d.id as design_id,
        d.design_name,
        d.preview_image_url,
        d.tags,
        d.created_at,
        u.first_name,
        u.last_name,
        u.shop_name,
        p.id as product_id,
        p.base_product_type,
        p.base_price,
        pd.final_price,
        pd.artist_price_markup,
        p.product_images
      FROM designs d
      JOIN users u ON d.artist_id = u.id
      JOIN product_designs pd ON d.id = pd.design_id
      JOIN products p ON pd.product_id = p.id
      WHERE d.design_status = 'approved'
        AND d.is_public = true
        AND pd.is_active = true
        AND p.is_active = true
      ORDER BY d.created_at DESC
      LIMIT $1
    `;

    const featuredResult = await query(featuredDesignsQuery, [limit]);

    res.json({
      success: true,
      data: {
        featuredItems: featuredResult.rows.map(item => ({
          design: {
            id: item.design_id,
            designName: item.design_name,
            previewImageUrl: item.preview_image_url,
            tags: item.tags || [],
            createdAt: item.created_at
          },
          product: {
            id: item.product_id,
            baseProductType: item.base_product_type,
            basePrice: parseFloat(item.base_price),
            productImages: item.product_images || []
          },
          artist: {
            firstName: item.first_name,
            lastName: item.last_name,
            shopName: item.shop_name
          },
          pricing: {
            finalPrice: parseFloat(item.final_price),
            artistMarkup: parseFloat(item.artist_price_markup)
          }
        }))
      }
    });

  } catch (error) {
    console.error('Get featured products error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching featured products'
    });
  }
});

// @route   GET /api/products/categories
// @desc    Get available product categories
// @access  Public
router.get('/categories', async (req, res) => {
  try {
    const categoriesQuery = `
      SELECT
        base_product_type,
        COUNT(*) as product_count,
        MIN(base_price) as min_price,
        MAX(base_price) as max_price
      FROM products
      WHERE is_active = true
      GROUP BY base_product_type
      ORDER BY product_count DESC
    `;

    const categoriesResult = await query(categoriesQuery);

    res.json({
      success: true,
      data: {
        categories: categoriesResult.rows.map(category => ({
          name: category.base_product_type,
          displayName: category.base_product_type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          productCount: parseInt(category.product_count),
          priceRange: {
            min: parseFloat(category.min_price),
            max: parseFloat(category.max_price)
          }
        }))
      }
    });

  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error fetching categories'
    });
  }
});

module.exports = router;