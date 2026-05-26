const express = require('express');
const router = express.Router();
const pool = require('../db');

router.post('/', async (req, res) => {
  const { event_id, customer_reaction, faq, pop_feedback, next_improvement } = req.body;
  await pool.query(`INSERT INTO memos (event_id, customer_reaction, faq, pop_feedback, next_improvement) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (event_id) DO UPDATE SET customer_reaction = $2, faq = $3, pop_feedback = $4, next_improvement = $5, updated_at = NOW()`, [event_id, customer_reaction, faq, pop_feedback, next_improvement]);
  res.redirect(`/events/${event_id}`);
});

module.exports = router;
