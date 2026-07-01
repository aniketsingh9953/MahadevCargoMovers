// api.js
// Small wrapper around fetch() that handles JSON parsing + error messages
// consistently. The session is now an httpOnly cookie set by the server —
// this file never touches localStorage for auth, and never sees the token
// itself (that's the point: JS can't read or leak an httpOnly cookie).

const Api = {
  // Username is just a display convenience, not a credential — safe to keep
  // in sessionStorage for showing "Logged in as ___" without a round-trip,
  // but it carries no authority. Real auth state always lives in the
  // httpOnly cookie and is verified server-side on every request.
  getUsername() {
    return sessionStorage.getItem('mcm_username');
  },
  setUsername(name) {
    if (name) sessionStorage.setItem('mcm_username', name);
    else sessionStorage.removeItem('mcm_username');
  },

  async request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include', // always send/receive the session cookie
    });

    // A 401 on any route other than the login attempt itself means the session
    // cookie is missing/expired/invalidated server-side. Force immediate
    // redirect to login so the user isn't left staring at a broken app.
    const isLoginAttempt = path === '/auth/login';
    if (res.status === 401 && !isLoginAttempt) {
      this.setUsername(null);
      // Dispatch a custom event so app.js can react immediately
      // (catches cases where the 401 happens mid-task, e.g. saving a form)
      window.dispatchEvent(new CustomEvent('mcm:session-expired'));
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

  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setUsername(data.username);
    return data;
  },

  // Asks the server whether the current session cookie is still valid.
  // Used on page load instead of checking localStorage, since the cookie
  // itself is invisible to JS by design.
  async me() {
    const data = await this.request('/auth/me');
    this.setUsername(data.username);
    return data;
  },

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setUsername(null);
    }
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
    const res = await fetch(`${API_BASE}/pdf/${id}`, {
      credentials: 'include', // session cookie sent automatically
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
