export const AUTHORS = ['moon', 'fox'];

export function parseAuthor(req) {
  const author = String(req.headers['x-author'] || '').trim();
  return AUTHORS.includes(author) ? author : null;
}

export function requireAuthor(req, res, next) {
  const author = parseAuthor(req);
  if (!author) return res.status(401).json({ error: 'Choose who you are' });
  req.author = author;
  next();
}
