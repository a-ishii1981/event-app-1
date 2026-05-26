const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const event = await pool.query('SELECT e.*, w.name as workspace_name, w.type as workspace_type FROM events e JOIN workspaces w ON e.workspace_id = w.id WHERE e.id = $1', [id]);
  if (!event.rows[0]) return res.redirect('/');
  const sales = await pool.query('SELECT * FROM sales WHERE event_id = $1 ORDER BY created_at', [id]);
  const expenses = await pool.query('SELECT * FROM expenses WHERE event_id = $1 ORDER BY created_at', [id]);
  const memo = await pool.query('SELECT * FROM memos WHERE event_id = $1', [id]);
  const totalSales = sales.rows.reduce((sum, s) => sum + s.subtotal, 0);
  const totalExpenses = expenses.rows.reduce((sum, e) => sum + e.amount, 0);
  const profit = totalSales - totalExpenses;
  res.render('events/detail', { event: event.rows[0], sales: sales.rows, expenses: expenses.rows, memo: memo.rows[0] || {}, totalSales, totalExpenses, profit });
});

router.get('/new/:workspaceId', (req, res) => {
  res.render('events/new', { workspaceId: req.params.workspaceId });
});

router.post('/', async (req, res) => {
  const { workspace_id, name, date, location } = req.body;
  const result = await pool.query('INSERT INTO events (workspace_id, name, date, location) VALUES ($1, $2, $3, $4) RETURNING id', [workspace_id, name, date, location]);
  res.redirect(`/events/${result.rows[0].id}`);
});

router.post('/:id/delete', async (req, res) => {
  const event = await pool.query('SELECT workspace_id FROM events WHERE id = $1', [req.params.id]);
  const wsId = event.rows[0]?.workspace_id;
  await pool.query('DELETE FROM events WHERE id = $1', [req.params.id]);
  res.redirect(`/workspaces/${wsId}/events`);
});

module.exports = router;
