import axios from "axios";

/** Shared Axios instance. `withCredentials` carries the httpOnly session cookie. */
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api",
  withCredentials: true,
});
