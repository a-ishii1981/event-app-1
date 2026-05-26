const express = require('express');
const router = express.Router();
const pool = require('../db');

router.post('/', async (req, res) => {
  const { event_id, product_name, quantity, unit_price } = req.body;
  await pool.query('INSERT INTO sales (event_id, product_name, quantity, unit_price) VALUES ($1, $2, $3, $4)', [event_id, product_name, parseInt(quantity), parseInt(unit_price)]);
  res.redirect(`/events/${event_id}`);
});

router.post('/:id/delete', async (req, res) => {
  const sale = await pool.query('SELECT event_id FROM sales WHERE id = $1', [req.params.id]);
  const eventId = sale.rows[0]?.event_id;
  await pool.query('DELETE FROM sales WHERE id = $1', [req.params.id]);
  res.redirect(`/events/${eventId}`);
});

module.exports = router;
