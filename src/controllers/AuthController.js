const asyncHandler = require('../middleware/asyncHandler');
const { success, error } = require('../utils/response');
const { comparePassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const env = require('../config/env');
const userModel = require('../models/User');

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress;
}

function isLocalhostRequest(req) {
  const ip = getClientIp(req);
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

async function verifyRecaptcha(token, threshold) {
  const url = `https://www.google.com/recaptcha/api/siteverify?secret=${env.recaptcha.secret}&response=${encodeURIComponent(token)}`;
  const response = await fetch(url);
  const result = await response.json();

  return (
    result.success === true &&
    typeof result.score === 'number' &&
    result.score >= threshold &&
    result.action === 'login'
  );
}

const login = asyncHandler(async (req, res) => {
  const username = (req.body.username || '').trim().toLowerCase();
  const password = req.body.password || '';
  const recaptchaToken = req.body['g-recaptcha-response'] || '';

  const isDesktopApp = req.headers['x-client-type'] === 'desktop-app';
  const scoreThreshold = isDesktopApp ? 0.3 : 0.5;
  const isLocalhost = isLocalhostRequest(req);

  if (!isLocalhost) {
    if (!recaptchaToken) {
      return error(res, 'reCAPTCHA tidak valid!');
    }

    let recaptchaValid = false;

    try {
      recaptchaValid = await verifyRecaptcha(recaptchaToken, scoreThreshold);
    } catch (err) {
      return error(res, 'Gagal memverifikasi reCAPTCHA. Coba lagi.');
    }

    if (!recaptchaValid) {
      return error(res, 'Aktivitas mencurigakan terdeteksi!');
    }
  }

  const exists = await userModel.checkUser(username);

  if (!exists) {
    return error(res, 'Username atau password salah!', 401);
  }

  const authData = await userModel.getUserAuthData(username);
  const match = await comparePassword(password, authData.password);

  if (!match) {
    return error(res, 'Username atau password salah!', 401);
  }

  const user = await userModel.getUserByUsername(username);

  const token = signToken({
    user_id: user.user_id,
    store_id: user.store_id,
    role: user.role,
    username: user.username,
    initial: user.initial,
    name: user.name,
  });

  return success(res, { user, token }, 'Login Berhasil');
});

const session = asyncHandler(async (req, res) => {
  const user = await userModel.getUserByUsername(req.user.username);

  if (!user) {
    return error(res, 'Belum login.', 401);
  }

  const fotoLink = `${env.baseUrl}/assets/img/user/${user.picture || 'default.png'}`;

  return success(
    res,
    {
      user: {
        role: user.role,
        username: user.username,
        initial: user.initial,
        name: user.name,
        foto: user.picture,
        foto_link: fotoLink,
      },
    },
    'Session aktif.'
  );
});

const logout = asyncHandler(async (req, res) => {
  return success(res, null, 'Berhasil logout');
});

module.exports = { login, session, logout };
