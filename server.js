const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

app.use(cors()); // So frontend can access backend

app.use(express.json());

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
app.get('/api/products/featured', (req, res) => {
    const query = 'SELECT * FROM products WHERE is_featured = 1';
    db.query(query, (err, results) => {
      if (err) {
        console.error('DB Error:', err);
        return res.status(500).json({ error: err });
      }
      res.json(results);
    });
  });
  app.post('/admin/products/add', (req, res) => {
    const { name, price, description } = req.body;
    // You can add more fields like image URL, variant, etc., here
    const query = 'INSERT INTO products (name, price, description) VALUES (?, ?, ?)';
    db.query(query, [name, price, description], (err, result) => {
        if (err) {
            return res.status(500).json({ error: err.message });
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
  
app.post('/admin/products/update/:id', (req, res) => {
    const { id } = req.params;
    const { name, quantity, variant, rating, original_price, current_price } = req.body;

    const query = `
      UPDATE products
      SET name = ?, quantity = ?, variant = ?, rating = ?, original_price = ?, current_price = ?
      WHERE id = ?
    `;
    db.query(query, [name, quantity, variant, rating, original_price, current_price, id], (err, result) => {
      if (err) {
        console.error("Error updating product:", err);
        return res.status(500).send('Error updating product');
      }
      res.send('Product updated successfully');
    });
});


// Get all products
app.get('/api/products', (req, res) => {
    db.query('SELECT * FROM products', (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    });
  });
  app.post('/admin/products/update/:id', (req, res) => {
    const { id } = req.params;
    const { name, quantity, variant, rating, original_price, current_price } = req.body;
  
    const query = `
      UPDATE products
      SET name = ?, quantity = ?, variant = ?, rating = ?, original_price = ?, current_price = ?
      WHERE id = ?
    `;
    db.query(query, [name, quantity, variant, rating, original_price, current_price, id], (err, result) => {
      if (err) return res.status(500).send('Error updating product');
      res.send('OK');
    });
  });
    

const PORT = 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
