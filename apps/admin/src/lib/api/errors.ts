/**
 * Thrown by `apiFetch` for every non-2xx / `success:false` response.
 * `code` is the backend's stable error code (e.g. `AUTH_INVALID_CREDENTIALS`)
 * — prefer branching on this over `message` (message is human copy,
 * subject to wording changes; code is the actual contract).
 */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
