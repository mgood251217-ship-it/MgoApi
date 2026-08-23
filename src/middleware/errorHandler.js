const { error } = require('../utils/response');

module.exports = (err, req, res, next) => {
  console.error(err);
  const statusCode = err.statusCode || 500;
  error(res, err.message || 'Internal server error', statusCode);
};
