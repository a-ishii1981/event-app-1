require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.use((req, res, next) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); next(); });
app.set('views', './views');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'event-app-secret',
  resave: false,
  saveUninitialized: true
}));

async function initDB() {
  const fs = require('fs');
  const schema = fs.readFileSync('./db/schema.sql', 'utf8');
  await pool.query(schema);
  console.log('DB initialized');
}

app.use('/', require('./routes/index'));
app.use('/workspaces', require('./routes/workspaces'));
app.use('/events', require('./routes/events'));
app.use('/sales', require('./routes/sales'));
app.use('/expenses', require('./routes/expenses'));
app.use('/memos', require('./routes/memos'));

app.listen(PORT, async () => {
  await initDB();
  console.log(`Server running on port ${PORT}`);
});
