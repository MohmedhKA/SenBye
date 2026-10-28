import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../lib/api.js';
import { formatRelativeTime } from '../lib/format.js';
import type { Question, User } from '../lib/types.js';
import {
  MessageSquare,
  HelpCircle,
  Pin,
  EyeOff,
  Send,
  AlertCircle,
  Search,
} from 'lucide-react';

interface QASectionProps {
  auctionId: string;
  sellerId: string;
  currentUser: User | null;
}

export function QASection({ auctionId, sellerId, currentUser }: QASectionProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ask form state
  const [askBody, setAskBody] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [similarQuestions, setSimilarQuestions] = useState<Question[]>([]);

  // Seller answer state
  const [answeringQid, setAnsweringQid] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isSeller = currentUser?.id === sellerId;

  // Load questions
  async function loadQuestions() {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiFetch<Question[]>(`/api/auctions/${auctionId}/questions`);
      setQuestions(data);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to load questions');
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadQuestions();
  }, [auctionId, currentUser?.id]);

  // Live pg_trgm similarity search as user types (Rule Q5)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = askBody.trim();
    if (!currentUser || isSeller || trimmed.length < 3) {
      setSimilarQuestions([]);
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const matches = await apiFetch<Question[]>(
          `/api/auctions/${auctionId}/questions/similar?q=${encodeURIComponent(trimmed)}`
        );
        setSimilarQuestions(matches);
      } catch {
        // Ignore similarity search errors
      }
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [askBody, auctionId, currentUser, isSeller]);

  async function handleAskSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!askBody.trim()) return;

    try {
      setIsAsking(true);
      setAskError(null);

      const created = await apiFetch<Question>(`/api/auctions/${auctionId}/questions`, {
        method: 'POST',
        body: JSON.stringify({ body: askBody.trim() }),
      });

      setQuestions((prev) => [created, ...prev]);
      setAskBody('');
      setSimilarQuestions([]);
    } catch (err) {
      if (err instanceof ApiError) {
        setAskError(err.message);
      } else {
        setAskError('Failed to post question');
      }
    } finally {
      setIsAsking(false);
    }
  }

  async function handleAnswerSubmit(qid: number) {
    if (!answerText.trim()) return;

    try {
      setIsSubmittingAnswer(true);
      setError(null);

      const updated = await apiFetch<Question>(`/api/questions/${qid}/answer`, {
        method: 'POST',
        body: JSON.stringify({ answer: answerText.trim() }),
      });

      setQuestions((prev) => prev.map((q) => (q.id === qid ? updated : q)));
      setAnsweringQid(null);
      setAnswerText('');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to submit answer');
      }
    } finally {
      setIsSubmittingAnswer(false);
    }
  }

  async function handleToggleFaq(q: Question) {
    try {
      const updated = await apiFetch<Question>(`/api/questions/${q.id}/faq`, {
        method: 'POST',
        body: JSON.stringify({ is_faq: !q.is_faq }),
      });
      setQuestions((prev) =>
        prev
          .map((item) => (item.id === q.id ? updated : item))
          .sort((a, b) => Number(b.is_faq) - Number(a.is_faq))
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  }

  async function handleHideQuestion(qid: number) {
    if (!window.confirm('Hide this question from public buyers?')) return;
    try {
      await apiFetch(`/api/questions/${qid}/hide`, { method: 'POST' });
      setQuestions((prev) =>
        prev.map((q) => (q.id === qid ? { ...q, status: 'hidden' as const } : q))
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900">Questions & Answers</h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
            {questions.length}
          </span>
        </div>
        <span className="text-xs text-slate-400">Public thread · Rules Q1–Q8</span>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Ask Question Form */}
      {currentUser && !isSeller && (
        <form onSubmit={handleAskSubmit} className="space-y-3 bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-indigo-600" />
              Ask the Senior a Question
            </label>
            <span className="text-xs text-slate-400">
              {askBody.length}/280 chars
            </span>
          </div>

          <div className="relative">
            <textarea
              rows={3}
              value={askBody}
              onChange={(e) => setAskBody(e.target.value)}
              maxLength={280}
              placeholder="Ask about condition, warranty, included cables, or hostel pickup..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
            />
          </div>

          {/* Real-time Similar Question Suggestions (Rule Q5) */}
          {similarQuestions.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs space-y-2">
              <div className="flex items-center gap-1 text-amber-800 font-bold">
                <Search className="w-3.5 h-3.5" />
                <span>Similar questions already asked:</span>
              </div>
              <ul className="space-y-1.5">
                {similarQuestions.map((sim) => (
                  <li key={sim.id} className="text-amber-900 border-l-2 border-amber-400 pl-2">
                    <p className="font-semibold">"{sim.body}"</p>
                    {sim.answer && (
                      <p className="text-emerald-800 mt-0.5">
                        ↳ <span className="font-medium">Seller:</span> {sim.answer}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <span className="text-[10px] text-amber-700 italic block">
                Check above to see if your question is already answered before posting.
              </span>
            </div>
          )}

          {askError && (
            <div className="flex items-center gap-2 text-xs text-rose-600 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{askError}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
            <span className="text-[11px] text-slate-500">
              URLs prohibited · Max 3 unanswered questions · 10/hr
            </span>
            <button
              type="submit"
              disabled={isAsking || askBody.trim().length < 5}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-xs whitespace-nowrap self-start sm:self-auto"
            >
              <Send className="w-3 h-3" />
              {isAsking ? 'Posting...' : 'Ask Question'}
            </button>
          </div>
        </form>
      )}

      {!currentUser && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-600">
          Have a question for the senior?{' '}
          <Link to="/login" className="text-indigo-600 font-semibold hover:underline">
            Sign in
          </Link>{' '}
          to ask questions publicly.
        </div>
      )}

      {/* Questions Thread */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-slate-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : questions.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-xs">
          <HelpCircle className="w-8 h-8 mx-auto text-slate-300 mb-2" />
          No questions yet on this listing. Be the first to ask!
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <div
              key={q.id}
              className={`rounded-xl border p-4 transition-colors space-y-3 ${
                q.is_faq
                  ? 'bg-amber-50/40 border-amber-200'
                  : q.status === 'hidden'
                  ? 'bg-slate-50 border-slate-300 opacity-60'
                  : 'bg-white border-slate-200'
              }`}
            >
              {/* Question Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="font-bold text-slate-900">{q.asker.name}</span>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-500">{formatRelativeTime(q.created_at)}</span>
                  {q.is_faq && (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      <Pin className="w-2.5 h-2.5" />
                      Pinned FAQ
                    </span>
                  )}
                  {q.status === 'hidden' && (
                    <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700">
                      <EyeOff className="w-2.5 h-2.5" />
                      Hidden
                    </span>
                  )}
                </div>

                {/* Seller moderation controls (Rule Q6) */}
                {isSeller && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleFaq(q)}
                      className={`p-1 rounded text-xs transition-colors ${
                        q.is_faq
                          ? 'text-amber-700 bg-amber-100 hover:bg-amber-200'
                          : 'text-slate-400 hover:text-amber-600 hover:bg-slate-100'
                      }`}
                      title={q.is_faq ? 'Unpin FAQ' : 'Pin as FAQ'}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    {q.status !== 'hidden' && (
                      <button
                        onClick={() => handleHideQuestion(q.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 text-xs transition-colors"
                        title="Hide from public"
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Question Body */}
              <p className="text-sm text-slate-800 font-medium whitespace-pre-wrap">{q.body}</p>

              {/* Answer display or answering box */}
              {q.answer ? (
                <div className="bg-slate-50 rounded-lg p-3 border-l-4 border-indigo-500 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-indigo-700">Senior's Answer:</span>
                    {q.answered_at && (
                      <span className="text-[10px] text-slate-400">
                        {formatRelativeTime(q.answered_at)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap">{q.answer}</p>
                </div>
              ) : isSeller ? (
                <div>
                  {answeringQid === q.id ? (
                    <div className="space-y-2 pt-2 border-t border-slate-100">
                      <textarea
                        rows={2}
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        placeholder="Type your response to the buyer..."
                        maxLength={1000}
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAnsweringQid(null);
                            setAnswerText('');
                          }}
                          className="px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isSubmittingAnswer || !answerText.trim()}
                          onClick={() => handleAnswerSubmit(q.id)}
                          className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded disabled:opacity-50"
                        >
                          {isSubmittingAnswer ? 'Posting...' : 'Post Answer'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAnsweringQid(q.id);
                        setAnswerText('');
                      }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      + Answer this question
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Awaiting seller response...</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
