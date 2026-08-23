const asyncHandler = require('../middleware/asyncHandler');
const { success, error } = require('../utils/response');
const { comparePassword, hashPassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const userModel = require('../models/User');

const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return error(res, 'Username and password are required', 422);
  }

  const user = await userModel.findByUsername(username);

  if (!user) {
    return error(res, 'Invalid credentials', 401);
  }

  const match = await comparePassword(password, user.password);

  if (!match) {
    return error(res, 'Invalid credentials', 401);
  }

  const token = signToken({ id: user.id, username: user.username, role: user.role });

  delete user.password;

  return success(res, { user, token }, 'Login successful');
});

const register = asyncHandler(async (req, res) => {
  const { username, password, name, role } = req.body;

  if (!username || !password || !name) {
    return error(res, 'Username, password, and name are required', 422);
  }

  const existing = await userModel.findByUsername(username);

  if (existing) {
    return error(res, 'Username already taken', 409);
  }

  const hashed = await hashPassword(password);
  const user = await userModel.create({ username, password: hashed, name, role: role || 'user' });

  delete user.password;

  return success(res, user, 'User registered', 201);
});

module.exports = { login, register };
