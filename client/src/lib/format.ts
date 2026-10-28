export function formatRupees(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return '₹0';
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) {
    return 'Closed';
  }

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / (24 * 3600));
  const hours = Math.floor((totalSeconds % (24 * 3600)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function formatCondition(condition: string): string {
  const map: Record<string, string> = {
    new: 'Brand New',
    like_new: 'Like New',
    good: 'Good',
    fair: 'Fair',
    poor: 'Usable',
  };
  return map[condition] || condition;
}

export function formatCategory(cat: string): string {
  const map: Record<string, string> = {
    cycle: 'Cycles',
    calculator: 'Calculators',
    textbook: 'Textbooks',
    hostel_gear: 'Hostel Gear',
    electronics: 'Electronics',
    lab_equipment: 'Lab Equipment',
    other: 'Other',
  };
  return map[cat] || cat.replace(/_/g, ' ');
}

export function photoUrl(photoName: string | null | undefined): string {
  if (!photoName) return '/placeholder.png';
  if (photoName.startsWith('http://') || photoName.startsWith('https://') || photoName.startsWith('/')) {
    return photoName;
  }
  return `/uploads/${photoName}`;
}

