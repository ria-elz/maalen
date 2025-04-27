const express       = require('express');
const mysql         = require('mysql2');
const session       = require('express-session');
const bodyParser    = require('body-parser');
const cors          = require('cors');
const path = require('path');
const { PGCreateOrder } = require('cashfree-pg-sdk-nodejs');

// Configure Cashfree credentials
process.env.CF_CLIENT_ID = 'TEST10582596af277e34cbec3888d6df69528501';
process.env.CF_CLIENT_SECRET = 'cfsk_ma_test_d1df753026605039ce3fb8d8a7f0b4bd_bc633aea';
process.env.CF_ENVIRONMENT = 'TEST';

const app = express();
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Add specific CORS configuration
const corsOptions = {
  origin: ['http://localhost:5500', 'http://127.0.0.1:5500'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// serve your admin + frontend static files
app.use(express.static(path.join(__dirname, 'public')));

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',       // Use your own DB password
  database: 'maalen' // Use your DB name
});

db.connect(err => {
  if (err) throw err;
  console.log('MySQL connected ✅');
});
// Middleware for parsing POST data
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true
}));



// Dummy admin credentials
const adminCredentials = { username: 'admin', password: 'admin123' };

app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'adminLogin.html'));
});
app.get('/admin/dashboard', (req, res) => {
    if (!req.session.isAdmin) {
        return res.redirect('/admin/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'adminDashboard.html'));
});


// Login Route
app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === adminCredentials.username && password === adminCredentials.password) {
        req.session.isAdmin = true;
        res.redirect('/admin/dashboard');
    } else {
        res.status(401).send('Invalid credentials');
    }
});

// Admin Dashboard Route (protected)
app.get('/admin/dashboard', (req, res) => {
    if (!req.session.isAdmin) {
      return res.redirect('/admin/login');
    }
    res.sendFile(path.join(__dirname, 'public', 'adminDashboard.html'));
  });

// 🚀 API Route: Get Product by ID
app.get('/api/product/:id', (req, res) => {
  const { id } = req.params;
  const query = 'SELECT * FROM products WHERE id = ?';
  db.query(query, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err });
    if (results.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.json(results[0]);
  });
});
// Fetch featured products with proper fields
// Update the featured products route
app.get('/api/products/featured', (req, res) => {
  const query = `
    SELECT id, name, variant, image_url, 
           original_price, current_price, sale_price,
           is_featured 
    FROM products 
    WHERE is_featured = 1
    ORDER BY created_at DESC
    LIMIT 10;
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Database Error:', err);
      return res.status(500).json({ 
        error: 'Failed to fetch featured products',
        details: err.message
      });
    }
    
    // Convert numeric fields to numbers
    const products = results.map(product => ({
      ...product,
      original_price: Number(product.original_price),
      current_price: Number(product.current_price),
      sale_price: Number(product.sale_price),
      is_featured: Boolean(product.is_featured)
    }));

    res.json(products);
  });
});
  // Add a new product
  app.post('/admin/products/add', (req, res) => {
    const { name, price, description, image_url, is_featured } = req.body;
  
    console.log("Form data received:", req.body); // Debugging
  
    const query = `
      INSERT INTO products (name, price, description, image_url, is_featured)
      VALUES (?, ?, ?, ?, ?)
    `;
  
    db.query(query, [name, price, description, image_url, is_featured || 0], (err, result) => {
      if (err) {
        console.error('Error adding product:', err);
        return res.status(500).json({ error: 'Failed to add product' });
      }
      res.send('Product added successfully');
    });
  });
  
  

// Update Tracking Info
app.post('/admin/tracking/update', (req, res) => {
    const { orderId, trackingNumber, status } = req.body;
    const query = 'UPDATE orders SET tracking_number = ?, status = ? WHERE id = ?';
    db.query(query, [trackingNumber, status, orderId], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.send('Tracking information updated');
    });
});
// API to get sales data
app.get('/api/sales/data', (req, res) => {
    // Query your database to get sales data
    const salesDataQuery = `
        SELECT products.name, SUM(orders.amount) as salesAmount, DATE(orders.created_at) as date
        FROM orders
        INNER JOIN products ON orders.product_id = products.id
        GROUP BY products.name, DATE(orders.created_at)
        ORDER BY date DESC;
    `;
    db.query(salesDataQuery, (err, results) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        // Process the results for the charts
        const productNames = [];
        const salesAmounts = [];
        const dates = [];
        const salesTrend = [];

        results.forEach(row => {
            productNames.push(row.name);
            salesAmounts.push(row.salesAmount);
            dates.push(row.date);
            salesTrend.push(row.salesAmount);
        });

        res.json({
            productNames,
            salesAmounts,
            dates,
            salesTrend
        });
    });
});
app.get('/admin/products/manage', (req, res) => {
    if (!req.session.isAdmin) return res.redirect('/admin/login');
    res.sendFile(path.join(__dirname, 'public', 'manageProducts.html'));
});
app.get('/api/products', (req, res) => {
    db.query('SELECT * FROM products', (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    });
  });  

// Update product details
app.post('/admin/products/update/:id', (req, res) => {
    const { id } = req.params;
    const { name, quantity, variant, rating, original_price, current_price, is_featured } = req.body;
  
    const query = `
      UPDATE products
      SET name = ?, quantity = ?, variant = ?, rating = ?, original_price = ?, current_price = ?, is_featured = ?
      WHERE id = ?
    `;
    db.query(
      query,
      [name, quantity, variant, rating, original_price, current_price, is_featured || 0, id],
      (err, result) => {
        if (err) {
          console.error('Error updating product:', err);
          return res.status(500).json({ error: 'Failed to update product' });
        }
        res.json({ message: 'Product updated successfully' });
      }
    );
  });
 // Delete a product by ID
 app.delete('/admin/products/delete/:id', (req, res) => {
    const { id } = req.params;
    console.log(`DELETE request received for product id: ${id}`); // Debugging log
  
    const query = 'DELETE FROM products WHERE id = ?';
    db.query(query, [id], (err, result) => {
      if (err) {
        console.error('Error deleting product:', err);
        return res.status(500).json({ error: 'Failed to delete product' });
      }
  
      if (result.affectedRows === 0) {
        console.warn(`Product with id ${id} not found`);
        return res.status(404).json({ error: 'Product not found' });
      }
  
      console.log(`Product with id ${id} deleted successfully`);
      res.json({ message: 'Product deleted successfully' });
    });
  });

 app.post('/payments/cashfree/create-order', async (req, res) => {
  try {
    const { orderId, amount, customerName, customerEmail, customerPhone } = req.body;

    // Validate request
    if (!/^\d{10}$/.test(customerPhone)) {
      return res.status(400).json({ error: 'Invalid phone number (10 digits required)' });
    }
    if (parseFloat(amount) < 1) {
      return res.status(400).json({ error: 'Minimum amount should be ₹1.00' });
    }

    // Create Cashfree order request
    const request = {
      order_id: orderId,
      order_amount: parseFloat(amount).toFixed(2),
      order_currency: "INR",
      customer_details: {
        customer_id: orderId,
        customer_name: customerName,
        customer_email: customerEmail,
        customer_phone: customerPhone
      },
      order_meta: {
        return_url: "http://localhost:5500/order-status.html?order_id=" + orderId
      }
    };

    // Generate API version (YYYY-MM-DD)
    const version = new Date().toISOString().split('T')[0];
    
    // Create Cashfree order
    const { data } = await PGCreateOrder(version, request);
    
    res.json({
      payment_link: data.payment_link,
      order_id: orderId
    });

  } catch (error) {
    console.error('Cashfree Error:', error.response?.data || error.message);
    res.status(500).json({
      error: error.response?.data?.message || 'Payment gateway error'
    });
  }
});

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
