export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
    this.status = 404;
  }
}

export class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = "BadRequestError";
    this.status = 400;
  }
}

// Phase 7: distinct error types for the different ways the C++ engine
// integration can fail, so each maps to a meaningful HTTP status instead
// of one generic 500.

export class EngineUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "EngineUnavailableError";
    this.status = 503; // binary not built / not found
  }
}

export class EngineTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = "EngineTimeoutError";
    this.status = 504;
  }
}

export class EngineExecutionError extends Error {
  constructor(message) {
    super(message);
    this.name = "EngineExecutionError";
    this.status = 502; // engine ran but exited non-zero or gave bad output
  }
}
