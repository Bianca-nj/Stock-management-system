# Stock Management System

A web-based stock management system for a minimarket that tracks products, sales, restocks, and stock levels with user authentication.

## Tech Stack
- Node.js
- MySQL (via XAMPP)
- HTML, CSS, JavaScript

## Features
- User authentication (login system)
- Product management (add, view, update products)
- Sales tracking with total price calculation
- Restock management
- Low stock threshold alerts
- Stock level monitoring
- Report generation

## Environment Variables
Create a `.env` file in the root folder with:
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=maguna_minimarket

## Setup
1. Clone the repo
2. Run `npm install`
3. Create a `.env` file (see Environment Variables above)
4. Start XAMPP and ensure MySQL is running
5. Create the database and tables in phpMyAdmin (see Database section below)
6. Run `node app.js`
7. Open `http://localhost:3000` in your browser

## Database
Uses a MySQL database named `maguna_minimarket` with the following tables:

### 1. users
Stores system users.
- id (Primary Key)
- username
- email
- password (hashed using bcrypt)

### 2. products
Stores product information.
- id (Primary Key)
- name
- quantity
- price

### 3. stock
Tracks stock levels and low stock thresholds per product.
- id (Primary Key)
- product_id (Foreign Key → products)
- low_stock_threshold
- updated_at

### 4. sales
Records sales transactions.
- id (Primary Key)
- product_id (Foreign Key → products)
- quantity_sold
- total_price
- sale_date

### 5. restocks
Records restock history.
- id (Primary Key)
- product_id (Foreign Key → products)
- quantity_added
- restock_date

### 6. reports
Stores generated reports.
- id (Primary Key)
- report_name
- report_data
- generated_at
