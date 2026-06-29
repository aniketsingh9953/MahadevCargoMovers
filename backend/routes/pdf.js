// routes/pdf.js
const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const db = require('../db/connection');
const { requireAuth } = require('./auth');

router.use(requireAuth);

const PAGE_WIDTH = 595.28; // A4 in points
const MARGIN = 36;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function fmtDate(d) {
  if (!d) return '-';
  // Accepts 'YYYY-MM-DD' (from <input type="date">) and converts to DD-MM-YYYY.
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return d;
}

function fmtDateTime(d) {
  if (!d) return '-';
  // Accepts 'YYYY-MM-DDTHH:mm' (from <input type="datetime-local">) and converts to DD-MM-YYYY HH:mm.
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]} ${m[4]}:${m[5]}`;
  return d;
}

function drawSectionHeader(doc, y, label) {
  doc
    .rect(MARGIN, y, CONTENT_WIDTH, 16)
    .fillAndStroke('#0F1C2E', '#0F1C2E');
  doc
    .fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(label, MARGIN + 6, y + 4, { characterSpacing: 0.5 });
  doc.fillColor('#1A1A1A');
  return y + 16;
}

function labelValue(doc, x, y, label, value, width) {
  doc.font('Helvetica').fontSize(6.5).fillColor('#5C6B7A').text(label.toUpperCase(), x, y, { width });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#1A1A1A').text(value || '-', x, y + 9, { width });
}

// GET /api/pdf/:id — stream a generated PDF for one consignment note
router.get('/:id', (req, res) => {
  const c = db.prepare('SELECT * FROM consignment_notes WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Consignment note not found.' });

  const doc = new PDFDocument({ size: 'A4', margin: MARGIN });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="LR_${c.lr_no.replace(/\//g, '-')}.pdf"`);
  doc.pipe(res);

  let y = MARGIN;

  // ----- Header / Company block -----
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#0F1C2E')
    .text('MAHADEV CARGO MOVERS', MARGIN, y);
  y += 20;
  doc.font('Helvetica').fontSize(8).fillColor('#5C6B7A')
    .text('Fleet Owner | Transport Contractor | Commission Agent', MARGIN, y);
  y += 11;
  doc.text('Zamar Kotda Road, Near Kalika Resort, Umarda, Udaipur - 313003', MARGIN, y);
  y += 10;
  doc.text('Mob: 8209490565 / 7015741767  |  Email: mahadevcargomovers@gmail.com', MARGIN, y);
  y += 10;
  doc.text('GSTIN: 08CLXPS2117L1ZC   |   PAN: CLKPS2117L', MARGIN, y);
  y += 14;

  // Title bar
  doc.rect(MARGIN, y, CONTENT_WIDTH, 18).fillAndStroke('#E8A33D', '#E8A33D');
  doc.fillColor('#0F1C2E').font('Helvetica-Bold').fontSize(11)
    .text('CONSIGNMENT NOTE', MARGIN, y + 4, { width: CONTENT_WIDTH, align: 'center' });
  doc.fillColor('#1A1A1A');
  y += 26;

  // ----- Origin / Destination -----
  const halfWidth = CONTENT_WIDTH / 2 - 6;
  labelValue(doc, MARGIN, y, 'From (Origin)', c.origin, halfWidth);
  labelValue(doc, MARGIN + halfWidth + 12, y, 'To (Destination)', c.destination, halfWidth);
  y += 26;

  // ----- LR No / Date / EDD / Mode -----
  const colW = CONTENT_WIDTH / 4 - 6;
  labelValue(doc, MARGIN, y, 'LR No.', c.lr_no, colW);
  labelValue(doc, MARGIN + colW + 8, y, 'LR Date', fmtDate(c.lr_date), colW);
  labelValue(doc, MARGIN + (colW + 8) * 2, y, 'EDD', fmtDate(c.edd), colW);
  labelValue(doc, MARGIN + (colW + 8) * 3, y, 'Booking Mode', c.booking_mode, colW);
  y += 26;

  // ----- Consignor / Consignee -----
  y = drawSectionHeader(doc, y, 'CONSIGNOR & CONSIGNEE');
  y += 6;
  doc.font('Helvetica').fontSize(6.5).fillColor('#5C6B7A').text('CONSIGNOR NAME & ADDRESS', MARGIN, y, { width: halfWidth });
  doc.text('CONSIGNEE NAME & ADDRESS', MARGIN + halfWidth + 12, y, { width: halfWidth });
  y += 9;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1A1A1A')
    .text(c.consignor_name_address || '-', MARGIN, y, { width: halfWidth });
  doc.text(c.consignee_name_address || '-', MARGIN + halfWidth + 12, y, { width: halfWidth });
  y += 26;
  doc.font('Helvetica').fontSize(6.5).fillColor('#5C6B7A').text('GSTIN: ' + (c.consignor_gstin || '-'), MARGIN, y, { width: halfWidth });
  doc.text('GSTIN: ' + (c.consignee_gstin || '-'), MARGIN + halfWidth + 12, y, { width: halfWidth });
  y += 14;

  // ----- Vehicle & Shipment -----
  y = drawSectionHeader(doc, y, 'VEHICLE & SHIPMENT DETAILS');
  y += 6;
  const vColW = CONTENT_WIDTH / 4 - 6;
  labelValue(doc, MARGIN, y, 'Vehicle No.', c.vehicle_no, vColW);
  labelValue(doc, MARGIN + vColW + 8, y, 'Driver Name', c.driver_name, vColW);
  labelValue(doc, MARGIN + (vColW + 8) * 2, y, 'Driver Mobile', c.driver_mobile, vColW);
  labelValue(doc, MARGIN + (vColW + 8) * 3, y, 'Vehicle Type', c.vehicle_type, vColW);
  y += 28;

  // ----- Invoice & E-way Bill -----
  y = drawSectionHeader(doc, y, 'INVOICE & E-WAY BILL DETAILS');
  y += 6;
  const iColW = (CONTENT_WIDTH - 16) / 3;
  labelValue(doc, MARGIN, y, 'E-Way Bill No.', c.eway_bill_no, iColW);
  labelValue(doc, MARGIN + iColW + 8, y, 'EWB Validity', fmtDate(c.eway_validity), iColW);
  labelValue(doc, MARGIN + (iColW + 8) * 2, y, 'Invoice No.', c.invoice_no, iColW);
  y += 22;
  labelValue(doc, MARGIN, y, 'Invoice Date', fmtDate(c.invoice_date), iColW);
  labelValue(doc, MARGIN + iColW + 8, y, 'Invoice Value (Rs.)', c.invoice_value, iColW);
  y += 26;

  // ----- Insurance -----
  doc.font('Helvetica').fontSize(6.5).fillColor('#5C6B7A').text('INSURANCE DETAIL / SPECIAL INSTRUCTIONS', MARGIN, y);
  y += 9;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1A1A1A').text(c.insurance_detail || '-', MARGIN, y, { width: CONTENT_WIDTH });
  y += 26;

  // ----- Goods Description Table -----
  y = drawSectionHeader(doc, y, 'GOODS DESCRIPTION (SAID TO CONTAIN)');
  y += 6;

  const tableHeaders = ['Pkgs (Nos.)', 'Packing Type', 'Description of Goods', 'Actual Wt (Kg)', 'Charged Wt (Kg)', 'Customer Ref. No.'];
  const tableColWidths = [55, 65, 150, 65, 70, CONTENT_WIDTH - 405];
  const tableTop = y;
  const headerRowH = 16;
  const dataRowH = 22;
  const tablePadX = 4;

  // Header row background + text
  doc.rect(MARGIN, y, CONTENT_WIDTH, headerRowH).fillAndStroke('#F0EDE6', '#5C6B7A');
  let tx = MARGIN;
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#5C6B7A');
  tableHeaders.forEach((h, i) => {
    doc.text(h, tx + tablePadX, y + 4, { width: tableColWidths[i] - tablePadX * 2 });
    tx += tableColWidths[i];
  });
  y += headerRowH;

  // Data row
  doc.rect(MARGIN, y, CONTENT_WIDTH, dataRowH).stroke('#5C6B7A');
  const rowValues = [c.pkgs_nos, c.packing_type, c.goods_description, c.actual_wt, c.charged_wt, c.customer_ref_no];
  tx = MARGIN;
  doc.font('Helvetica').fontSize(8.5).fillColor('#1A1A1A');
  rowValues.forEach((v, i) => {
    doc.text(v || '-', tx + tablePadX, y + 6, { width: tableColWidths[i] - tablePadX * 2 });
    tx += tableColWidths[i];
  });
  y += dataRowH;

  // Vertical column dividers spanning header + data row
  tx = MARGIN;
  doc.lineWidth(0.5).strokeColor('#5C6B7A');
  tableColWidths.forEach((w) => {
    tx += w;
    doc.moveTo(tx, tableTop).lineTo(tx, y).stroke();
  });
  // Outer border (redraw crisply over the two rects)
  doc.rect(MARGIN, tableTop, CONTENT_WIDTH, headerRowH + dataRowH).stroke('#5C6B7A');

  y += 14;

  // ----- Loading details / Payment / Risk -----
  y = drawSectionHeader(doc, y, 'LOADING DETAILS, PAYMENT & REMARKS');
  y += 6;
  const lColW = CONTENT_WIDTH / 4 - 6;
  labelValue(doc, MARGIN, y, 'Vehicle IN (Loading)', fmtDateTime(c.vehicle_in_time), lColW);
  labelValue(doc, MARGIN + lColW + 8, y, 'Vehicle OUT (Loading)', fmtDateTime(c.vehicle_out_time), lColW);
  labelValue(doc, MARGIN + (lColW + 8) * 2, y, 'GST Payable By', c.gst_payable_by, lColW);
  labelValue(doc, MARGIN + (lColW + 8) * 3, y, 'Risk Type', c.risk_type, lColW);
  y += 26;

  doc.font('Helvetica').fontSize(6.5).fillColor('#5C6B7A').text('REMARKS', MARGIN, y);
  y += 9;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1A1A1A').text(c.remarks || '-', MARGIN, y, { width: CONTENT_WIDTH });
  y += 20;

  // ----- Terms & Conditions -----
  if (y > 560) { doc.addPage(); y = MARGIN; }
  y = drawSectionHeader(doc, y, 'TERMS & CONDITIONS - AT OWNER\'S RISK');
  y += 8;
  const terms = [
    "Goods carried entirely at OWNER'S RISK. Company not liable for loss/damage due to fire, theft, accident, riots, flood, weather conditions or any act of God.",
    "Delivery time not guaranteed. Delays due to traffic, road conditions, strikes, lockdown or Govt. restrictions not company's liability. No claim for delay.",
    "Consignment contents/value as declared by consignor. Company not responsible for undeclared, mis-declared or prohibited/hazardous goods. Consignor fully liable.",
    "Claims for loss/damage must be reported in writing within same day of delivery/booking. No claim entertained after this period.",
    "Company not responsible for breakage/leakage not visible externally, or goods detained/seized by Govt. authority or wrong octroi/customs assessment.",
    "Demurrage @ Rs.4/quintal after 7 days from arrival. Re-booking charges extra. Perishable goods disposed after 48 hrs if undelivered.",
    "Jurisdiction: UDAIPUR ONLY. All disputes, claims & matters subject to Udaipur courts only. This CN is legal & valid as per IT Act 2000.",
  ];
  doc.font('Helvetica').fontSize(6.8).fillColor('#1A1A1A');
  terms.forEach((t, i) => {
    doc.text(`${i + 1}. ${t}`, MARGIN, y, { width: CONTENT_WIDTH });
    y += doc.heightOfString(`${i + 1}. ${t}`, { width: CONTENT_WIDTH }) + 2;
  });

  y += 6;
  doc.font('Helvetica-Oblique').fontSize(6.8).fillColor('#5C6B7A').text(
    'DECLARATION: I/We have carefully checked and verified the contents of this Consignment Note and agree to all Terms & Conditions printed above. Particulars and details furnished herein are true and correct.',
    MARGIN, y, { width: CONTENT_WIDTH }
  );
  y += 24;

  // ----- Signature blocks -----
  y += 30; // blank space reserved for actual wet signatures
  if (y > 720) { doc.addPage(); y = MARGIN; }
  const sigColWidth = CONTENT_WIDTH / 2 - 6;
  doc.moveTo(MARGIN, y).lineTo(MARGIN + sigColWidth, y).strokeColor('#1A1A1A').lineWidth(0.5).stroke();
  doc.moveTo(MARGIN + sigColWidth + 12, y).lineTo(MARGIN + CONTENT_WIDTH, y).stroke();
  y += 4;
  doc.font('Helvetica').fontSize(7.5).fillColor('#1A1A1A')
    .text('CONSIGNOR Seal & Signature', MARGIN, y, { width: sigColWidth });
  doc.text('CONSIGNEE Seal & Signature (Material Receipt Acknowledgement)', MARGIN + sigColWidth + 12, y, { width: sigColWidth });
  y += 30;
  doc.font('Helvetica-Bold').fontSize(8).text('For MAHADEV CARGO MOVERS', MARGIN, y);
  y += 22;
  doc.font('Helvetica').fontSize(7.5).text('Authorised Signatory', MARGIN, y);

  doc.end();
});

module.exports = router;