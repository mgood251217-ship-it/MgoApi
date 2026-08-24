const path = require('path');
const fs = require('fs');
const asyncHandler = require('../middleware/asyncHandler');
const { success, error } = require('../utils/response');
const { compressImage } = require('../utils/imageHelpers');
const { updateStoreCache } = require('../utils/cacheHelpers');
const env = require('../config/env');
const userModel = require('../models/User');

const uploadDir = path.join(__dirname, '../../public/assets/img/user');

function buildRequestData(req) {
  return {
    id: parseInt(req.body.user_id || '0', 10),
    name: (req.body.name || '').trim().toUpperCase(),
    username: (req.body.username || '').trim().toLowerCase(),
    password: req.body.password || '',
    initial: (req.body.initial || '').trim().toUpperCase(),
    role: (req.body.role || '').trim().toUpperCase(),
    store_id: req.user.store_id,
    picture: req.body.old_picture || '',
  };
}

const index = asyncHandler(async (req, res) => {
  const users = await userModel.getUsersByStoreId(req.user.store_id);
  const basePath = `${env.baseUrl}/assets/img/user/`;

  const withLinks = users.map((user) => ({
    ...user,
    picture_link: basePath + (user.picture || 'default.png'),
  }));

  return success(res, withLinks);
});

const create = asyncHandler(async (req, res) => {
  const data = buildRequestData(req);
  const errors = [];
  data.picture = '';

  if (req.file) {
    try {
      data.picture = await compressImage(req.file, uploadDir);
    } catch (err) {
      errors.push(err.message);
    }
  }

  const taken = await userModel.checkUser(data.username);
  if (taken) {
    errors.push('Username sudah terdaftar.');
  }

  if (errors.length > 0) {
    return error(res, 'Terjadi kesalahan saat menambahkan user.', 422, errors);
  }

  const created = await userModel.createUser(data);

  if (!created) {
    return error(res, 'Gagal menambahkan user.');
  }

  updateStoreCache(data.store_id, 'users');
  return success(res, null, 'User berhasil ditambahkan.');
});

const update = asyncHandler(async (req, res) => {
  const data = buildRequestData(req);
  const errors = [];
  const oldPicture = req.body.old_picture || '';

  if (req.file) {
    try {
      data.picture = await compressImage(req.file, uploadDir);

      if (oldPicture) {
        const oldPath = path.join(uploadDir, oldPicture);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
    } catch (err) {
      errors.push(err.message);
    }
  }

  const duplicate = await userModel.checkDuplicateUser(data);
  if (duplicate) {
    errors.push('Username sudah digunakan oleh user lain.');
  }

  if (errors.length > 0) {
    return error(res, 'Terjadi kesalahan', 422, errors);
  }

  const updated = await userModel.updateUser(data);

  if (!updated) {
    return error(res, 'Gagal memperbarui user.');
  }

  updateStoreCache(data.store_id, 'users');
  return success(res, null, 'User berhasil diperbarui.');
});

const remove = asyncHandler(async (req, res) => {
  const data = buildRequestData(req);

  const totalUsers = await userModel.checkUserStore(req.user.store_id);
  if (totalUsers <= 1) {
    return error(res, 'Tidak bisa menghapus user terakhir.');
  }

  const deleted = await userModel.deleteUserById(data.id);

  if (!deleted) {
    return error(res, 'Gagal menghapus user.');
  }

  updateStoreCache(data.store_id, 'users');
  return success(res, null, 'User berhasil dihapus.');
});

const getInitial = asyncHandler(async (req, res) => {
  const initials = await userModel.getUsersInitial(req.user.store_id);
  return success(res, initials, 'Berhasil mengambil Initial');
});

const createHelp = asyncHandler(async (req, res) => {
  const data = {
    user_id: req.user.user_id,
    category: (req.body.category || '').trim().toUpperCase(),
    subject: (req.body.subject || '').trim().toUpperCase(),
    detail: (req.body.detail || '').trim().toUpperCase(),
    status: (req.body.status || '').trim().toUpperCase(),
    datetime: (req.body.datetime || '').trim().toUpperCase(),
  };

  const created = await userModel.createHelp(data);

  if (!created) {
    return error(res, 'Gagal mengirim pengajuan');
  }

  return success(res, null, 'Berhasil mengirim pengajuan');
});

const updateHelpStatus = asyncHandler(async (req, res) => {
  const id = parseInt(req.body.id || '0', 10);
  const status = (req.body.status || '').trim().toUpperCase();

  const updated = await userModel.updateHelpStatus(id, status);

  if (!updated) {
    return error(res, 'Gagal update pengajuan');
  }

  return success(res, null, 'Berhasil update pengajuan');
});

const getHelps = asyncHandler(async (req, res) => {
  const data = await userModel.getHelps(req.user.user_id);
  return success(res, data, 'Berhasil mengambil data pengajuan');
});

module.exports = { index, create, update, remove, getInitial, createHelp, updateHelpStatus, getHelps };
