import type { RequestHandler } from "express";

/** Wrap an async handler so rejected promises reach the central error handler. */
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
