const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res) => {
  const workspaces = await pool.query('SELECT * FROM workspaces ORDER BY type DESC');
  res.render('home', { workspaces: workspaces.rows });
});

module.exports = router;
