// routes/pdf.js
const express = require('express');
const router = express.Router();
const PDFDocument = require('pdfkit');
const db = require('../db/connection');
const { requireAuth } = require('./auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(requireAuth);

const PAGE_WIDTH = 595.28; // A4 in points
const MARGIN = 28;
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
    .rect(MARGIN, y, CONTENT_WIDTH, 13)
    .fillAndStroke('#0F1C2E', '#0F1C2E');
  doc
    .fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(7.2)
    .text(label, MARGIN + 6, y + 3, { characterSpacing: 0.4 });
  doc.fillColor('#1A1A1A');
  return y + 13;
}

function labelValue(doc, x, y, label, value, width) {
  doc.font('Helvetica').fontSize(6.5).fillColor('#5C6B7A').text(label.toUpperCase(), x, y, { width });
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#1A1A1A').text(value || '-', x, y + 9, { width });
}

// Draws one row of bordered grid cells (label on top, value below), each
// sized to whatever width is given, with the row height auto-growing to fit
// the longest-wrapping value — same dynamic-grid behaviour as the goods table,
// so long text always stays inside its box instead of overflowing.
function drawGridRow(doc, y, cells, colWidths) {
  const padX = 5;
  const padTop = 3;
  const labelH = 7.5;
  const rowTop = y;

  doc.font('Helvetica-Bold').fontSize(7.8);
  const heights = cells.map((cell, i) =>
    doc.heightOfString(cell.value || '-', { width: colWidths[i] - padX * 2 })
  );
  const rowH = padTop + labelH + Math.max(...heights) + 4;

  // Outer + vertical dividers
  let tx = MARGIN;
  doc.lineWidth(0.5).strokeColor('#5C6B7A');
  doc.rect(MARGIN, rowTop, colWidths.reduce((a, b) => a + b, 0), rowH).stroke();
  colWidths.forEach((w, i) => {
    if (i > 0) doc.moveTo(tx, rowTop).lineTo(tx, rowTop + rowH).stroke();
    tx += w;
  });

  // Label + value text
  tx = MARGIN;
  cells.forEach((cell, i) => {
    doc.font('Helvetica').fontSize(5.8).fillColor('#5C6B7A')
      .text(cell.label.toUpperCase(), tx + padX, rowTop + padTop, { width: colWidths[i] - padX * 2 });
    doc.font('Helvetica-Bold').fontSize(7.8).fillColor('#1A1A1A')
      .text(cell.value || '-', tx + padX, rowTop + padTop + labelH, { width: colWidths[i] - padX * 2 });
    tx += colWidths[i];
  });

  return rowTop + rowH;
}

// GET /api/pdf/:id — stream a generated PDF for one consignment note
router.get('/:id', asyncHandler(async (req, res) => {
  const c = await db.prepare('SELECT * FROM consignment_notes WHERE id = ?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Consignment note not found.' });

  const doc = new PDFDocument({ size: 'A4', margin: MARGIN });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="LR_${c.lr_no.replace(/\//g, '-')}.pdf"`);
  doc.pipe(res);

  let y = MARGIN;

  // ----- Header / Company block -----
  doc.font('Helvetica-Bold').fontSize(15).fillColor('#0F1C2E')
    .text('MAHADEV CARGO MOVERS', MARGIN, y);
  y += 16;
  doc.font('Helvetica').fontSize(7).fillColor('#5C6B7A')
    .text('Fleet Owner | Transport Contractor | Commission Agent', MARGIN, y);
  y += 9;
  doc.text('Zamar Kotda Road, Near Kalika Resort, Umarda, Udaipur - 313003', MARGIN, y);
  y += 8.5;
  doc.text('Mob: 8209490565 / 7015741767  |  Email: mahadevcargomovers@gmail.com', MARGIN, y);
  y += 8.5;
  doc.text('GSTIN: 08CLXPS2117L1ZC   |   PAN: CLKPS2117L', MARGIN, y);
  y += 12;

  // Title bar
  doc.rect(MARGIN, y, CONTENT_WIDTH, 15).fillAndStroke('#E8A33D', '#E8A33D');
  doc.fillColor('#0F1C2E').font('Helvetica-Bold').fontSize(9.5)
    .text('CONSIGNMENT NOTE', MARGIN, y + 3.5, { width: CONTENT_WIDTH, align: 'center' });
  doc.fillColor('#1A1A1A');
  y += 19;

  // ----- Origin / Destination -----
  const halfWidth = CONTENT_WIDTH / 2;
  y = drawGridRow(doc, y,
    [{ label: 'From (Origin)', value: c.origin }, { label: 'To (Destination)', value: c.destination }],
    [halfWidth, halfWidth]
  );

  // ----- LR No / Date / EDD / Mode -----
  const colW = CONTENT_WIDTH / 4;
  y = drawGridRow(doc, y, [
    { label: 'LR No.', value: c.lr_no },
    { label: 'LR Date', value: fmtDate(c.lr_date) },
    { label: 'EDD', value: fmtDate(c.edd) },
    { label: 'Booking Mode', value: c.booking_mode },
  ], [colW, colW, colW, colW]);
  y += 4;

  // ----- Consignor / Consignee -----
  y = drawSectionHeader(doc, y, 'CONSIGNOR & CONSIGNEE');
  const consignorValue = `${c.consignor_name_address || '-'}\nGSTIN: ${c.consignor_gstin || '-'}\nMobile: ${c.consignor_mobile || '-'}   Email: ${c.consignor_email || '-'}`;
  const consigneeValue = `${c.consignee_name_address || '-'}\nGSTIN: ${c.consignee_gstin || '-'}`;
  y = drawGridRow(doc, y, [
    { label: 'Consignor Name & Address', value: consignorValue },
    { label: 'Consignee Name & Address', value: consigneeValue },
  ], [halfWidth, halfWidth]);
  y += 4;

  // ----- Vehicle & Shipment -----
  y = drawSectionHeader(doc, y, 'VEHICLE & SHIPMENT DETAILS');
  const vColW = CONTENT_WIDTH / 4;
  y = drawGridRow(doc, y, [
    { label: 'Vehicle No.', value: c.vehicle_no },
    { label: 'Driver Name', value: c.driver_name },
    { label: 'Driver Mobile', value: c.driver_mobile },
    { label: 'Vehicle Type', value: c.vehicle_type },
  ], [vColW, vColW, vColW, vColW]);
  y += 4;

  // ----- Invoice & E-way Bill -----
  y = drawSectionHeader(doc, y, 'INVOICE & E-WAY BILL DETAILS');
  const iColW = CONTENT_WIDTH / 3;
  y = drawGridRow(doc, y, [
    { label: 'E-Way Bill No.', value: c.eway_bill_no },
    { label: 'EWB Validity', value: fmtDate(c.eway_validity) },
    { label: 'Invoice No.', value: c.invoice_no },
  ], [iColW, iColW, iColW]);
  const iColW2 = CONTENT_WIDTH / 2;
  y = drawGridRow(doc, y, [
    { label: 'Invoice Date', value: fmtDate(c.invoice_date) },
    { label: 'Invoice Value (Rs.)', value: c.invoice_value },
  ], [iColW2, iColW2]);
  y += 4;

  // ----- Insurance -----
  y = drawGridRow(doc, y, [
    { label: 'Insurance Detail / Special Instructions', value: c.insurance_detail },
  ], [CONTENT_WIDTH]);
  y += 4;

  // ----- Goods Description Table -----
  y = drawSectionHeader(doc, y, 'GOODS DESCRIPTION (SAID TO CONTAIN)');

  const tableHeaders = ['Pkgs (Nos.)', 'Packing Type', 'Description of Goods', 'Actual Wt (Kg)', 'Charged Wt (Kg)', 'Customer Ref. No.'];
  const tableColWidths = [55, 65, 150, 65, 70, CONTENT_WIDTH - 405];
  const tableTop = y;
  const headerRowH = 13;
  const tablePadX = 4;
  const cellVPad = 4;

  // Header row background + text
  doc.rect(MARGIN, y, CONTENT_WIDTH, headerRowH).fillAndStroke('#F0EDE6', '#5C6B7A');
  let tx = MARGIN;
  doc.font('Helvetica-Bold').fontSize(6.3).fillColor('#5C6B7A');
  tableHeaders.forEach((h, i) => {
    doc.text(h, tx + tablePadX, y + 3, { width: tableColWidths[i] - tablePadX * 2 });
    tx += tableColWidths[i];
  });
  y += headerRowH;

  // Data row — height is dynamic: grows to fit whichever cell wraps the most
  // (e.g. a long goods description), so text never spills outside its box.
  const rowValues = [c.pkgs_nos, c.packing_type, c.goods_description, c.actual_wt, c.charged_wt, c.customer_ref_no];
  doc.font('Helvetica').fontSize(7.5);
  const cellHeights = rowValues.map((v, i) =>
    doc.heightOfString(v || '-', { width: tableColWidths[i] - tablePadX * 2 })
  );
  const dataRowH = Math.max(...cellHeights) + cellVPad * 2;

  doc.rect(MARGIN, y, CONTENT_WIDTH, dataRowH).stroke('#5C6B7A');
  tx = MARGIN;
  doc.font('Helvetica').fontSize(7.5).fillColor('#1A1A1A');
  rowValues.forEach((v, i) => {
    doc.text(v || '-', tx + tablePadX, y + cellVPad, { width: tableColWidths[i] - tablePadX * 2 });
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

  y += 4;

  // ----- Loading details / Payment / Risk -----
  y = drawSectionHeader(doc, y, 'LOADING DETAILS, PAYMENT & REMARKS');
  const lColW = CONTENT_WIDTH / 4;
  y = drawGridRow(doc, y, [
    { label: 'Vehicle IN (Loading)', value: fmtDateTime(c.vehicle_in_time) },
    { label: 'Vehicle OUT (Loading)', value: fmtDateTime(c.vehicle_out_time) },
    { label: 'GST Payable By', value: c.gst_payable_by },
    { label: 'Risk Type', value: c.risk_type },
  ], [lColW, lColW, lColW, lColW]);

  const remarksColWidth = CONTENT_WIDTH / 2;
  const bankDetailValue = 'MAHADEV CARGO MOVERS\nBank Name: ICICI Bank Ltd\nA/c No: 693705500442\nIFSC Code: ICIC0006937';
  y = drawGridRow(doc, y, [
    { label: 'Remarks', value: c.remarks },
    { label: 'Bank Detail', value: bankDetailValue },
  ], [remarksColWidth, remarksColWidth]);
  y += 16;

  // ----- Terms & Conditions -----
  // Reserve enough room for the terms block + declaration + signature area
  // before deciding whether a page break is actually needed (the old fixed
  // threshold here was left over from a taller layout and broke the page
  // prematurely even when there was plenty of space left).
  const PAGE_BOTTOM = doc.page.height - MARGIN;
  if (y > PAGE_BOTTOM - 230) { doc.addPage(); y = MARGIN; }
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
  doc.font('Helvetica').fontSize(6.5).fillColor('#1A1A1A');
  const termsColWidth = CONTENT_WIDTH / 2 - 8;
  const half = Math.ceil(terms.length / 2);
  const leftTerms = terms.slice(0, half);
  const rightTerms = terms.slice(half);
  const termsTop = y;
  let yLeft = termsTop;
  leftTerms.forEach((t, i) => {
    const line = `${i + 1}. ${t}`;
    doc.text(line, MARGIN, yLeft, { width: termsColWidth });
    yLeft += doc.heightOfString(line, { width: termsColWidth }) + 2;
  });
  let yRight = termsTop;
  rightTerms.forEach((t, i) => {
    const line = `${half + i + 1}. ${t}`;
    doc.text(line, MARGIN + termsColWidth + 16, yRight, { width: termsColWidth });
    yRight += doc.heightOfString(line, { width: termsColWidth }) + 2;
  });
  y = Math.max(yLeft, yRight);

  y += 6;
  doc.font('Helvetica-Oblique').fontSize(6.8).fillColor('#5C6B7A').text(
    'DECLARATION: I/We have carefully checked and verified the contents of this Consignment Note and agree to all Terms & Conditions printed above. Particulars and details furnished herein are true and correct.',
    MARGIN, y, { width: CONTENT_WIDTH }
  );
  y += 24;

  // ----- Signature blocks -----
  y += 18; // blank space reserved for actual wet signatures
  if (y > PAGE_BOTTOM - 70) { doc.addPage(); y = MARGIN; }
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
}));

module.exports = router;
