import { NotImplementedError } from '../errors.js';

export function startCloser(): () => void {
  // Stub for 1-second background ticker (M3)
  return () => {
    // Stop function
  };
}

export async function tickCloser(): Promise<never> {
  throw new NotImplementedError('C4');
}
