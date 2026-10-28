export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'BAD_CREDENTIALS'
  | 'FORBIDDEN'
  | 'OWN_AUCTION'
  | 'NOT_FOUND'
  | 'EMAIL_TAKEN'
  | 'AUCTION_CLOSED'
  | 'ALREADY_LEADING'
  | 'BID_TOO_LOW'
  | 'AUTO_BID_TOO_LOW'
  | 'AUTO_BID_LOWER'
  | 'LISTING_LOCKED'
  | 'INVALID_STATE'
  | 'DUPLICATE_QUESTION'
  | 'PROPOSAL_NOT_PENDING'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class NotImplementedError extends HttpError {
  constructor(ruleId: string) {
    super(501, 'INTERNAL', `Not implemented: rule ${ruleId}`, { ruleId });
    this.name = 'NotImplementedError';
  }
}
