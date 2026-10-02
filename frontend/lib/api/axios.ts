import axios from "axios";

/** API base. Always same-origin `/api`: next.config.ts rewrites it to the backend
 *  app, which keeps the httpOnly session cookie first-party. */
export const API_BASE_URL = "/api";

/** Shared Axios instance. `withCredentials` carries the httpOnly session cookie. */
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// Surface the backend's own message (`{ error: { message } }`) as `error.message`,
// so every `toast.error(err.message)` shows e.g. "This module can't be published
// yet. It still needs …" instead of "Request failed with status code 409".
api.interceptors.response.use(undefined, (error) => {
  const message = error?.response?.data?.error?.message;
  if (typeof message === "string" && message) error.message = message;
  return Promise.reject(error);
});
