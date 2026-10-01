import axios from "axios";

/** API base. Always same-origin `/api`: next.config.ts rewrites it to the backend
 *  app, which keeps the httpOnly session cookie first-party. */
export const API_BASE_URL = "/api";

/** Shared Axios instance. `withCredentials` carries the httpOnly session cookie. */
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});
