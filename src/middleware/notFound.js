const { error } = require('../utils/response');

module.exports = (req, res) => {
  error(res, `Route not found: ${req.originalUrl}`, 404);
};
