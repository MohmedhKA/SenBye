import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { apiFetch, ApiError } from '../lib/api.js';
import { formatRupees, formatRelativeTime } from '../lib/format.js';
import type { AssistantMessage, AssistantProposal } from '../lib/types.js';
import {
  Sparkles,
  Send,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ShieldCheck,
  Bot,
  User as UserIcon,
} from 'lucide-react';

const SUGGESTED_PROMPTS = [
  'Find me a cycle under ₹2500',
  'Look for a Casio scientific calculator under ₹800',
  'Find engineering graphics drafter and T-scale',
  'Hostel study chair or desk lamp',
];

export function AssistantPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [proposals, setProposals] = useState<AssistantProposal[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Proposal confirmation state
  const [proposalLimits, setProposalLimits] = useState<Record<string, string>>({});
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    async function loadHistory() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await apiFetch<{
          messages: AssistantMessage[];
          proposals: AssistantProposal[];
        }>('/api/assistant/history');
        setMessages(data.messages);
        setProposals(data.proposals);

        // Pre-fill default proposal amounts
        const limits: Record<string, string> = {};
        for (const p of data.proposals) {
          limits[p.id] = p.max_amount.toString();
        }
        setProposalLimits(limits);
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError('Failed to load assistant history');
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadHistory();
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, proposals]);

  async function handleSendMessage(textToSend?: string) {
    const text = (textToSend || inputMessage).trim();
    if (!text || isSending) return;

    try {
      setIsSending(true);
      setError(null);
      setActionSuccessMsg(null);
      setInputMessage('');

      // Optimistic user message
      const tempId = Date.now();
      const optimisticMsg: AssistantMessage = {
        id: tempId,
        role: 'user',
        content: text,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticMsg]);

      const res = await apiFetch<{
        reply: string;
        proposals: AssistantProposal[];
      }>('/api/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text }),
      });

      // Append assistant reply
      const assistantMsg: AssistantMessage = {
        id: tempId + 1,
        role: 'assistant',
        content: res.reply,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Merge new proposals
      if (res.proposals && res.proposals.length > 0) {
        setProposals((prev) => {
          const existingIds = new Set(prev.map((p) => p.id));
          const newProps = res.proposals.filter((p) => !existingIds.has(p.id));
          return [...newProps, ...prev];
        });

        // Initialize amounts for new proposals
        setProposalLimits((prev) => {
          const next = { ...prev };
          for (const p of res.proposals) {
            next[p.id] = p.max_amount.toString();
          }
          return next;
        });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to get a response from the assistant');
      }
    } finally {
      setIsSending(false);
    }
  }

  async function handleConfirmProposal(proposal: AssistantProposal) {
    const customAmountStr = proposalLimits[proposal.id] || proposal.max_amount.toString();
    const customAmount = parseInt(customAmountStr, 10);

    // Rule AI4 constraint: user may lower, never raise above proposed max
    if (isNaN(customAmount) || customAmount <= 0) {
      setError('Please specify a positive whole amount');
      return;
    }

    if (customAmount > proposal.max_amount) {
      setError(`Cannot exceed proposed ceiling of ${formatRupees(proposal.max_amount)}`);
      return;
    }

    try {
      setActionLoadingId(proposal.id);
      setError(null);
      setActionSuccessMsg(null);

      await apiFetch(`/api/assistant/proposals/${proposal.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ max_amount: customAmount }),
      });

      setProposals((prev) =>
        prev.map((p) => (p.id === proposal.id ? { ...p, status: 'confirmed' as const } : p))
      );
      setActionSuccessMsg(`Auto-bid confirmed! Entered proxy bidding up to ${formatRupees(customAmount)}.`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to confirm proposal');
      }
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleCancelProposal(proposalId: string) {
    try {
      setActionLoadingId(proposalId);
      setError(null);
      setActionSuccessMsg(null);

      await apiFetch(`/api/assistant/proposals/${proposalId}/cancel`, {
        method: 'POST',
      });

      setProposals((prev) =>
        prev.map((p) => (p.id === proposalId ? { ...p, status: 'cancelled' as const } : p))
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to decline proposal');
      }
    } finally {
      setActionLoadingId(null);
    }
  }

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-100">
          <Sparkles className="w-8 h-8 text-amber-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">SenBye Campus Assistant</h1>
        <p className="text-slate-600 max-w-md mx-auto mb-6">
          Sign in to ask our assistant to find items, recommend fair price ceilings, and safely prepare proxy bids for you.
        </p>
        <Link
          to="/login"
          className="inline-flex items-center px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-all shadow-sm"
        >
          Sign In to Continue
        </Link>
      </div>
    );
  }

  const pendingProposals = proposals.filter((p) => p.status === 'pending');
  const pastProposals = proposals.filter((p) => p.status !== 'pending');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">AI Campus Assistant</h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <Sparkles className="w-3 h-3 text-amber-500" />
              Gemma 4 · Safe Proxy Bidding
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">
            Search campus gear and set up automatic bidding. The assistant never bids without your explicit confirmation (Rule AI3).
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Student Confirmation Required</span>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
          <div className="flex-1">{error}</div>
        </div>
      )}

      {actionSuccessMsg && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="flex-1">{actionSuccessMsg}</div>
        </div>
      )}

      {/* Main Layout: Left Column (Chat Thread) | Right Column (Interactive Proposals) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Chat Thread */}
        <div className="lg:col-span-7 flex flex-col h-[650px] bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {isLoading ? (
              <div className="space-y-3 py-6">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-16 text-slate-400 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center mx-auto shadow-xs">
                  <Bot className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-800">Hi {user.name}!</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  I can search active auctions, recommend prices, and prepare proxy bids for you. What gear are you looking for?
                </p>

                {/* Starter Suggestions */}
                <div className="pt-4 flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => handleSendMessage(prompt)}
                      className="text-xs px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-slate-700 hover:border-blue-400 hover:text-blue-600 font-medium transition-all"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-start gap-2.5 ${
                    m.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {m.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center shrink-0 border border-orange-200 text-orange-700 mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 text-sm leading-relaxed ${
                      m.role === 'user'
                        ? 'bg-blue-600 text-white rounded-tr-xs'
                        : 'bg-slate-100 text-slate-800 rounded-tl-xs whitespace-pre-wrap'
                    }`}
                  >
                    {m.content}
                    <div
                      className={`text-[10px] mt-1 text-right ${
                        m.role === 'user' ? 'text-blue-200' : 'text-slate-400'
                      }`}
                    >
                      {formatRelativeTime(m.created_at)}
                    </div>
                  </div>

                  {m.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 text-slate-700 mt-0.5 font-bold text-xs">
                      <UserIcon className="w-4 h-4" />
                    </div>
                  )}
                </div>
              ))
            )}

            {isSending && (
              <div className="flex items-center gap-2 text-xs text-slate-500 italic py-2">
                <Bot className="w-4 h-4 text-orange-600 animate-spin" />
                <span>Assistant is searching active listings and checking rules...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask about a bicycle, calculator, budget limit..."
              disabled={isSending}
              className="flex-1 px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
            />
            <button
              type="submit"
              disabled={isSending || !inputMessage.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-xs"
            >
              <Send className="w-3.5 h-3.5" />
              Send
            </button>
          </form>
        </div>

        {/* Action Column: Pending & Past Proposals (Rules AI3, AI4, AI6) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Pending Proposals Card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <h2 className="text-base font-bold text-slate-900">Bid Proposals</h2>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-semibold border border-amber-200">
                {pendingProposals.length} Pending
              </span>
            </div>

            {pendingProposals.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No pending proposals. Ask the assistant to find items within your budget to generate a bid proposal.
              </p>
            ) : (
              <div className="space-y-4">
                {pendingProposals.map((prop) => {
                  const customVal = proposalLimits[prop.id] || prop.max_amount.toString();
                  const isCurrentAction = actionLoadingId === prop.id;

                  return (
                    <div
                      key={prop.id}
                      className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-amber-900 leading-snug">
                          {prop.summary}
                        </span>
                        <Link
                          to={`/auctions/${prop.auction_id}`}
                          className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-0.5 shrink-0"
                        >
                          <span>Item</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>

                      {/* Ceiling amount control (Rule AI4) */}
                      <div className="bg-white p-3.5 rounded-xl border border-amber-200 space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700">Max Auto-Bid Ceiling:</span>
                          <span className="text-slate-400 font-medium">Proposed: {formatRupees(prop.max_amount)}</span>
                        </div>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">₹</span>
                          <input
                            type="number"
                            min="1"
                            max={prop.max_amount}
                            value={customVal}
                            onChange={(e) =>
                              setProposalLimits((prev) => ({
                                ...prev,
                                [prop.id]: e.target.value,
                              }))
                            }
                            className="w-full pl-6 pr-2 py-1.5 text-xs border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
                          />
                        </div>
                        <span className="text-[10px] text-slate-500 block">
                          You may lower this ceiling, but cannot exceed proposed limit (Rule AI4).
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>Expires in 30m</span>
                        </span>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <button
                            type="button"
                            disabled={isCurrentAction}
                            onClick={() => handleCancelProposal(prop.id)}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-white rounded-lg transition-colors whitespace-nowrap"
                          >
                            Decline
                          </button>
                          <button
                            type="button"
                            disabled={isCurrentAction}
                            onClick={() => handleConfirmProposal(prop)}
                            className="px-3.5 py-1.5 text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 rounded-xl transition-all shadow-xs whitespace-nowrap"
                          >
                            {isCurrentAction ? 'Confirming...' : 'Confirm Auto-Bid'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Past Proposals Card */}
          {pastProposals.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Proposal History
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {pastProposals.map((p) => (
                  <div
                    key={p.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="truncate flex-1">
                      <p className="font-medium text-slate-800 truncate">{p.summary}</p>
                      <span className="text-[10px] text-slate-400">
                        {formatRelativeTime(p.created_at)}
                      </span>
                    </div>

                    <div className="shrink-0">
                      {p.status === 'confirmed' ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 text-[10px]">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Confirmed
                        </span>
                      ) : p.status === 'cancelled' ? (
                        <span className="inline-flex items-center gap-1 font-medium text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full text-[10px]">
                          <XCircle className="w-3 h-3 text-slate-400" />
                          Declined
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[10px]">
                          <Clock className="w-3 h-3 text-amber-600" />
                          Expired
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
