const db = require('./db');

// Test query to check the connection
db.query('SELECT NOW() AS currentTime', (err, results) => {
  if (err) {
    console.error('Query error:', err.message);
    return;
  }
  console.log('Current Time:', results[0].currentTime);
});

db.connect((err) => {
  if (err) {
    console.error('Database connection failed:', err.message);
    return;
  }
  console.log('Connected to the MySQL database');
});
