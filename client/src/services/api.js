const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const TOKEN_KEY = 'campusfix_token';
const USER_KEY = 'campusfix_user';

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function saveSession({ token, user }) {
  setToken(token);
  sessionStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getSavedUser() {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
  } catch {
    clearToken();
    return null;
  }
}

async function request(path, options = {}) {
  const headers = { Accept: 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new Error(`Can't reach the CampusFix API at ${API_BASE_URL}. Check that the backend is running.`);
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      if (response.ok) throw new Error('The API returned an unreadable response.');
    }
  }
  if (!response.ok) {
    if (response.status === 401 && token) {
      clearToken();
      window.dispatchEvent(new Event('campusfix:unauthorized'));
    }
    const detail = data?.message || `Request failed (${response.status}).`;
    const validation = Array.isArray(data?.errors) ? ` ${data.errors.join('. ')}` : '';
    throw new Error(`${detail}${validation}`);
  }
  return data;
}

export const api = {
  register: (details) => request('/auth/register', { method: 'POST', body: details }),
  login: (credentials) => request('/auth/login', { method: 'POST', body: credentials }),
  getIssues: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== '' && value !== undefined && value !== null) query.set(key, value);
    });
    const suffix = query.size ? `?${query.toString()}` : '';
    return request(`/issues${suffix}`);
  },
  getStats: () => request('/issues/stats'),
  createIssue: (issue) => request('/issues', { method: 'POST', body: issue }),
  updateIssue: (id, changes) => request(`/issues/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes }),
  deleteIssue: (id) => request(`/issues/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
