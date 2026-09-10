import axios from 'axios';

/**
 * Single axios instance for the whole app.
 * withCredentials makes the browser send the httpOnly auth cookie.
 */
/**
 * Defaults to a same-origin /api, which is what the dev proxy and the Vercel
 * rewrite both provide. Keeping the API same-origin is deliberate: a cookie set
 * by a different domain is a third-party cookie, and Safari refuses those, so
 * sign-in would fail on every iPhone.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  timeout: 30000,
});

/** Normalizes every backend error into one predictable shape. */
export function toAppError(error) {
  if (error.response) {
    const { status, data } = error.response;
    return {
      status,
      message: data?.message || 'Request failed',
      details: data?.details,
      accountStatus: data?.details?.accountStatus,
    };
  }
  if (error.request) {
    return { status: 0, message: 'Cannot reach the server. Check your connection.' };
  }
  return { status: 0, message: error.message || 'Something went wrong' };
}

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    // A 401 anywhere except the session probes means the cookie expired.
    if (status === 401 && !url.includes('/auth/login') && !url.includes('/auth/me')) {
      if (onUnauthorized) onUnauthorized();
    }
    return Promise.reject(error);
  }
);

/** Unwraps the { success, data } envelope so callers get the payload directly. */
export async function request(config) {
  try {
    const { data } = await api(config);
    return data;
  } catch (error) {
    throw toAppError(error);
  }
}

export const get = (url, params, config = {}) => request({ method: 'GET', url, params, ...config });
export const post = (url, data, config = {}) => request({ method: 'POST', url, data, ...config });
export const put = (url, data, config = {}) => request({ method: 'PUT', url, data, ...config });
export const patch = (url, data, config = {}) => request({ method: 'PATCH', url, data, ...config });
export const del = (url, config = {}) => request({ method: 'DELETE', url, ...config });

/** Multipart helper with an optional upload-progress callback. */
export const upload = (url, formData, onProgress) =>
  request({
    method: 'POST',
    url,
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 0,
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });

export default api;
