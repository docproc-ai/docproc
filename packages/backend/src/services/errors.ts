export type ServiceErrorCode = 'not_found' | 'invalid' | 'conflict'

/** Domain error thrown by services; adapters map `code` to a transport status. */
export class ServiceError extends Error {
  constructor(
    public readonly code: ServiceErrorCode,
    message?: string,
  ) {
    super(message ?? code)
    this.name = 'ServiceError'
  }
}
