import webpush from 'web-push';

let configured = false;

function ensureConfigured() {
  if (configured) return true;
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) {
    console.warn('[push] missing VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY/VAPID_SUBJECT — push disabled');
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export function otherAuthor(author) {
  return author === 'moon' ? 'sun' : 'moon';
}

/** Fire-and-forget push to every device an author has subscribed from. */
export async function sendPushToAuthor(db, author, payload) {
  if (!ensureConfigured()) return;

  const subs = await db.getPushSubscriptionsForAuthor(author);
  if (!subs.length) return;

  const body = JSON.stringify(payload);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await db.deletePushSubscriptionByEndpoint(sub.endpoint);
        } else {
          console.warn('[push] send failed:', err.message);
        }
      }
    })
  );
}
