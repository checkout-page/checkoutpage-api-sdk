export class CheckoutPageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckoutPageError';
    Object.setPrototypeOf(this, CheckoutPageError.prototype);
  }
}

export class AuthenticationError extends CheckoutPageError {
  constructor(message = 'Authentication failed. Please check your API key.') {
    super(message);
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

export class NotFoundError extends CheckoutPageError {
  constructor(message = 'The requested resource was not found.') {
    super(message);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class RateLimitError extends CheckoutPageError {
  constructor(message = 'Rate limit exceeded. Please try again later.') {
    super(message);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

export class ValidationError extends CheckoutPageError {
  constructor(message = 'Validation failed.') {
    super(message);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class APIError extends CheckoutPageError {
  public readonly statusCode: number;
  public readonly response?: unknown;

  constructor(message: string, statusCode: number, response?: unknown) {
    super(message);
    this.name = 'APIError';
    this.statusCode = statusCode;
    this.response = response;
    Object.setPrototypeOf(this, APIError.prototype);
  }
}
