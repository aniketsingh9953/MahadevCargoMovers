// api.js
// Small wrapper around fetch() that attaches the login token and
// handles JSON parsing + error messages consistently.

const Api = {
  getToken() {
    return localStorage.getItem('mcm_token');
  },
  setToken(token) {
    localStorage.setItem('mcm_token', token);
  },
  clearToken() {
    localStorage.removeItem('mcm_token');
    localStorage.removeItem('mcm_username');
  },
  getUsername() {
    return localStorage.getItem('mcm_username');
  },
  setUsername(name) {
    localStorage.setItem('mcm_username', name);
  },

  async request(path, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    // Only treat a 401 as "your session expired" when we actually sent an existing
    // token. A failed /auth/login attempt also returns 401 for wrong credentials,
    // and that should just show an error — not force-reload the page (which was
    // wiping the error message off-screen in under a second).
    if (res.status === 401 && token) {
      this.clearToken();
      window.location.reload();
      throw new Error('Session expired. Please log in again.');
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      if (!res.ok) throw new Error('Request failed.');
      return res; // e.g. PDF binary response, caller handles it
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Something went wrong.');
    }
    return data;
  },

  login(username, password) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  changePassword(currentPassword, newPassword) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  listConsignments(query) {
    const q = query ? `?q=${encodeURIComponent(query)}` : '';
    return this.request(`/consignments${q}`);
  },

  getNextLrNo() {
    return this.request('/consignments/next-lr-no');
  },

  getConsignment(id) {
    return this.request(`/consignments/${id}`);
  },

  createConsignment(data) {
    return this.request('/consignments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateConsignment(id, data) {
    return this.request(`/consignments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteConsignment(id) {
    return this.request(`/consignments/${id}`, { method: 'DELETE' });
  },

  async downloadPdf(id, lrNo) {
    const token = this.getToken();
    const res = await fetch(`${API_BASE}/pdf/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Could not generate PDF.');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LR_${(lrNo || 'consignment').replace(/\//g, '-')}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  },
};
