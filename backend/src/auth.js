export const AUTHORS = ['moon', 'fox'];

export function parseAuthor(req) {
  // Only trust identity headers/query — never body.author (spoofable on POST)
  const raw = String(req.headers['x-author'] || req.query.author || '')
    .trim()
    .toLowerCase();
  return AUTHORS.includes(raw) ? raw : null;
}

/** Must be moon or fox — used for CRUD + archive access */
export function requireAuthor(req, res, next) {
  const author = parseAuthor(req);
  if (!author) {
    return res.status(401).json({
      error: 'Choose who you are',
      hint: 'Send header x-author: moon|fox',
    });
  }
  req.author = author;
  next();
}

/** Letter must belong to req.author */
export async function assertOwnLetter(db, letterId, author) {
  const letter = await db.getLetter(letterId);
  if (!letter) return { status: 404, error: 'Letter not found' };
  if (letter.author !== author) {
    return { status: 403, error: 'You can only edit your own letters' };
  }
  return { letter };
}
