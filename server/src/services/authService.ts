import { NotImplementedError } from '../errors.js';

export async function registerUser(_data: unknown): Promise<never> {
  throw new NotImplementedError('M1');
}

export async function loginUser(_data: unknown): Promise<never> {
  throw new NotImplementedError('M1');
}

export async function getUserById(_id: string): Promise<never> {
  throw new NotImplementedError('M1');
}
