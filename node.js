const mysql = require ('mysql');
const cors = require('cors');  // Importing CORS
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

// Create an express app
const app = express();
const PORT = 3002;

// Allow CORS for all origins (can be restricted in production)
app.use(cors());  // Enables CORS for all origins

// Static files and body parsing setup
app.use(express.static(path.join(__dirname, 'new')));
app.use(express.json());
app.use(bodyParser.json());
;

// MySQL connection configuration
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'bianca',
    database: 'maguna_minimarket',
    port: 3307 // Correct port for MySQL
});

// Connect to the database
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to the database:', err);
        return;
    }
    console.log('Connected to the database!');
});

// Listen on specified port
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

// Route to handle sign-up form submission
app.post('/signup', (req, res) => {
  const { username, email, password } = req.body;

  // Check if all required fields are filled
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Please fill in all fields' });
  }

  // Insert user details into the database
  const query = 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)';
  connection.query(query, [username, email, password], (err, results) => {
    if (err) {
      console.error('Error saving user details:', err.message);
      return res.status(500).json({ message: 'Server Error' });
    }
    console.log('User registered successfully:', results);
    res.status(200).json({ message: 'User registered successfully' });
  });
});

// Route to handle user login
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // Check if all required fields are filled
  if (!username || !password) {
    return res.status(400).json({ message: 'Please provide both username and password' });
  }

  // Query to check if the user exists in the database
  const query = 'SELECT * FROM users WHERE username = ? AND password = ?';
  connection.query(query, [username, password], (err, results) => {
    if (err) {
      console.error('Error checking user details:', err.message);
      return res.status(500).json({ message: 'Server Error' });
    }

    if (results.length > 0) {
      // User found
      console.log('User logged in successfully:', results);
      res.status(200).json({ message: 'Login successful' });
    } else {
      // User not found
      res.status(401).json({ message: 'Invalid username or password' });
    }
  });
});

const crypto = require('crypto'); // For generating a unique reset code

// Forgot Password Endpoint
app.post('/forgot-password', (req, res) => {
    const { email } = req.body;

    const query = 'SELECT * FROM users WHERE email = ?';
    connection.query(query, [email], (err, results) => {
        if (err) {
            console.error('Error querying database:', err.message);
            return res.status(500).json({ message: 'Database error' });
        }

        if (results.length > 0) {
            // Generate a reset code
            const resetCode = crypto.randomBytes(4).toString('hex'); // Generates a 8-character code
            const updateQuery = `
                UPDATE users SET reset_code = ?, reset_code_expires = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE email = ?
            `;
            connection.query(updateQuery, [resetCode, email], (err) => {
                if (err) {
                    console.error('Error updating reset code:', err.message);
                    return res.status(500).json({ message: 'Database error' });
                }

                console.log(`Reset code for ${email}: ${resetCode}`); // Log reset code (replace this with email sending)
                res.json({ message: 'A reset code has been sent to your email.' });
            });
        } else {
            res.status(404).json({ message: 'Email not found' });
        }
    });
});

// Add Product
app.post('/add-product', (req, res) => {
  const { product_name, quantity, price } = req.body;
  const sql = 'INSERT INTO maguna_minimarket_products (product_name, quantity, price) VALUES (?, ?, ?)';
  connection.query(sql, [product_name, quantity, price], (err) => {
    if (err) return res.status(500).json({ message: 'Error adding product' });
    res.json({ message: 'Product added successfully' });
  });
});



// Get All Products
app.get('/products', (req, res) => {
  const sql = 'SELECT * FROM maguna_minimarket_products';
  connection.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: 'Error fetching products' });
    res.json(results);
  });
});

// Update Product
app.put('/update-product/:id', (req, res) => {
  const { product_name, quantity, price } = req.body;
  const { id } = req.params;
  const sql = 'UPDATE maguna_minimarket_products SET product_name = ?, quantity = ?, price = ? WHERE id = ?';
  connection.query(sql, [product_name, quantity, price, id], (err) => {
    if (err) return res.status(500).json({ message: 'Error updating product' });
    res.json({ message: 'Product updated successfully' });
  });
});


// Delete Product
app.delete('/delete-product/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM maguna_minimarket_products WHERE id = ?';
  connection.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ message: 'Error deleting product' });
    res.json({ message: 'Product deleted successfully' });
  });
});

// Add Sale (Endpoint to insert sale and update product quantity)
app.post('/add-sale', (req, res) => {
  const { product_id, quantity_sold, sale_amount, product_name } = req.body;

  // Check if the sale data is provided
  if (!product_id || !quantity_sold || !sale_amount || !product_name) {
      return res.status(400).json({ message: 'Please provide all fields' });
  }

  // Check if the product exists and fetch its current quantity
  const getProductQuery = 'SELECT * FROM maguna_minimarket_products WHERE id = ?';
  connection.query(getProductQuery, [product_id], (err, results) => {
      if (err) return res.status(500).json({ message: 'Error fetching product data' });
      if (results.length === 0) return res.status(404).json({ message: 'Product not found' });

      const product = results[0];
      const newQuantity = product.quantity - quantity_sold;

      if (newQuantity < 0) {
          return res.status(400).json({ message: 'Not enough stock for this sale' });
      }

      // Insert sale into the sales table, including product_name
      const insertSaleQuery = 'INSERT INTO maguna_minimarket_sales (product_id, quantity_sold, sale_amount, sale_date, product_name) VALUES (?, ?, ?, NOW(), ?)';
      connection.query(insertSaleQuery, [product_id, quantity_sold, sale_amount, product_name], (err) => {
          if (err) return res.status(500).json({ message: 'Error recording sale' });

          // Update the product quantity after sale
          const updateProductQuery = 'UPDATE maguna_minimarket_products SET quantity = ? WHERE id = ?';
          connection.query(updateProductQuery, [newQuantity, product_id], (err) => {
              if (err) return res.status(500).json({ message: 'Error updating product quantity' });
              res.status(200).json({ message: 'Sale recorded and product quantity updated' });
          });
      });
  });
});

// Get All Products (To populate the product dropdown)
app.get('/products', (req, res) => {
  const sql = 'SELECT id, product_name FROM maguna_minimarket_products';
  connection.query(sql, (err, results) => {
      if (err) return res.status(500).json({ message: 'Error fetching products' });
      res.json(results);
  });
});

// Get All Sales (To view the sales records)
app.get('/sales', (req, res) => {
  const sql = 'SELECT * FROM maguna_minimarket_sales';
  connection.query(sql, (err, results) => {
      if (err) return res.status(500).json({ message: 'Error fetching sales' });
      res.json(results);
  });
});

//STOCK MANAGEMENT
// Fetch all products for the dropdown
app.get('/products', (req, res) => {
  const query = 'SELECT id, product_name FROM products'; // Ensure you have a products table
  connection.query(query, (err, results) => {
      if (err) {
          console.error('Error fetching products:', err.message);
          return res.status(500).json({ message: 'Database error' });
      }
      res.json(results);
  });
});

// Fetch stock data with product name for display
app.get('/stock', (req, res) => {
  const query = `
    SELECT  s.low_stock_threshold, s.updated_at, p.product_name,
    p.quantity AS quantity_in_stock
    FROM maguna_minimarket_stock s
    JOIN maguna_minimarket_products p ON s.product_id = p.id
  `;
  connection.query(query, (err, results) => {
      if (err) {
          console.error('Error fetching stock:', err.message);
          return res.status(500).json({ message: 'Database error' });
      }
      res.json(results);
  });
});

// Add or update stock threshold
app.post('/add-update-stock-threshold', (req, res) => {
  const { product_id, low_stock_threshold } = req.body;
  const updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const checkProductQuery = 'SELECT * FROM maguna_minimarket_stock WHERE product_id = ?';
  connection.query(checkProductQuery, [product_id], (err, results) => {
      if (err) {
          console.error('Error querying database:', err.message);
          return res.status(500).json({ message: 'Database error' });
      }
      if (results.length > 0) {
          const updateQuery = `
              UPDATE maguna_minimarket_stock 
              SET low_stock_threshold = ?, updated_at = ? 
              WHERE product_id = ?
          `;
          connection.query(updateQuery, [low_stock_threshold, updated_at, product_id], (err) => {
              if (err) {
                  console.error('Error updating stock:', err.message);
                  return res.status(500).json({ message: 'Database error' });
              }
              res.json({ message: 'Stock threshold updated successfully' });
          });
      } else {
          const insertQuery = `
              INSERT INTO maguna_minimarket_stock (product_id, low_stock_threshold, updated_at) 
              VALUES (?, ?, ?)
          `;
          connection.query(insertQuery, [product_id, low_stock_threshold, updated_at], (err) => {
              if (err) {
                  console.error('Error inserting stock:', err.message);
                  return res.status(500).json({ message: 'Database error' });
              }
              res.json({ message: 'Stock threshold added successfully' });
          });
      }
  });
});


//REPORT
// Endpoint to generate the report
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

app.get('/generate-report', (req, res) => {
  const query = `
      SELECT p.product_name, 
       SUM(s.quantity_sold) AS quantity_sold,
       SUM(s.quantity_sold * p.price) AS total_sale,
       p.quantity AS total_products  -- Shows current stock quantity
FROM maguna_minimarket_sales s
JOIN maguna_minimarket_products p ON s.product_id = p.id
GROUP BY p.product_name, p.quantity;

  `;

  connection.query(query, (err, results) => {
      if (err) {
          console.error('Error fetching report data:', err);
          return res.status(500).json({ message: 'Error fetching report data' });
      }

      // Send the report data as JSON
      res.json({ report_data: results });
  });
});

// Endpoint to download the report as CSV
app.get('/download-report', (req, res) => {
  const query = `
     SELECT p.product_name, 
       SUM(s.quantity_sold) AS quantity_sold,
       SUM(s.quantity_sold * p.price) AS total_sale,
       p.quantity AS total_products  -- Shows current stock quantity
FROM maguna_minimarket_sales s
JOIN maguna_minimarket_products p ON s.product_id = p.id
GROUP BY p.product_name, p.quantity;

  `;

  connection.query(query, (err, results) => {
      if (err) {
          console.error('Error fetching report data:', err);
          return res.status(500).json({ message: 'Error fetching report data' });
      }

      // Create a PDF document
      const doc = new PDFDocument();
      
      // Set headers for the PDF file
      doc.fontSize(18).text('Sales Report', { align: 'center' });
      doc.moveDown();

      // Add table headers
      doc.fontSize(12).text('Product Name'.padEnd(30) + 'Quantity Sold'.padEnd(15) + 'Total Sale'.padEnd(15) + 'Total Products');
      doc.moveDown();
      
      // Add the report data to the PDF
      results.forEach(row => {
        doc.text(
          row.product_name.padEnd(30) +
          row.quantity_sold.toString().padEnd(15) +
          row.total_sale.toFixed(2).padEnd(15) +
          row.total_products.toString()
        );
      });

      // Finalize the PDF document and send it as a download
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=sales_report.pdf');
      doc.pipe(res);  // Pipe the PDF output to the response
      doc.end();  // End the document creation
  });
});

//OVERVIEW
// Enable CORS for testing or if frontend and backend are on different domains
app.use(cors());

// API route to fetch overview data
app.get('/overview', (req, res) => {
    const overviewData = {};

    // Get total products
    db.query('SELECT COUNT(*) AS total_products FROM manguna_minimarket_products', (err, results) => {
        if (err) throw err;
        overviewData.total_products = results[0].total_products;

        // Get low stock products (assuming a threshold of 10 for low stock)
        db.query('SELECT COUNT(*) AS low_stock FROM maguna_minimarket_products WHERE stock_quantity < 10', (err, results) => {
            if (err) throw err;
            overviewData.low_stock = results[0].low_stock;

            // Get today's sales (assuming sales are recorded in a sales table)
            db.query("SELECT SUM(sale_amount) AS sales_today FROM maguna_minimarket_sales WHERE DATE(sale_date) = CURDATE()", (err, results) => {
                if (err) throw err;
                overviewData.sales_today = results[0].sales_today || 0; // Default to 0 if no sales today

                // Send the complete overview data as JSON
                res.json(overviewData);
            });
        });
    });
});