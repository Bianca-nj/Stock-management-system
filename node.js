const mysql = require('mysql2/promise');
const cors = require('cors');
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = 3002;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_in_production';

app.use(cors());
app.use(express.static(path.join(__dirname, 'new')));
app.use(express.json());

// DATABASE CONNECTION 
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'maguna_minimarket',
    port: 3306
});

// Test connection on startup
(async () => {
    try {
        await db.query('SELECT 1');
        console.log('Connected to the database!');
    } catch (err) {
        console.error('Error connecting to the database:', err);
    }
})();

//JWT MIDDLEWARE 
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>
    if (!token) return res.status(401).json({ message: 'Access denied. No token provided.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
}



// SIGNUP
app.post('/signup', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password)
        return res.status(400).json({ message: 'Please fill in all fields' });

    try {
        // Check if username or email already exists
        const [existing] = await db.query(
            'SELECT id FROM users WHERE username = ? OR email = ?', [username, email]
        );
        if (existing.length > 0)
            return res.status(409).json({ message: 'Username or email already taken' });

        // Hash password before saving
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.query(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [username, email, hashedPassword]
        );

        res.status(201).json({ message: 'User registered successfully' });
    } catch (err) {
        console.error('Signup error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// LOGIN
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password)
        return res.status(400).json({ message: 'Please provide both username and password' });

    try {
        const [results] = await db.query(
            'SELECT * FROM users WHERE username = ?', [username]
        );

        if (results.length === 0)
            return res.status(401).json({ message: 'Invalid username or password' });

        const user = results[0];

        // Compare entered password with stored hash
        const match = await bcrypt.compare(password, user.password);
        if (!match)
            return res.status(401).json({ message: 'Invalid username or password' });

        // Sign JWT token
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '1h' });

        res.status(200).json({ message: 'Login successful', username: user.username, token });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// FORGOT PASSWORD
app.post('/forgot-password', async (req, res) => {
    const { email } = req.body;

    try {
        const [results] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

        if (results.length === 0)
            return res.status(404).json({ message: 'Email not found' });

        const resetCode = crypto.randomBytes(4).toString('hex'); 
        await db.query(
            `UPDATE users SET reset_code = ?, reset_code_expires = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE email = ?`,
            [resetCode, email]
        );

        console.log(`Reset code for ${email}: ${resetCode}`); 
        res.json({ message: 'A reset code has been sent to your email.' });
    } catch (err) {
        console.error('Forgot password error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});


// Get all products (single route, fixed duplicate)
app.get('/products', authenticateToken, async (req, res) => {
    try {
        const [results] = await db.query('SELECT * FROM products');
        res.json(results);
    } catch (err) {
        console.error('Error fetching products:', err.message);
        res.status(500).json({ message: 'Error fetching products' });
    }
});

// Add product
app.post('/add-product', authenticateToken, async (req, res) => {
    const { name, quantity, price } = req.body;
    try {
        await db.query(
            'INSERT INTO products (name, quantity, price) VALUES (?, ?, ?)',
            [name, quantity, price]
        );
        res.json({ message: 'Product added successfully' });
    } catch (err) {
        console.error('Error adding product:', err.message);
        res.status(500).json({ message: 'Error adding product' });
    }
});

// Update product
app.put('/update-product/:id', authenticateToken, async (req, res) => {
    const { name, price } = req.body; // quantity no longer updated here
    const { id } = req.params;
    try {
        await db.query(
            'UPDATE products SET name = ?, price = ? WHERE id = ?',
            [name, price, id]
        );
        res.json({ message: 'Product updated successfully' });
    } catch (err) {
        console.error('Error updating product:', err.message);
        res.status(500).json({ message: 'Error updating product' });
    }
});

// Delete product
app.delete('/delete-product/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await db.query('DELETE FROM products WHERE id = ?', [id]);
        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        console.error('Error deleting product:', err.message);
        res.status(500).json({ message: 'Error deleting product' });
    }
});

// Restock a product
app.post('/restock', authenticateToken, async (req, res) => {
    const { product_id, quantity_added } = req.body;
 
    if (!product_id || !quantity_added || quantity_added <= 0)
        return res.status(400).json({ message: 'Please provide a valid product and quantity' });
 
    try {
        // Get current product
        const [products] = await db.query('SELECT * FROM products WHERE id = ?', [product_id]);
        if (products.length === 0)
            return res.status(404).json({ message: 'Product not found' });
 
        const newQuantity = products[0].quantity + parseInt(quantity_added);
 
        // Update product quantity
        await db.query(
            'UPDATE products SET quantity = ? WHERE id = ?',
            [newQuantity, product_id]
        );
 
        // Log restock in restocks table
        await db.query(
            'INSERT INTO restocks (product_id, quantity_added, restock_date) VALUES (?, ?, NOW())',
            [product_id, quantity_added]
        );
 
        res.status(200).json({
            message: 'Product restocked successfully',
            new_quantity: newQuantity
        });
    } catch (err) {
        console.error('Restock error:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});
 
// Get all restocks (for reports later)
app.get('/restocks', authenticateToken, async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT r.*, p.name AS product_name
            FROM restocks r
            JOIN products p ON r.product_id = p.id
            ORDER BY r.restock_date DESC
        `);
        res.json(results);
    } catch (err) {
        console.error('Error fetching restocks:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// Add sale - AUTOMATICALLY CALCULATE SALE AMOUNT
app.post('/add-sale', authenticateToken, async (req, res) => {
    const { product_id, quantity_sold } = req.body; 

    if (!product_id || !quantity_sold) {
        return res.status(400).json({ message: 'Please provide product and quantity' });
    }

    try {
        // Get product details including price
        const [products] = await db.query(
            'SELECT * FROM products WHERE id = ?', [product_id]
        );

        if (products.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const product = products[0];
        
        // Calculate total sale amount based on product price
        const total_price = parseFloat(product.price) * parseInt(quantity_sold);
        
        // Check if enough stock
        const newQuantity = product.quantity - quantity_sold;
        if (newQuantity < 0) {
            return res.status(400).json({ 
                message: `Not enough stock! Only ${product.quantity} units available.` 
            });
        }

        // Insert sale record with calculated total_price
        await db.query(
            'INSERT INTO sales (product_id, quantity_sold, total_price, sale_date) VALUES (?, ?, ?, NOW())',
            [product_id, quantity_sold, total_price]
        );

        // Update product quantity
        await db.query(
            'UPDATE products SET quantity = ? WHERE id = ?',
            [newQuantity, product_id]
        );

        res.status(200).json({ 
            message: 'Sale recorded successfully!',
            total_amount: total_price,
            remaining_stock: newQuantity
        });
        
    } catch (err) {
        console.error('Error recording sale:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get all sales - WITH PRODUCT NAME JOIN
app.get('/sales', authenticateToken, async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT s.*, p.name as product_name, p.price as unit_price 
            FROM sales s
            JOIN products p ON s.product_id = p.id
            ORDER BY s.sale_date DESC
        `);
        res.json(results);
    } catch (err) {
        console.error('Error fetching sales:', err.message);
        res.status(500).json({ message: 'Error fetching sales' });
    }
});

// Get stock
app.get('/stock', authenticateToken, async (req, res) => {
    try {
        const [results] = await db.query(`
            SELECT s.low_stock_threshold, s.updated_at, p.name AS product_name,
                   p.quantity AS quantity_in_stock
            FROM stock s
            JOIN products p ON s.product_id = p.id
        `);
        res.json(results);
    } catch (err) {
        console.error('Error fetching stock:', err.message);
        res.status(500).json({ message: 'Database error' });
    }
});

// Add or update stock threshold
app.post('/add-update-stock-threshold', authenticateToken, async (req, res) => {
    const { product_id, low_stock_threshold } = req.body;
    const updated_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

    try {
        const [results] = await db.query(
            'SELECT * FROM stock WHERE product_id = ?', [product_id]  
        );

        if (results.length > 0) {
            await db.query(
                'UPDATE stock SET low_stock_threshold = ?, updated_at = ? WHERE product_id = ?',
                [low_stock_threshold, updated_at, product_id]
            );
            res.json({ message: 'Stock threshold updated successfully' });
        } else {
            await db.query(
                'INSERT INTO stock (product_id, low_stock_threshold, updated_at) VALUES (?, ?, ?)',
                [product_id, low_stock_threshold, updated_at]
            );
            res.json({ message: 'Stock threshold added successfully' });
        }
    } catch (err) {
        console.error('Error updating stock:', err.message);
        res.status(500).json({ message: 'Database error' });
    }
});

//REPORT
// ── Replace your existing report routes in server.js with these ──────────────

// Get sales for a date range
app.get('/report-sales', authenticateToken, async (req, res) => {
    const { start, end } = req.query;
    if (!start || !end)
        return res.status(400).json({ message: 'Please provide start and end dates' });
    try {
        const [results] = await db.query(`
            SELECT s.*, p.name AS product_name, p.price AS unit_price
            FROM sales s
            JOIN products p ON s.product_id = p.id
            WHERE DATE(s.sale_date) BETWEEN ? AND ?
            ORDER BY s.sale_date DESC
        `, [start, end]);
        res.json(results);
    } catch (err) {
        console.error('Error fetching report sales:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get restocks for a date range
app.get('/report-restocks', authenticateToken, async (req, res) => {
    const { start, end } = req.query;
    if (!start || !end)
        return res.status(400).json({ message: 'Please provide start and end dates' });
    try {
        const [results] = await db.query(`
            SELECT r.*, p.name AS product_name
            FROM restocks r
            JOIN products p ON r.product_id = p.id
            WHERE DATE(r.restock_date) BETWEEN ? AND ?
            ORDER BY r.restock_date DESC
        `, [start, end]);
        res.json(results);
    } catch (err) {
        console.error('Error fetching report restocks:', err.message);
        res.status(500).json({ message: 'Server error' });
    }
});

// Download report as PDF with date range
app.get('/download-report', async (req, res) => {
    const { start, end, token } = req.query;

    if (!token) return res.status(401).json({ message: 'No token provided' });
    try { jwt.verify(token, JWT_SECRET); }
    catch { return res.status(403).json({ message: 'Invalid token' }); }

    if (!start || !end)
        return res.status(400).json({ message: 'Please provide start and end dates' });

    try {
        const [sales] = await db.query(`
            SELECT s.*, p.name AS product_name, p.price AS unit_price
            FROM sales s JOIN products p ON s.product_id = p.id
            WHERE DATE(s.sale_date) BETWEEN ? AND ?
            ORDER BY s.sale_date DESC
        `, [start, end]);

        const [restocks] = await db.query(`
            SELECT r.*, p.name AS product_name
            FROM restocks r JOIN products p ON r.product_id = p.id
            WHERE DATE(r.restock_date) BETWEEN ? AND ?
            ORDER BY r.restock_date DESC
        `, [start, end]);

        const [lowStock] = await db.query(`
            SELECT p.name AS product_name, p.quantity AS quantity_in_stock, s.low_stock_threshold
            FROM products p JOIN stock s ON p.id = s.product_id
            WHERE p.quantity <= s.low_stock_threshold
        `);

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=report_${start}_to_${end}.pdf`);
        doc.pipe(res);

        const L = 40;   // left margin
        const W = 515;  // usable width
        const ROW_H = 18;

        // Draw a full-width horizontal line
        function hline(y, color = '#dddddd') {
            doc.moveTo(L, y).lineTo(L + W, y).strokeColor(color).lineWidth(0.5).stroke();
        }

        // Draw one table row — cols = [{ text, x, width, align }]
        // Returns the new y after the row
        function drawRow(y, cols, font = 'Helvetica', fontSize = 9, color = '#333333') {
            doc.font(font).fontSize(fontSize).fillColor(color);
            cols.forEach(col => {
                const txt = String(col.text ?? '').substring(0, col.maxLen || 40);
                doc.text(txt, col.x, y, { width: col.width || 150, align: col.align || 'left', lineBreak: false });
            });
            return y + ROW_H;
        }

        // Draw a section heading — always on its own line at x=L
        function sectionHeading(label) {
            doc.moveDown(0.8);
            const y = doc.y;
            doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000').text(label, L, y);
            doc.moveDown(0.3);
            hline(doc.y);
            doc.y = doc.y + 6;
        }

        // ── TITLE ──────────────────────────────────────────────
        doc.font('Helvetica-Bold').fontSize(18).fillColor('#000000')
           .text('Maguna Minimarket Report', L, 40, { width: W, align: 'center' });
        doc.font('Helvetica').fontSize(10).fillColor('#555555')
           .text(`Period: ${start}  to  ${end}`, L, doc.y + 4, { width: W, align: 'center' });

        // ── SUMMARY ────────────────────────────────────────────
        const totalRevenue = sales.reduce((s, r) => s + parseFloat(r.total_price), 0);
        const totalUnits   = sales.reduce((s, r) => s + parseInt(r.quantity_sold), 0);

        sectionHeading('Summary');
        let y = doc.y;
        doc.font('Helvetica').fontSize(10).fillColor('#333333');
        doc.text(`Total Revenue:       KSh ${totalRevenue.toFixed(2)}`, L, y);
        y += 16;
        doc.text(`Total Units Sold:    ${totalUnits}`, L, y);
        y += 16;
        doc.text(`Total Transactions:  ${sales.length}`, L, y);
        doc.y = y + 16;

        // ── SALES SUMMARY ──────────────────────────────────────
        sectionHeading('Sales Summary');

        if (sales.length === 0) {
            doc.font('Helvetica').fontSize(10).fillColor('#888').text('No sales in this period.', L, doc.y);
            doc.moveDown(0.5);
        } else {
            // Column definitions
            const salesCols = [
                { x: L,   width: 160, label: 'Product'    },
                { x: 210, width: 40,  label: 'Qty'        },
                { x: 265, width: 90,  label: 'Unit Price' },
                { x: 365, width: 90,  label: 'Total'      },
                { x: 460, width: 90,  label: 'Date'       },
            ];

            // Header
            y = doc.y;
            y = drawRow(y, salesCols.map(c => ({ text: c.label, x: c.x, width: c.width })), 'Helvetica-Bold', 9, '#000');
            y += 2;
            hline(y);
            y += 6;

            // Data rows
            sales.forEach(s => {
                y = drawRow(y, [
                    { text: s.product_name,                                    x: L,   width: 160 },
                    { text: s.quantity_sold,                                   x: 210, width: 40  },
                    { text: `KSh ${parseFloat(s.unit_price).toFixed(2)}`,     x: 265, width: 90  },
                    { text: `KSh ${parseFloat(s.total_price).toFixed(2)}`,    x: 365, width: 90  },
                    { text: new Date(s.sale_date).toLocaleDateString('en-KE'), x: 460, width: 90  },
                ]);
            });
            doc.y = y + 6;
        }

        // ── RESTOCK HISTORY ────────────────────────────────────
        sectionHeading('Restock History');

        if (restocks.length === 0) {
            doc.font('Helvetica').fontSize(10).fillColor('#888').text('No restocks in this period.', L, doc.y);
            doc.moveDown(0.5);
        } else {
            const restockCols = [
                { x: L,   width: 250, label: 'Product'     },
                { x: 300, width: 100, label: 'Units Added'  },
                { x: 420, width: 100, label: 'Date'         },
            ];

            y = doc.y;
            y = drawRow(y, restockCols.map(c => ({ text: c.label, x: c.x, width: c.width })), 'Helvetica-Bold', 9, '#000');
            y += 2; hline(y); y += 6;

            restocks.forEach(r => {
                y = drawRow(y, [
                    { text: r.product_name,                                        x: L,   width: 250 },
                    { text: `+${r.quantity_added}`,                                x: 300, width: 100 },
                    { text: new Date(r.restock_date).toLocaleDateString('en-KE'),  x: 420, width: 100 },
                ]);
            });
            doc.y = y + 6;
        }

        // ── LOW STOCK ──────────────────────────────────────────
        sectionHeading('Current Low Stock Alerts');

        if (lowStock.length === 0) {
            doc.font('Helvetica').fontSize(10).fillColor('#888').text('All products are well stocked.', L, doc.y);
        } else {
            const stockCols = [
                { x: L,   width: 250, label: 'Product'   },
                { x: 300, width: 100, label: 'In Stock'  },
                { x: 420, width: 100, label: 'Threshold' },
            ];

            y = doc.y;
            y = drawRow(y, stockCols.map(c => ({ text: c.label, x: c.x, width: c.width })), 'Helvetica-Bold', 9, '#000');
            y += 2; hline(y); y += 6;

            lowStock.forEach(p => {
                y = drawRow(y, [
                    { text: p.product_name,        x: L,   width: 250 },
                    { text: p.quantity_in_stock,   x: 300, width: 100 },
                    { text: p.low_stock_threshold, x: 420, width: 100 },
                ]);
            });
            doc.y = y + 6;
        }

        doc.end();

    } catch (err) {
        console.error('Error generating PDF:', err.message);
        res.status(500).json({ message: 'Error generating report' });
    }
});
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));