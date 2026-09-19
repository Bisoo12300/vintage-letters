import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, '..', 'data', 'store.json');
const defaultStore = { letters: [], reading_sessions: [], date_plans: [], push_subscriptions: [] };

function load() {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify(defaultStore, null, 2));
    return structuredClone(defaultStore);
  }
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  if (!data.reading_sessions) data.reading_sessions = [];
  if (!data.date_plans) data.date_plans = [];
  if (!data.push_subscriptions) data.push_subscriptions = [];
  return data;
}

function withAuthor(letter) {
  return {
    ...letter,
    author: letter.author || 'moon',
    reply_to: letter.reply_to || null,
  };
}

function save(store) {
  fs.writeFileSync(dataPath, JSON.stringify(store, null, 2));
}

export function createJsonDb() {
  let store = load();

  return {
    kind: 'json',
    async init() {},
    async ping() {},

    async getLetters() {
      return store.letters.map(withAuthor);
    },

    async getLetter(id) {
      const letter = store.letters.find((l) => l.id === id);
      return letter ? withAuthor(letter) : null;
    },

    async insertLetter(letter) {
      store.letters.unshift(letter);
      save(store);
      return letter;
    },

    async updateLetter(id, updates) {
      const idx = store.letters.findIndex((l) => l.id === id);
      if (idx === -1) return null;
      store.letters[idx] = { ...store.letters[idx], ...updates };
      save(store);
      return withAuthor(store.letters[idx]);
    },

    async deleteLetter(id) {
      const before = store.letters.length;
      store.letters = store.letters.filter((l) => l.id !== id);
      store.reading_sessions = store.reading_sessions.filter((s) => s.letter_id !== id);
      save(store);
      return store.letters.length < before;
    },

    async getSessions(letterId) {
      return store.reading_sessions.filter((s) => s.letter_id === letterId);
    },

    async insertSession(session) {
      store.reading_sessions.push(session);
      save(store);
      return session;
    },

    async updateSession(id, updates) {
      const idx = store.reading_sessions.findIndex((s) => s.id === id);
      if (idx === -1) return null;
      store.reading_sessions[idx] = { ...store.reading_sessions[idx], ...updates };
      save(store);
      return store.reading_sessions[idx];
    },

    async getSession(id) {
      return store.reading_sessions.find((s) => s.id === id) || null;
    },

    async letterWithStats(id) {
      const letter = await this.getLetter(id);
      if (!letter) return null;
      const sessions = (await this.getSessions(id)).filter((s) => s.ended_at);
      return {
        ...letter,
        read_count: sessions.length,
        total_read_seconds: sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0),
        last_read_at: sessions.length
          ? sessions.reduce((a, b) => (a.ended_at > b.ended_at ? a : b)).ended_at
          : null,
      };
    },

    async allLettersWithStats(author) {
      if (!author) return [];
      const letters = store.letters.filter((l) => withAuthor(l).author === author);
      return Promise.all(letters.map((l) => this.letterWithStats(l.id)));
    },

    async getInbox(reader) {
      return store.letters
        .filter((l) => withAuthor(l).author !== reader)
        .map((l) => {
          const letter = withAuthor(l);
          const unread = !store.reading_sessions.some(
            (s) => s.letter_id === letter.id && s.reader === reader
          );
          return {
            id: letter.id,
            title: letter.title,
            template: letter.template,
            author: letter.author,
            created_at: letter.created_at,
            unread,
          };
        })
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    },

    async countUnreadInbox(reader) {
      const inbox = await this.getInbox(reader);
      return inbox.filter((l) => l.unread).length;
    },

    async getReaders(letterId) {
      const byReader = new Map();
      for (const s of store.reading_sessions) {
        if (s.letter_id !== letterId || !s.reader) continue;
        const at = s.ended_at || s.started_at;
        const prev = byReader.get(s.reader);
        if (!prev || at > prev) byReader.set(s.reader, at);
      }
      return [...byReader.entries()]
        .map(([reader, last_read_at]) => ({ reader, last_read_at }))
        .sort((a, b) => b.last_read_at.localeCompare(a.last_read_at));
    },

    async getPlans() {
      return [...store.date_plans].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    },

    async getPlan(id) {
      return store.date_plans.find((p) => p.id === id) || null;
    },

    async insertPlan(plan) {
      store.date_plans.push(plan);
      save(store);
      return plan;
    },

    async updatePlanStatus(id, status, respondedAt) {
      const idx = store.date_plans.findIndex((p) => p.id === id);
      if (idx === -1) return null;
      store.date_plans[idx] = {
        ...store.date_plans[idx],
        status,
        responded_at: respondedAt,
      };
      save(store);
      return store.date_plans[idx];
    },

    async deletePlan(id) {
      const before = store.date_plans.length;
      store.date_plans = store.date_plans.filter((p) => p.id !== id);
      save(store);
      return store.date_plans.length < before;
    },

    async insertPushSubscription(sub) {
      const idx = store.push_subscriptions.findIndex((s) => s.endpoint === sub.endpoint);
      if (idx === -1) {
        store.push_subscriptions.push(sub);
      } else {
        store.push_subscriptions[idx] = { ...store.push_subscriptions[idx], ...sub };
      }
      save(store);
      return sub;
    },

    async getPushSubscriptionsForAuthor(author) {
      return store.push_subscriptions.filter((s) => s.author === author);
    },

    async deletePushSubscriptionByEndpoint(endpoint) {
      const before = store.push_subscriptions.length;
      store.push_subscriptions = store.push_subscriptions.filter((s) => s.endpoint !== endpoint);
      save(store);
      return store.push_subscriptions.length < before;
    },
  };
}
