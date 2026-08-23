const { verifyToken } = require('../utils/jwt');
const { error } = require('../utils/response');

function protect(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return error(res, 'Unauthorized', 401);
  }

  const token = header.split(' ')[1];

  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    return error(res, 'Invalid or expired token', 401);
  }
}

function isAdminOrManager(req, res, next) {
  const role = (req.user?.role || '').toUpperCase();

  if (role !== 'ADMIN' && role !== 'MANAGER') {
    return error(res, 'Unauthorized', 403);
  }

  next();
}

module.exports = { protect, isAdminOrManager };
