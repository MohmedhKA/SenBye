/**
 * Browser desktop notifications helper per Rules N2 and N3.
 */

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (err) {
    console.error('Failed to request notification permission:', err);
    return false;
  }
}

/**
 * Rule N3: Triggers desktop alert ONLY when document.hidden is true and permission is granted.
 */
export function showBackgroundNotification(title: string, body: string, tag?: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }

  if (Notification.permission === 'granted' && document.hidden) {
    try {
      new Notification(title, {
        body,
        tag: tag || 'senbye-alert',
      });
    } catch (err) {
      console.error('Failed to display desktop notification:', err);
    }
  }
}

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}
