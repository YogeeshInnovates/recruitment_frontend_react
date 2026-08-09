export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

function authHeaders() {
  try {
    const raw = localStorage.getItem('recruit_user');
    if (raw) {
      const user = JSON.parse(raw);
      if (user?.token) return { 'Authorization': `Bearer ${user.token}` };
    }
  } catch { /* ignore */ }
  return {};
}

function hasToken() {
  try {
    const raw = localStorage.getItem('recruit_user');
    return raw ? !!JSON.parse(raw)?.token : false;
  } catch {
    return false;
  }
}

async function handle(res, path, method) {
  if (res.status === 401 && hasToken()) {
    localStorage.removeItem('recruit_user');
    localStorage.removeItem('recruit_org');
    if (!window.location.pathname.startsWith('/user')) {
      window.location.href = '/';
    }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(err.message || err.error || err.detail || `${method} ${path} failed: ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return res.json();
}

const api = {
  get: async (path) => {
    const res = await fetch(`${BASE_URL}${path}`, { headers: { ...authHeaders() } });
    return handle(res, path, 'GET');
  },
  post: async (path, data) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data)
    });
    return handle(res, path, 'POST');
  },
  put: async (path, data) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: data ? JSON.stringify(data) : undefined
    });
    return handle(res, path, 'PUT');
  },
  delete: async (path) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'DELETE',
      headers: { ...authHeaders() }
    });
    return handle(res, path, 'DELETE');
  },
  upload: async (path, formData) => {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { ...authHeaders() },
      body: formData
    });
    return handle(res, path, 'POST');
  },
  download: async (path) => {
    const res = await fetch(`${BASE_URL}${path}`, { headers: { ...authHeaders() } });
    if (!res.ok) throw new Error(`Download ${path} failed: ${res.status}`);
    return res.blob();
  }
};

export default api;
