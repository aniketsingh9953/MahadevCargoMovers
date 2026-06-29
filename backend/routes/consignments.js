// routes/consignments.js
const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { requireAuth } = require('./auth');

// All routes here require a valid login.
router.use(requireAuth);

const FIELDS = [
  'lr_no', 'lr_date', 'edd', 'booking_mode',
  'origin', 'destination',
  'consignor_name_address', 'consignor_gstin',
  'consignee_name_address', 'consignee_gstin',
  'vehicle_no', 'driver_name', 'driver_mobile', 'vehicle_type',
  'eway_bill_no', 'eway_validity', 'invoice_no', 'invoice_date', 'invoice_value',
  'insurance_detail',
  'pkgs_nos', 'packing_type', 'goods_description', 'actual_wt', 'charged_wt', 'customer_ref_no',
  'vehicle_in_time', 'vehicle_out_time', 'gst_payable_by', 'risk_type',
  'remarks',
];

// GET /api/consignments  — list all, newest first, optional search by ?q=
router.get('/', (req, res) => {
  const { q } = req.query;
  let rows;
  if (q) {
    const like = `%${q}%`;
    rows = db.prepare(`
      SELECT * FROM consignment_notes
      WHERE lr_no LIKE ? OR consignor_name_address LIKE ? OR consignee_name_address LIKE ?
         OR vehicle_no LIKE ? OR destination LIKE ? OR origin LIKE ?
      ORDER BY id DESC
    `).all(like, like, like, like, like, like);
  } else {
    rows = db.prepare('SELECT * FROM consignment_notes ORDER BY id DESC').all();
  }
  res.json(rows);
});

// GET /api/consignments/next-lr-no — suggests the next LR number
router.get('/next-lr-no', (req, res) => {
  const year = new Date().getFullYear();
  const prefix = `MCM/${year}/`;
  const last = db.prepare(`
    SELECT lr_no FROM consignment_notes WHERE lr_no LIKE ? ORDER BY id DESC LIMIT 1
  `).get(`${prefix}%`);

  let nextNum = 1;
  if (last && last.lr_no) {
    const parts = last.lr_no.split('/');
    const num = parseInt(parts[2], 10);
    if (!isNaN(num)) nextNum = num + 1;
  }
  const nextLrNo = `${prefix}${String(nextNum).padStart(4, '0')}`;
  res.json({ nextLrNo });
});

// GET /api/consignments/:id
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM consignment_notes WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Consignment note not found.' });
  res.json(row);
});

// POST /api/consignments  — create new
router.post('/', (req, res) => {
  const body = req.body;

  if (!body.lr_no || !body.lr_date) {
    return res.status(400).json({ error: 'LR No. and LR Date are required.' });
  }

  const existing = db.prepare('SELECT id FROM consignment_notes WHERE lr_no = ?').get(body.lr_no);
  if (existing) {
    return res.status(409).json({ error: `LR No. ${body.lr_no} already exists.` });
  }

  const columns = FIELDS.join(', ');
  const placeholders = FIELDS.map(() => '?').join(', ');
  const values = FIELDS.map((f) => body[f] ?? null);

  try {
    const result = db.prepare(
      `INSERT INTO consignment_notes (${columns}) VALUES (${placeholders})`
    ).run(...values);

    const created = db.prepare('SELECT * FROM consignment_notes WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not save the consignment note.' });
  }
});

// PUT /api/consignments/:id — update existing
router.put('/:id', (req, res) => {
  const body = req.body;
  const existing = db.prepare('SELECT * FROM consignment_notes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Consignment note not found.' });

  const setClause = FIELDS.map((f) => `${f} = ?`).join(', ');
  const values = FIELDS.map((f) => body[f] ?? null);

  db.prepare(
    `UPDATE consignment_notes SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).run(...values, req.params.id);

  const updated = db.prepare('SELECT * FROM consignment_notes WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/consignments/:id
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM consignment_notes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Consignment note not found.' });

  db.prepare('DELETE FROM consignment_notes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
