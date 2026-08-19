/**
 * Typed application error carrying an HTTP status code and optional
 * field-level validation details. Thrown anywhere in the service or
 * validation layer and translated into a JSON response by the controller.
 */
export class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status to respond with.
   * @param {string} message Human-readable message.
   * @param {Record<string, string>} [errors] Field-keyed validation messages.
   */
  constructor(statusCode, message, errors = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    if (errors) this.errors = errors;
  }

  static badRequest(message, errors) {
    return new ApiError(400, message, errors);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }
}
