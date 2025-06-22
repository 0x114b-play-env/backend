class ApiError extends Error {
  constructor(
    statusCode,
    message = "Something went wrong",
    errorStack = "",
    errors = []
  ) {
    super(message);
    this.message = message;
    this.statusCode = statusCode;
    this.success = false;
    this.data = null;
    this.errors = errors;

    if (errorStack) {
      this.errorStack = errorStack;
    } else {
        Error.captureStackTrace(this, this.constructor)
    }
  }
}

export default ApiError;
