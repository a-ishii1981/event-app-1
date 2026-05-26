const express = require('express');
const router = express.Router();
const pool = require('../db');

router.post('/', async (req, res) => {
  const { event_id, description, amount, category } = req.body;
  await pool.query('INSERT INTO expenses (event_id, description, amount, category) VALUES ($1, $2, $3, $4)', [event_id, description, parseInt(amount), category || null]);
  res.redirect(`/events/${event_id}`);
});

router.post('/:id/delete', async (req, res) => {
  const exp = await pool.query('SELECT event_id FROM expenses WHERE id = $1', [req.params.id]);
  const eventId = exp.rows[0]?.event_id;
  await pool.query('DELETE FROM expenses WHERE id = $1', [req.params.id]);
  res.redirect(`/events/${eventId}`);
});

module.exports = router;
