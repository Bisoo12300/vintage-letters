import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.join(__dirname, '..', 'data', 'store.json');
const defaultStore = { letters: [], reading_sessions: [] };

function load() {
  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  if (!fs.existsSync(dataPath)) {
    fs.writeFileSync(dataPath, JSON.stringify(defaultStore, null, 2));
    return structuredClone(defaultStore);
  }
  return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
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
      return store.letters;
    },

    async getLetter(id) {
      return store.letters.find((l) => l.id === id) || null;
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
      return store.letters[idx];
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

    async allLettersWithStats() {
      return Promise.all(store.letters.map((l) => this.letterWithStats(l.id)));
    },
  };
}
