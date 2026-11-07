import { env } from "../config/env.js";

// 404 handler — catches any request that didn't match a route above it.
export function notFoundHandler(req, res) {
  res.status(404).json({
    status: "error",
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}

// Centralized error handler — every controller forwards errors here via
// next(err) instead of handling them inline.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || 500;

  if (status >= 500) {
    console.error(err);
  }

  res.status(status).json({
    status: "error",
    message: err.message || "Internal server error",
    ...(env.nodeEnv === "development" && status >= 500 ? { stack: err.stack } : {})
  });
}
