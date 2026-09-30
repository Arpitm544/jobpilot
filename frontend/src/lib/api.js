import axios from 'axios';

// All API calls proxy through Next.js rewrites to keep cookies first-party
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest', // CSRF defense header
  },
  withCredentials: true, // Always include HTTP-only cookies
});

// Response interceptor: on 401 response, notify app and redirect to landing page
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (typeof window !== 'undefined' && error.response?.status === 401) {
      // Don't loop redirect if the 401 was during login attempt or auth check on public pages
      const currentPath = window.location.pathname;
      const isPublicPath = ['/', '/login', '/signup', '/register'].includes(currentPath);

      // Dispatch event for AuthContext to clear state and sync tabs
      window.dispatchEvent(new CustomEvent('jobpilot:auth_expired'));

      if (!isPublicPath) {
        window.location.href = '/?session=expired';
      }
    }
    return Promise.reject(error);
  }
);
