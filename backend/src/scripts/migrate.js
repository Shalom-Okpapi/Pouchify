const { query } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const createTables = async () => {
  try {
    console.log('Starting database migration...');

    // Enable UUID extension
    await query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('customer', 'artist', 'admin')),
        shop_name VARCHAR(255),
        paypal_email VARCHAR(255),
        stripe_account_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        is_verified BOOLEAN DEFAULT FALSE,
        profile_image_url VARCHAR(500)
      )
    `);

    // Products table
    await query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        base_product_type VARCHAR(50) NOT NULL CHECK (base_product_type IN ('power_bank_pouch', 'phone_pouch', 'accessory')),
        base_price DECIMAL(10,2) NOT NULL,
        description TEXT,
        product_images JSONB,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Designs table
    await query(`
      CREATE TABLE IF NOT EXISTS designs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        design_name VARCHAR(255) NOT NULL,
        design_file_url VARCHAR(500) NOT NULL,
        preview_image_url VARCHAR(500) NOT NULL,
        is_public BOOLEAN DEFAULT TRUE,
        tags JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        design_status VARCHAR(20) DEFAULT 'pending' CHECK (design_status IN ('pending', 'approved', 'rejected'))
      )
    `);

    // Product_Designs junction table
    await query(`
      CREATE TABLE IF NOT EXISTS product_designs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        design_id UUID NOT NULL REFERENCES designs(id) ON DELETE CASCADE,
        artist_price_markup DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        final_price DECIMAL(10,2) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        UNIQUE(product_id, design_id)
      )
    `);

    // Orders table
    await query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        customer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_status VARCHAR(20) DEFAULT 'pending' CHECK (order_status IN ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
        total_amount DECIMAL(10,2) NOT NULL,
        shipping_address JSONB NOT NULL,
        billing_address JSONB NOT NULL,
        order_type VARCHAR(20) DEFAULT 'public' CHECK (order_type IN ('public', 'custom_private')),
        stripe_payment_intent_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Order_Items table
    await query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_design_id UUID REFERENCES product_designs(id) ON DELETE SET NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price DECIMAL(10,2) NOT NULL,
        custom_design_url VARCHAR(500),
        product_name VARCHAR(255) NOT NULL,
        artist_name VARCHAR(255),
        design_name VARCHAR(255)
      )
    `);

    // Artist_Earnings table
    await query(`
      CREATE TABLE IF NOT EXISTS artist_earnings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        artist_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_item_id UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
        earning_amount DECIMAL(10,2) NOT NULL,
        payout_status VARCHAR(20) DEFAULT 'pending' CHECK (payout_status IN ('pending', 'paid')),
        payout_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    await query('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    await query('CREATE INDEX IF NOT EXISTS idx_users_type ON users(user_type)');
    await query('CREATE INDEX IF NOT EXISTS idx_designs_artist_id ON designs(artist_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_designs_status ON designs(design_status)');
    await query('CREATE INDEX IF NOT EXISTS idx_designs_public ON designs(is_public)');
    await query('CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status)');
    await query('CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_artist_earnings_artist_id ON artist_earnings(artist_id)');
    await query('CREATE INDEX IF NOT EXISTS idx_artist_earnings_status ON artist_earnings(payout_status)');

    // Create updated_at trigger function
    await query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$ language 'plpgsql';
    `);

    // Add updated_at triggers to tables
    const tablesWithUpdatedAt = ['users', 'products', 'designs', 'orders'];
    for (const table of tablesWithUpdatedAt) {
      await query(`
        CREATE TRIGGER update_${table}_updated_at
        BEFORE UPDATE ON ${table}
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `);
    }

    console.log('Database migration completed successfully!');

    // Insert some default products
    await seedDefaultProducts();

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

const seedDefaultProducts = async () => {
  try {
    console.log('Seeding default products...');

    const defaultProducts = [
      {
        base_product_type: 'power_bank_pouch',
        base_price: 15.00,
        description: 'Durable power bank pouch with custom design. Fits most standard power banks up to 20,000mAh.',
        product_images: ['powerbank_pouch_1.jpg', 'powerbank_pouch_2.jpg']
      },
      {
        base_product_type: 'phone_pouch',
        base_price: 12.00,
        description: 'Protective phone pouch with custom design. Universal fit for most smartphone sizes.',
        product_images: ['phone_pouch_1.jpg', 'phone_pouch_2.jpg']
      },
      {
        base_product_type: 'accessory',
        base_price: 8.00,
        description: 'Multi-purpose accessory pouch with custom design. Perfect for cables, headphones, and small essentials.',
        product_images: ['accessory_pouch_1.jpg', 'accessory_pouch_2.jpg']
      }
    ];

    for (const product of defaultProducts) {
      const existingProduct = await query(
        'SELECT id FROM products WHERE base_product_type = $1',
        [product.base_product_type]
      );

      if (existingProduct.rows.length === 0) {
        await query(`
          INSERT INTO products (base_product_type, base_price, description, product_images)
          VALUES ($1, $2, $3, $4)
        `, [product.base_product_type, product.base_price, product.description, JSON.stringify(product.product_images)]);

        console.log(`Added default product: ${product.base_product_type}`);
      }
    }

    console.log('Default products seeded successfully!');
  } catch (error) {
    console.error('Error seeding default products:', error);
  }
};

// Run migration if this file is executed directly
if (require.main === module) {
  createTables()
    .then(() => {
      console.log('Migration process completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

module.exports = { createTables, seedDefaultProducts };