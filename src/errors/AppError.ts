export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly errors?: Record<string, string>;

  constructor(message: string, statusCode = 400, code = 'BAD_REQUEST', errors?: Record<string, string>) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.errors = errors;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
