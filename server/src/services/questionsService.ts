import { NotImplementedError } from '../errors.js';

export async function askQuestion(_userId: string, _auctionId: string, _body: string): Promise<never> {
  throw new NotImplementedError('Q1');
}

export async function answerQuestion(_sellerId: string, _questionId: number, _answer: string): Promise<never> {
  throw new NotImplementedError('Q6');
}

export async function toggleFaq(_sellerId: string, _questionId: number, _isFaq: boolean): Promise<never> {
  throw new NotImplementedError('Q6');
}

export async function hideQuestion(_sellerId: string, _questionId: number): Promise<never> {
  throw new NotImplementedError('Q6');
}

export async function listQuestions(_auctionId: string, _viewerId?: string | null): Promise<never> {
  throw new NotImplementedError('Q1');
}

export async function findSimilarQuestions(_auctionId: string, _query: string): Promise<never> {
  throw new NotImplementedError('Q5');
}
