const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/:id/events', async (req, res) => {
  const { id } = req.params;
  const workspace = await pool.query('SELECT * FROM workspaces WHERE id = $1', [id]);
  const events = await pool.query('SELECT * FROM events WHERE workspace_id = $1 ORDER BY date DESC', [id]);
  if (!workspace.rows[0]) return res.redirect('/');
  res.render('events/index', { workspace: workspace.rows[0], events: events.rows });
});

router.post('/', async (req, res) => {
  const { name, type } = req.body;
  await pool.query('INSERT INTO workspaces (name, type) VALUES ($1, $2)', [name, type]);
  res.redirect('/');
});

router.post('/:id/delete', async (req, res) => {
  await pool.query('DELETE FROM workspaces WHERE id = $1', [req.params.id]);
  res.redirect('/');
});

module.exports = router;
