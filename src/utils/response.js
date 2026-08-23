function success(res, data = null, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

function error(res, message = 'Error', statusCode = 400, data = null) {
  return res.status(statusCode).json({
    success: false,
    message,
    data,
  });
}

module.exports = { success, error };
