const asyncHandler = require('../middleware/asyncHandler');
const { success, error } = require('../utils/response');
const userModel = require('../models/User');

const getMe = asyncHandler(async (req, res) => {
  const user = await userModel.findById(req.user.id);

  if (!user) {
    return error(res, 'User not found', 404);
  }

  delete user.password;

  return success(res, user);
});

module.exports = { getMe };
