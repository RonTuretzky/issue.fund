// Only enumerated codes leave the service. Provider errors can contain tokens,
// request bodies or raw mail and must never be returned or logged verbatim.
export class ServiceError extends Error {
  constructor(code, status = 503) {
    super(code);
    this.code = code;
    this.status = status;
  }
}
export const fail = (code, status) => {
  throw new ServiceError(code, status);
};
export function safeCode(error) {
  return error instanceof ServiceError ? error.code : "service_unavailable";
}
