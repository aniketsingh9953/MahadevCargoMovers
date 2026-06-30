// app.js
// A small hand-rolled SPA — no framework, no build step.
// State lives in `State`, screens are rendered into #app by render functions.

const State = {
  user: null, // { username }
  view: 'dashboard', // dashboard | list | form | settings
  editingId: null, // id of consignment being edited, or null for "new"
  consignments: [],
  searchQuery: '',
  toast: null,
  dashboardFilters: { period: 'all', consignor: '', vehicle: '', consignee: '' },
};

const root = document.getElementById('app');

function showToast(message, type = 'success') {
  State.toast = { message, type };
  renderToast();
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    State.toast = null;
    const el = document.getElementById('toast-container');
    if (el) el.innerHTML = '';
  }, 3200);
}

function renderToast() {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  if (!State.toast) {
    container.innerHTML = '';
    return;
  }
  container.innerHTML = `<div class="toast ${State.toast.type}">${escapeHtml(State.toast.message)}</div>`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ===================== INIT =====================

function init() {
  const token = Api.getToken();
  if (token) {
    State.user = { username: Api.getUsername() };
    State.view = 'dashboard';
    renderApp();
    loadConsignments();
  } else {
    renderLogin();
  }
}

// ===================== LOGIN SCREEN =====================

function renderLogin() {
  root.innerHTML = `
    <div class="login-screen">
      <div class="login-card">
        <div class="login-brand">
          <div class="brand-mark">${Icons.truck.replace('currentColor', '#E8A33D')}</div>
          <h1>MAHADEV CARGO MOVERS</h1>
          <p>LR Management System</p>
        </div>
        <div id="login-error"></div>
        <form id="login-form">
          <div class="field-group">
            <label for="username">Username</label>
            <input type="text" id="username" autocomplete="username" required />
          </div>
          <div class="field-group">
            <label for="password">Password</label>
            <input type="password" id="password" autocomplete="current-password" required />
          </div>
          <button type="submit" class="btn btn-primary" id="login-btn">
            <span id="login-btn-text">Log In</span>
          </button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.getElementById('login-btn');
    const btnText = document.getElementById('login-btn-text');
    const errorEl = document.getElementById('login-error');

    errorEl.innerHTML = '';
    btn.disabled = true;
    btnText.innerHTML = `<span class="spinner"></span> Logging in...`;

    try {
      const data = await Api.login(username, password);
      Api.setToken(data.token);
      Api.setUsername(data.username);
      State.user = { username: data.username };
      State.view = 'dashboard';
      renderApp();
      loadConsignments();
    } catch (err) {
      errorEl.innerHTML = `<div class="error-banner">${escapeHtml(err.message)}</div>`;
      btn.disabled = false;
      btnText.textContent = 'Log In';
    }
  });
}

function logout() {
  Api.clearToken();
  State.user = null;
  State.consignments = [];
  renderLogin();
}

// ===================== APP SHELL =====================

function renderApp() {
  root.innerHTML = `
    <div class="app-shell">
      <nav class="sidebar">
        <div class="sidebar-brand">
          <div class="brand-mark">${Icons.truck.replace('currentColor', '#0F1C2E')}</div>
          <div class="brand-text">
            <h2>MAHADEV CARGO<br/>MOVERS</h2>
            <span>LR Management</span>
          </div>
        </div>
        <button class="nav-item ${State.view === 'dashboard' ? 'active' : ''}" data-nav="dashboard">
          ${Icons.dashboard} Dashboard
        </button>
        <button class="nav-item ${State.view === 'form' && !State.editingId ? 'active' : ''}" data-nav="new">
          ${Icons.plus} New Consignment Note
        </button>
        <button class="nav-item ${State.view === 'list' ? 'active' : ''}" data-nav="list">
          ${Icons.list} All LR Entries
        </button>
        <button class="nav-item ${State.view === 'settings' ? 'active' : ''}" data-nav="settings">
          ${Icons.key} Account Settings
        </button>
        <div class="sidebar-footer">
          <div class="sidebar-user">Logged in as<br/><strong style="color:#fff">${escapeHtml(State.user.username)}</strong></div>
          <button class="nav-item" data-nav="logout">${Icons.logout} Log Out</button>
        </div>
      </nav>
      <main class="main-content" id="main-content"></main>
    </div>
  `;

  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.nav;
      if (target === 'logout') return logout();
      if (target === 'new') {
        State.editingId = null;
        State.view = 'form';
      } else {
        State.view = target;
      }
      renderApp();
      if (State.view === 'dashboard' || State.view === 'list') loadConsignments();
      if (State.view === 'form') renderMainContent();
    });
  });

  renderMainContent();
}

function renderMainContent() {
  const main = document.getElementById('main-content');
  if (!main) return;

  if (State.view === 'dashboard') return renderDashboard(main);
  if (State.view === 'list') return renderListView(main);
  if (State.view === 'form') return renderFormView(main);
  if (State.view === 'settings') return renderSettingsView(main);
}

async function loadConsignments() {
  try {
    State.consignments = await Api.listConsignments(State.searchQuery);
  } catch (err) {
    showToast(err.message, 'error');
  }
  if (State.view === 'dashboard' || State.view === 'list') renderMainContent();
}

// ===================== DASHBOARD VIEW =====================

function renderDashboard(main) {
  const f = State.dashboardFilters;

  // ----- Period filter (Weekly / Monthly / Yearly / All) -----
  const now = new Date();
  function inPeriod(c) {
    if (f.period === 'all' || !c.lr_date) return true;
    const d = new Date(c.lr_date);
    if (isNaN(d)) return true;
    if (f.period === 'week') {
      const diffDays = (now - d) / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays < 7;
    }
    if (f.period === 'month') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (f.period === 'year') {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  }

  // ----- Dropdown filter options, built from all data (not yet filtered) -----
  const consignorOptions = [...new Set(State.consignments.map((c) => c.consignor_name_address).filter(Boolean))].sort();
  const consigneeOptions = [...new Set(State.consignments.map((c) => c.consignee_name_address).filter(Boolean))].sort();
  const vehicleOptions = [...new Set(State.consignments.map((c) => c.vehicle_no).filter(Boolean))].sort();

  const filtered = State.consignments.filter((c) =>
    inPeriod(c) &&
    (!f.consignor || c.consignor_name_address === f.consignor) &&
    (!f.consignee || c.consignee_name_address === f.consignee) &&
    (!f.vehicle || c.vehicle_no === f.vehicle)
  );

  const total = filtered.length;
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = filtered.filter((c) => c.lr_date === today).length;
  const totalWeight = filtered.reduce((sum, c) => sum + (parseFloat(c.charged_wt) || 0), 0);
  const recent = filtered.slice(0, 8);

  const periodTabs = [
    { key: 'all', label: 'All Time' },
    { key: 'week', label: 'Weekly' },
    { key: 'month', label: 'Monthly' },
    { key: 'year', label: 'Yearly' },
  ];

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Dashboard</h1>
        <p>Overview of your consignment notes</p>
      </div>
      <button class="btn btn-accent" id="dash-new-btn">${Icons.plus} New Consignment Note</button>
    </div>

    <div class="dash-tabs" role="tablist" style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
      ${periodTabs.map((t) => `
        <button type="button" class="btn ${f.period === t.key ? 'btn-accent' : 'btn-ghost'} dash-tab-btn" data-period="${t.key}" style="padding:7px 16px; font-size:0.82rem;">${t.label}</button>
      `).join('')}
    </div>

    <div class="dash-filters" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:18px;">
      <select id="filter-consignor" style="max-width:220px;">
        <option value="">All Consignors</option>
        ${consignorOptions.map((v) => `<option value="${escapeHtml(v)}" ${f.consignor === v ? 'selected' : ''}>${escapeHtml(truncate(v, 30))}</option>`).join('')}
      </select>
      <select id="filter-consignee" style="max-width:220px;">
        <option value="">All Consignees</option>
        ${consigneeOptions.map((v) => `<option value="${escapeHtml(v)}" ${f.consignee === v ? 'selected' : ''}>${escapeHtml(truncate(v, 30))}</option>`).join('')}
      </select>
      <select id="filter-vehicle" style="max-width:180px;">
        <option value="">All Vehicles</option>
        ${vehicleOptions.map((v) => `<option value="${escapeHtml(v)}" ${f.vehicle === v ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('')}
      </select>
      ${(f.consignor || f.consignee || f.vehicle) ? `<button type="button" class="btn btn-ghost" id="filter-clear" style="padding:7px 14px; font-size:0.82rem;">Clear filters</button>` : ''}
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">Total LR Entries</div>
        <div class="stat-value">${total}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Booked Today</div>
        <div class="stat-value">${todayCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Charged Weight</div>
        <div class="stat-value">${totalWeight.toLocaleString()} <span style="font-size:0.95rem;color:var(--slate)">kg</span></div>
      </div>
    </div>

    <div class="panel" style="padding: 4px 0 8px;">
      <div style="padding: 16px 20px 4px; display:flex; justify-content:space-between; align-items:center;">
        <h3 style="font-family:var(--font-display); margin:0; color:var(--navy); font-size:1.05rem;">Recent Entries</h3>
        <button class="btn-ghost btn" id="dash-view-all" style="padding:6px 12px; font-size:0.8rem;">View all</button>
      </div>
      ${recent.length === 0 ? renderEmptyState() : renderTable(recent)}
    </div>
  `;

  document.getElementById('dash-new-btn').addEventListener('click', () => {
    State.editingId = null;
    State.view = 'form';
    renderApp();
  });
  document.getElementById('dash-view-all').addEventListener('click', () => {
    State.view = 'list';
    renderApp();
  });

  document.querySelectorAll('.dash-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      State.dashboardFilters.period = btn.dataset.period;
      renderMainContent();
    });
  });
  document.getElementById('filter-consignor').addEventListener('change', (e) => {
    State.dashboardFilters.consignor = e.target.value;
    renderMainContent();
  });
  document.getElementById('filter-consignee').addEventListener('change', (e) => {
    State.dashboardFilters.consignee = e.target.value;
    renderMainContent();
  });
  document.getElementById('filter-vehicle').addEventListener('change', (e) => {
    State.dashboardFilters.vehicle = e.target.value;
    renderMainContent();
  });
  const clearBtn = document.getElementById('filter-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      State.dashboardFilters.consignor = '';
      State.dashboardFilters.consignee = '';
      State.dashboardFilters.vehicle = '';
      renderMainContent();
    });
  }

  attachTableActions(main);
}

function renderTable(rows) {
  return `
    <div class="table-wrap">
      <table class="lr-table">
        <thead>
          <tr>
            <th>LR No.</th>
            <th>Date</th>
            <th>Route</th>
            <th>Consignor</th>
            <th>Consignee</th>
            <th>Vehicle</th>
            <th>Charged Wt</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((c) => `
            <tr>
              <td><span class="lr-no-badge">${escapeHtml(c.lr_no)}</span></td>
              <td>${escapeHtml(c.lr_date)}</td>
              <td>${escapeHtml(c.origin)} → ${escapeHtml(c.destination)}</td>
              <td>${escapeHtml(truncate(c.consignor_name_address, 28))}</td>
              <td>${escapeHtml(truncate(c.consignee_name_address, 28))}</td>
              <td><span class="plate-badge">${escapeHtml(c.vehicle_no || '-')}</span></td>
              <td>${escapeHtml(c.charged_wt || '-')} kg</td>
              <td>
                <button class="icon-btn" data-action="pdf" data-id="${c.id}" data-lr="${escapeHtml(c.lr_no)}" title="Download PDF">${Icons.download}</button>
                <button class="icon-btn" data-action="edit" data-id="${c.id}" title="Edit">${Icons.edit}</button>
                <button class="icon-btn" data-action="delete" data-id="${c.id}" data-lr="${escapeHtml(c.lr_no)}" title="Delete">${Icons.trash}</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderEmptyState() {
  return `
    <div class="empty-state">
      ${Icons.empty}
      <h3>No consignment notes yet</h3>
      <p style="margin:0;">Create your first LR to see it listed here.</p>
    </div>
  `;
}

function truncate(str, len) {
  if (!str) return '-';
  return str.length > len ? str.slice(0, len) + '…' : str;
}

function attachTableActions(main) {
  main.querySelectorAll('[data-action="pdf"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await Api.downloadPdf(btn.dataset.id, btn.dataset.lr);
        showToast('PDF downloaded.');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  main.querySelectorAll('[data-action="edit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      State.editingId = btn.dataset.id;
      State.view = 'form';
      renderApp();
    });
  });

  main.querySelectorAll('[data-action="delete"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      confirmDelete(btn.dataset.id, btn.dataset.lr);
    });
  });
}

function confirmDelete(id, lrNo) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>Delete this LR entry?</h3>
      <p>This will permanently delete consignment note <strong>${escapeHtml(lrNo)}</strong>. This cannot be undone.</p>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="cancel-delete">Cancel</button>
        <button class="btn btn-danger" id="confirm-delete">Delete</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('cancel-delete').addEventListener('click', () => overlay.remove());
  document.getElementById('confirm-delete').addEventListener('click', async () => {
    try {
      await Api.deleteConsignment(id);
      overlay.remove();
      showToast('Consignment note deleted.');
      await loadConsignments();
    } catch (err) {
      overlay.remove();
      showToast(err.message, 'error');
    }
  });
}

// ===================== LIST VIEW =====================

// ===================== FORM VIEW (Consignment Note) =====================

let formData = {};

async function renderFormView(main) {
  const isEdit = !!State.editingId;

  if (isEdit) {
    main.innerHTML = `<div class="panel" style="padding:60px; text-align:center;"><span class="spinner dark"></span></div>`;
    try {
      formData = await Api.getConsignment(State.editingId);
    } catch (err) {
      showToast(err.message, 'error');
      State.view = 'list';
      return renderApp();
    }
  } else {
    let nextLrNo = '';
    try {
      const res = await Api.getNextLrNo();
      nextLrNo = res.nextLrNo;
    } catch (e) { /* non-fatal */ }
    const today = new Date().toISOString().slice(0, 10);
    formData = {
      lr_no: nextLrNo,
      lr_date: today,
      edd: '',
      booking_mode: 'To Pay',
      origin: 'Udaipur, Rajasthan',
      destination: '',
      consignor_name_address: '',
      consignor_gstin: '',
      consignor_mobile: '',
      consignor_email: '',
      consignee_name_address: '',
      consignee_gstin: '',
      vehicle_no: '',
      driver_name: '',
      driver_mobile: '',
      vehicle_type: '',
      eway_bill_no: '',
      eway_validity: '',
      invoice_no: '',
      invoice_date: '',
      invoice_value: '',
      insurance_detail: '',
      pkgs_nos: '',
      packing_type: '',
      goods_description: '',
      actual_wt: '',
      charged_wt: '',
      customer_ref_no: '',
      vehicle_in_time: '',
      vehicle_out_time: '',
      gst_payable_by: 'Consignor',
      risk_type: "Owner's Risk",
      remarks: '',
    };
  }

  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${isEdit ? 'Edit Consignment Note' : 'New Consignment Note'}</h1>
        <p>Fields mirror your printed LR format — fill in and save.</p>
      </div>
      <span class="risk-badge-preview" id="risk-badge-preview">${escapeHtml(formData.risk_type || "Owner's Risk")}</span>
    </div>

    <form id="lr-form" class="lr-form">

      <div class="form-section-header">Origin, Destination &amp; LR Details</div>
      <div class="form-section-body cols-2">
        <div class="field-group">
          <label>From (Origin)</label>
          <input type="text" name="origin" value="${escapeHtml(formData.origin)}" required />
        </div>
        <div class="field-group">
          <label>To (Destination)</label>
          <input type="text" name="destination" value="${escapeHtml(formData.destination)}" required />
        </div>
      </div>
      <div class="form-section-body cols-2" style="padding-top:0;">
        <div class="field-group">
          <label>LR No.</label>
          <input type="text" name="lr_no" value="${escapeHtml(formData.lr_no)}" required ${isEdit ? 'readonly style="background:var(--paper-dark)"' : ''} />
          <div class="hint">${isEdit ? 'LR No. cannot be changed after creation.' : 'Auto-suggested — change if needed.'}</div>
        </div>
        <div class="field-group">
          <label>LR Date</label>
          <input type="date" name="lr_date" value="${escapeHtml(formData.lr_date)}" required />
        </div>
      </div>
      <div class="form-section-body cols-2" style="padding-top:0;">
        <div class="field-group">
          <label>EDD (Delivery Date)</label>
          <input type="date" name="edd" value="${escapeHtml(formData.edd)}" />
        </div>
        <div class="field-group">
          <label>Booking Mode</label>
          <div class="radio-row">
            ${['To Pay', 'Paid', 'To be Billed'].map((mode) => `
              <label class="radio-option">
                <input type="radio" name="booking_mode" value="${mode}" ${formData.booking_mode === mode ? 'checked' : ''} />
                ${mode}
              </label>
            `).join('')}
          </div>
        </div>
      </div>

      <div class="form-section-header">Consignor &amp; Consignee</div>
      <div class="form-section-body cols-2">
        <div class="field-group">
          <label>Consignor Name &amp; Address</label>
          <textarea name="consignor_name_address" rows="3" required>${escapeHtml(formData.consignor_name_address)}</textarea>
        </div>
        <div class="field-group">
          <label>Consignee Name &amp; Address</label>
          <textarea name="consignee_name_address" rows="3" required>${escapeHtml(formData.consignee_name_address)}</textarea>
        </div>
        <div class="field-group">
          <label>Consignor GSTIN</label>
          <input type="text" name="consignor_gstin" value="${escapeHtml(formData.consignor_gstin)}" />
        </div>
        <div class="field-group">
          <label>Consignee GSTIN</label>
          <input type="text" name="consignee_gstin" value="${escapeHtml(formData.consignee_gstin)}" />
        </div>
        <div class="field-group">
          <label>Consignor Mobile</label>
          <input type="tel" name="consignor_mobile" value="${escapeHtml(formData.consignor_mobile)}" placeholder="9876543210" />
        </div>
        <div class="field-group">
          <label>Consignor Email</label>
          <input type="email" name="consignor_email" value="${escapeHtml(formData.consignor_email)}" placeholder="consignor@example.com" />
        </div>
      </div>

      <div class="form-section-header">Vehicle &amp; Shipment Details</div>
      <div class="form-section-body">
        <div class="field-group">
          <label>Vehicle No.</label>
          <input type="text" name="vehicle_no" value="${escapeHtml(formData.vehicle_no)}" placeholder="RJ27 GA 4567" required />
        </div>
        <div class="field-group">
          <label>Driver Name</label>
          <input type="text" name="driver_name" value="${escapeHtml(formData.driver_name)}" />
        </div>
        <div class="field-group">
          <label>Driver Mobile</label>
          <input type="text" name="driver_mobile" value="${escapeHtml(formData.driver_mobile)}" />
        </div>
        <div class="field-group">
          <label>Vehicle Type</label>
          <input type="text" name="vehicle_type" value="${escapeHtml(formData.vehicle_type)}" placeholder="32ft SXL" />
        </div>
      </div>

      <div class="form-section-header">Invoice &amp; E-Way Bill Details</div>
      <div class="form-section-body">
        <div class="field-group">
          <label>E-Way Bill No.</label>
          <input type="text" name="eway_bill_no" value="${escapeHtml(formData.eway_bill_no)}" />
        </div>
        <div class="field-group">
          <label>EWB Validity</label>
          <input type="date" name="eway_validity" value="${escapeHtml(formData.eway_validity)}" />
        </div>
        <div class="field-group">
          <label>Invoice No.</label>
          <input type="text" name="invoice_no" value="${escapeHtml(formData.invoice_no)}" />
        </div>
        <div class="field-group">
          <label>Invoice Date</label>
          <input type="date" name="invoice_date" value="${escapeHtml(formData.invoice_date)}" />
        </div>
        <div class="field-group">
          <label>Invoice Value (Rs.)</label>
          <input type="text" name="invoice_value" value="${escapeHtml(formData.invoice_value)}" />
        </div>
      </div>
      <div class="form-section-body cols-1" style="padding-top:0;">
        <div class="field-group">
          <label>Insurance Detail / Special Instructions</label>
          <textarea name="insurance_detail" rows="2">${escapeHtml(formData.insurance_detail)}</textarea>
        </div>
      </div>

      <div class="form-section-header">Goods Description (Said to Contain)</div>
      <div class="form-section-body">
        <div class="field-group">
          <label>Pkgs (Nos.)</label>
          <input type="text" name="pkgs_nos" value="${escapeHtml(formData.pkgs_nos)}" />
        </div>
        <div class="field-group">
          <label>Packing Type</label>
          <input type="text" name="packing_type" value="${escapeHtml(formData.packing_type)}" placeholder="Cartons" />
        </div>
        <div class="field-group">
          <label>Actual Wt. (Kg)</label>
          <input type="text" name="actual_wt" value="${escapeHtml(formData.actual_wt)}" />
        </div>
        <div class="field-group">
          <label>Charged Wt. (Kg)</label>
          <input type="text" name="charged_wt" value="${escapeHtml(formData.charged_wt)}" />
        </div>
        <div class="field-group">
          <label>Customer Reference No.</label>
          <input type="text" name="customer_ref_no" value="${escapeHtml(formData.customer_ref_no)}" placeholder="PO-7788" />
        </div>
      </div>
      <div class="form-section-body cols-1" style="padding-top:0;">
        <div class="field-group">
          <label>Description of Goods</label>
          <textarea name="goods_description" rows="2" required>${escapeHtml(formData.goods_description)}</textarea>
        </div>
      </div>

      <div class="form-section-header">Loading Details, Payment &amp; Remarks</div>
      <div class="form-section-body">
        <div class="field-group">
          <label>Vehicle IN Time (Loading)</label>
          <input type="datetime-local" name="vehicle_in_time" value="${escapeHtml(formData.vehicle_in_time)}" />
        </div>
        <div class="field-group">
          <label>Vehicle OUT Time (Loading)</label>
          <input type="datetime-local" name="vehicle_out_time" value="${escapeHtml(formData.vehicle_out_time)}" />
        </div>
        <div class="field-group">
          <label>GST Payable By</label>
          <select name="gst_payable_by">
            ${['Consignor', 'Consignee', 'Transporter'].map((v) => `<option value="${v}" ${formData.gst_payable_by === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="field-group">
          <label>Risk Type</label>
          <select name="risk_type" id="risk-type-select">
            ${["Owner's Risk", 'Carrier Risk'].map((v) => `<option value="${v}" ${formData.risk_type === v ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-section-body cols-1" style="padding-top:0;">
        <div class="field-group">
          <label>Remarks</label>
          <textarea name="remarks" rows="2">${escapeHtml(formData.remarks)}</textarea>
        </div>
      </div>

      <div id="form-error"></div>

      <div class="form-actions">
        <button type="button" class="btn btn-ghost" id="form-cancel">Cancel</button>
        <button type="submit" class="btn btn-primary" id="form-submit" style="width:auto; padding-left:28px; padding-right:28px;">
          ${isEdit ? 'Save Changes' : 'Save Consignment Note'}
        </button>
      </div>
    </form>
  `;

  document.getElementById('form-cancel').addEventListener('click', () => {
    State.view = 'list';
    renderApp();
  });

  document.getElementById('lr-form').addEventListener('submit', handleFormSubmit);

  document.getElementById('risk-type-select').addEventListener('change', (e) => {
    document.getElementById('risk-badge-preview').textContent = e.target.value;
  });
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const fd = new FormData(form);
  const payload = {};
  for (const [key, value] of fd.entries()) {
    payload[key] = value;
  }

  const submitBtn = document.getElementById('form-submit');
  const errorEl = document.getElementById('form-error');
  errorEl.innerHTML = '';
  submitBtn.disabled = true;
  const originalText = submitBtn.textContent;
  submitBtn.innerHTML = `<span class="spinner"></span>`;

  try {
    let saved;
    if (State.editingId) {
      saved = await Api.updateConsignment(State.editingId, payload);
      showToast('Consignment note updated.');
    } else {
      saved = await Api.createConsignment(payload);
      showToast('Consignment note saved.');
    }
    State.editingId = null;
    State.view = 'list';
    renderApp();
    await loadConsignments();
  } catch (err) {
    errorEl.innerHTML = `<div class="error-banner" style="margin:0 18px;">${escapeHtml(err.message)}</div>`;
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

// ===================== LIST VIEW =====================

function renderListView(main) {
  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1>All LR Entries</h1>
        <p>${State.consignments.length} consignment note${State.consignments.length === 1 ? '' : 's'} saved</p>
      </div>
      <button class="btn btn-accent" id="list-new-btn">${Icons.plus} New Consignment Note</button>
    </div>
    <div class="search-bar">
      <input type="text" id="search-input" placeholder="Search by LR no., vehicle, consignor, consignee, route..." value="${escapeHtml(State.searchQuery)}" />
      ${Icons.search}
    </div>
    <div class="panel">
      ${State.consignments.length === 0 ? renderEmptyState() : renderTable(State.consignments)}
    </div>
  `;

  document.getElementById('list-new-btn').addEventListener('click', () => {
    State.editingId = null;
    State.view = 'form';
    renderApp();
  });

  let debounceTimer;
  document.getElementById('search-input').addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    State.searchQuery = e.target.value;
    const cursorPos = e.target.selectionStart;
    debounceTimer = setTimeout(async () => {
      await loadConsignments();
      // The re-render above replaced the search input with a fresh DOM node,
      // which stole focus. Restore focus + cursor position so typing isn't interrupted.
      const freshInput = document.getElementById('search-input');
      if (freshInput) {
        freshInput.focus();
        freshInput.setSelectionRange(cursorPos, cursorPos);
      }
    }, 300);
  });

  attachTableActions(main);
}

// ===================== SETTINGS VIEW =====================

function renderSettingsView(main) {
  main.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Account Settings</h1>
        <p>Manage your login credentials</p>
      </div>
    </div>

    <div class="panel" style="max-width: 420px; padding: 24px;">
      <h3 style="font-family:var(--font-display); color:var(--navy); margin-top:0;">Change Password</h3>
      <div id="settings-msg"></div>
      <form id="change-password-form">
        <div class="field-group">
          <label>Current Password</label>
          <div class="password-field">
            <input type="password" name="currentPassword" id="pw-current" required autocomplete="current-password" />
            <button type="button" class="icon-btn password-toggle" data-target="pw-current" title="Show/hide password">${Icons.eye || 'Show'}</button>
          </div>
        </div>
        <div class="field-group">
          <label>New Password</label>
          <div class="password-field">
            <input type="password" name="newPassword" id="pw-new" required minlength="6" autocomplete="new-password" />
            <button type="button" class="icon-btn password-toggle" data-target="pw-new" title="Show/hide password">${Icons.eye || 'Show'}</button>
          </div>
          <div class="hint">At least 6 characters.</div>
        </div>
        <div class="field-group">
          <label>Confirm New Password</label>
          <div class="password-field">
            <input type="password" name="confirmPassword" id="pw-confirm" required minlength="6" autocomplete="new-password" />
            <button type="button" class="icon-btn password-toggle" data-target="pw-confirm" title="Show/hide password">${Icons.eye || 'Show'}</button>
          </div>
          <div class="hint" id="pw-match-hint"></div>
        </div>
        <button type="submit" class="btn btn-primary" id="change-pw-btn">Update Password</button>
      </form>
    </div>
  `;

  // Eye toggle buttons — flip the matching input between password/text and swap the icon.
  document.querySelectorAll('.password-toggle').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      btn.innerHTML = (showing ? Icons.eye : Icons.eyeOff) || (showing ? 'Show' : 'Hide');
    });
  });

  // Live feedback if new password and confirm don't match yet.
  const newPwEl = document.getElementById('pw-new');
  const confirmPwEl = document.getElementById('pw-confirm');
  const matchHint = document.getElementById('pw-match-hint');
  function checkMatch() {
    if (!confirmPwEl.value) { matchHint.textContent = ''; return; }
    matchHint.textContent = newPwEl.value === confirmPwEl.value ? '' : 'Passwords do not match.';
    matchHint.style.color = 'var(--danger)';
  }
  newPwEl.addEventListener('input', checkMatch);
  confirmPwEl.addEventListener('input', checkMatch);

  document.getElementById('change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const currentPassword = fd.get('currentPassword');
    const newPassword = fd.get('newPassword');
    const confirmPassword = fd.get('confirmPassword');
    const msgEl = document.getElementById('settings-msg');
    const btn = document.getElementById('change-pw-btn');

    msgEl.innerHTML = '';

    if (newPassword !== confirmPassword) {
      msgEl.innerHTML = `<div class="error-banner">New password and confirmation do not match.</div>`;
      return;
    }

    btn.disabled = true;

    try {
      const res = await Api.changePassword(currentPassword, newPassword);
      if (res.token) Api.setToken(res.token);
      msgEl.innerHTML = `<div class="success-banner">${escapeHtml(res.message)}</div>`;
      e.target.reset();
    } catch (err) {
      msgEl.innerHTML = `<div class="error-banner">${escapeHtml(err.message)}</div>`;
    } finally {
      btn.disabled = false;
    }
  });
}

init();
