import { NotImplementedError } from '../errors.js';

export async function chatAssistant(_userId: string, _message: string): Promise<never> {
  throw new NotImplementedError('AI1');
}

export async function getAssistantHistory(_userId: string): Promise<never> {
  throw new NotImplementedError('AI1');
}

export async function confirmProposal(_userId: string, _proposalId: string, _maxAmount: number): Promise<never> {
  throw new NotImplementedError('AI3');
}

export async function cancelProposal(_userId: string, _proposalId: string): Promise<never> {
  throw new NotImplementedError('AI3');
}
