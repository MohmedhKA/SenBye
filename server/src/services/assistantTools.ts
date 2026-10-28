import { NotImplementedError } from '../errors.js';

export const assistantTools = [];

export function mapToolResult(_toolName: string, _raw: unknown): never {
  throw new NotImplementedError('AI5');
}
