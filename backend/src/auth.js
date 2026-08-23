export function requireAdmin(req, res, next) {
  const password = req.headers['x-admin-password'] || req.query.admin;
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

export function requireReader(req, res, next) {
  const token = req.headers['x-reader-token'] || req.query.token;
  if (token !== process.env.READER_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}
