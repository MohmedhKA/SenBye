import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.js';
import type { AuctionDetail } from '../lib/types.js';
import { Upload, X, Plus, AlertCircle, Lock } from 'lucide-react';

interface CategoryItem {
  slug: string;
  label: string;
}

interface FaqItem {
  question: string;
  answer: string;
}

export function NewListingPage() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [existingAuction, setExistingAuction] = useState<AuctionDetail | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState<'new' | 'like_new' | 'good' | 'fair' | 'poor'>('good');
  const [startingPrice, setStartingPrice] = useState<number | ''>(500);
  const [minIncrement, setMinIncrement] = useState<number | ''>(50);
  const [closesAt, setClosesAt] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [faqs, setFaqs] = useState<FaqItem[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingListing, setLoadingListing] = useState(isEditMode);

  // Default closes_at: 3 days from now
  useEffect(() => {
    if (!isEditMode) {
      const defaultClose = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      const isoLocal = new Date(defaultClose.getTime() - defaultClose.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setClosesAt(isoLocal);
    }
  }, [isEditMode]);

  // Load categories
  useEffect(() => {
    apiFetch<{ categories: CategoryItem[] }>('/api/meta')
      .then((res) => {
        setCategories(res.categories || []);
        if (!isEditMode && res.categories?.length > 0) {
          setCategory(res.categories[0].slug);
        }
      })
      .catch(() => {});
  }, [isEditMode]);

  // Load existing auction in edit mode
  useEffect(() => {
    if (isEditMode && id) {
      setLoadingListing(true);
      apiFetch<AuctionDetail>(`/api/auctions/${id}`)
        .then((auc) => {
          setExistingAuction(auc);
          setTitle(auc.title);
          setCategory(auc.category);
          setDescription(auc.description || '');
          setCondition(auc.condition);
          setStartingPrice(auc.starting_price);
          setMinIncrement(auc.min_increment);

          const closeDate = new Date(auc.closes_at);
          const isoLocal = new Date(closeDate.getTime() - closeDate.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
          setClosesAt(isoLocal);
        })
        .catch((err) => {
          setError(err instanceof ApiError ? err.message : 'Failed to load auction for editing');
        })
        .finally(() => {
          setLoadingListing(false);
        });
    }
  }, [isEditMode, id]);

  const isLockedByBids = isEditMode && (existingAuction?.bid_count || 0) > 0;

  const handlePhotoAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    const validFiles: File[] = [];

    for (const f of filesArray) {
      if (f.size > 3 * 1024 * 1024) {
        setError(`File ${f.name} exceeds 3MB limit.`);
        return;
      }
      validFiles.push(f);
    }

    if (photos.length + validFiles.length > 5) {
      setError('You can upload at most 5 photos.');
      return;
    }

    setPhotos([...photos, ...validFiles]);
    setError(null);
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const addFaq = () => {
    if (faqs.length >= 5) return;
    setFaqs([...faqs, { question: '', answer: '' }]);
  };

  const updateFaq = (index: number, field: 'question' | 'answer', value: string) => {
    const updated = [...faqs];
    updated[index][field] = value;
    setFaqs(updated);
  };

  const removeFaq = (index: number) => {
    setFaqs(faqs.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError('Please sign in to list an item.');
      return;
    }

    setSubmitting(true);
    try {
      if (isEditMode && id) {
        // Edit mode (Rule L3)
        const payload: Record<string, unknown> = {
          description,
        };

        if (!isLockedByBids) {
          payload.title = title;
          payload.category = category;
          payload.condition = condition;
          payload.starting_price = startingPrice;
          payload.min_increment = minIncrement;
          payload.closes_at = new Date(closesAt).toISOString();
        }

        const res = await apiFetch<AuctionDetail>(`/api/auctions/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });

        navigate(`/auctions/${res.id}`);
      } else {
        // Create mode (Rule L2)
        if (photos.length < 1) {
          setError('Please provide at least 1 photo of the item.');
          setSubmitting(false);
          return;
        }

        const formData = new FormData();
        formData.append('title', title.trim());
        formData.append('category', category);
        formData.append('description', description.trim());
        formData.append('condition', condition);
        formData.append('starting_price', String(startingPrice));
        formData.append('min_increment', String(minIncrement));
        formData.append('closes_at', new Date(closesAt).toISOString());

        const validFaqs = faqs.filter((f) => f.question.trim() && f.answer.trim());
        if (validFaqs.length > 0) {
          formData.append('faqs', JSON.stringify(validFaqs));
        }

        for (const photo of photos) {
          formData.append('photos', photo);
        }

        // Direct fetch for multipart upload
        const response = await fetch('/api/auctions', {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });

        const data = await response.json();
        if (!response.ok) {
          throw new ApiError(response.status, data?.error?.code || 'ERROR', data?.error?.message || 'Upload failed');
        }

        navigate(`/auctions/${data.id}`);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Submission failed. Please check form values.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || loadingListing) {
    return <div className="text-center py-12 text-slate-500">Loading listing details...</div>;
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-indigo-600 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900">Sign in to list items</h2>
        <p className="text-sm text-slate-600">
          Graduating seniors and campus students must be registered and signed in to create an auction.
        </p>
        <Link
          to="/login"
          className="inline-block px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xs">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {isEditMode ? 'Edit Auction' : 'List an Item for Auction'}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          {isEditMode
            ? 'Update your auction listing details.'
            : 'Pass your cycle, calculator, books, or appliances to juniors fairly through a timed auction.'}
        </p>
      </div>

      {isLockedByBids && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <Lock className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="text-sm text-amber-800">
            <span className="font-semibold block">Auction Details Locked (Rule L3)</span>
            Bids have already been placed on this auction. To ensure fairness for active bidders, you can only edit the item description.
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Item Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            disabled={isLockedByBids}
            minLength={3}
            maxLength={100}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Hero Sprint 21-Speed Mountain Cycle, Casio fx-991CW Calculator"
            className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
          />
        </div>

        {/* Category & Condition */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              required
              disabled={isLockedByBids}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 capitalize disabled:bg-slate-100 disabled:text-slate-500"
            >
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Condition <span className="text-red-500">*</span>
            </label>
            <select
              required
              disabled={isLockedByBids}
              value={condition}
              onChange={(e) => setCondition(e.target.value as any)}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="new">Brand New (Unopened/Unused)</option>
              <option value="like_new">Like New (Barely used, zero defects)</option>
              <option value="good">Good (Normal wear, fully functional)</option>
              <option value="fair">Fair (Visible wear or scratches)</option>
              <option value="poor">Poor (Usable, but needs repair/care)</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Description
          </label>
          <textarea
            rows={4}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the condition, usage history, included accessories, or pickup specifics (e.g. free cycle lock, charger included, pickup at Hostel D)..."
            className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-xs text-slate-400 block text-right mt-1">
            {description.length}/2000 chars
          </span>
        </div>

        {/* Starting Price & Minimum Increment */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Starting Price (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              disabled={isLockedByBids}
              min={1}
              max={1000000}
              value={startingPrice}
              onChange={(e) => setStartingPrice(e.target.value ? parseInt(e.target.value, 10) : '')}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Minimum Bid Increment (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              disabled={isLockedByBids}
              min={1}
              max={10000}
              value={minIncrement}
              onChange={(e) => setMinIncrement(e.target.value ? parseInt(e.target.value, 10) : '')}
              className="w-full px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>
        </div>

        {/* Closing Date & Time */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-1">
            Auction Closing Time <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            required
            disabled={isLockedByBids}
            value={closesAt}
            onChange={(e) => setClosesAt(e.target.value)}
            className="w-full sm:w-72 px-3.5 py-2 border border-slate-300 rounded-lg text-sm focus:outline-hidden focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-500"
          />
          <p className="text-xs text-slate-500 mt-1">
            Must be between 10 minutes and 30 days from now. Note: Last-minute bids in final 30s automatically extend by 60s (Rule E1).
          </p>
        </div>

        {/* Photos (Only in Create mode) */}
        {!isEditMode && (
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Photos (1–5 images) <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-slate-500 mb-3">Upload clear photos of the item. Max 3MB each (JPEG, PNG, WebP).</p>

            <div className="flex flex-wrap gap-3 items-center">
              {photos.map((file, i) => (
                <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Preview ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {photos.length < 5 && (
                <label className="w-24 h-24 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors">
                  <Upload className="w-6 h-6 text-slate-400 mb-1" />
                  <span className="text-xs text-slate-500">Add Photo</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handlePhotoAdd}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>
        )}

        {/* Pre-written FAQs (Rule Q7) */}
        {!isEditMode && (
          <div className="pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-semibold text-slate-700 block">
                  Frequently Asked Questions (Optional, up to 5)
                </span>
                <span className="text-xs text-slate-500">
                  Answer common questions in advance (e.g. brakes status, charger included) to avoid repeated queries (Rule Q7).
                </span>
              </div>
              {faqs.length < 5 && (
                <button
                  type="button"
                  onClick={addFaq}
                  className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  <Plus className="w-4 h-4" /> Add FAQ
                </button>
              )}
            </div>

            <div className="space-y-3 mt-3">
              {faqs.map((faq, i) => (
                <div key={i} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 relative">
                  <button
                    type="button"
                    onClick={() => removeFaq(i)}
                    className="absolute top-2.5 right-2.5 text-slate-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <input
                    type="text"
                    placeholder="Question (e.g. Are the cycle gears working?)"
                    value={faq.question}
                    onChange={(e) => updateFaq(i, 'question', e.target.value)}
                    className="w-full pr-8 px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs sm:text-sm focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Answer (e.g. Yes, Shimano 21 gears recently serviced.)"
                    value={faq.answer}
                    onChange={(e) => updateFaq(i, 'answer', e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-md text-xs sm:text-sm focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit Button */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <Link
            to={isEditMode ? `/auctions/${id}` : '/'}
            className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-xs transition-colors disabled:opacity-50"
          >
            {submitting ? 'Saving...' : isEditMode ? 'Update Listing' : 'Publish Auction'}
          </button>
        </div>
      </form>
    </div>
  );
}
