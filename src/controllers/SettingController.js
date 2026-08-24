const path = require('path');
const fs = require('fs');
const asyncHandler = require('../middleware/asyncHandler');
const { success, error } = require('../utils/response');
const settingModel = require('../models/Setting');

const appVersion = asyncHandler(async (req, res) => {
  const filePath = path.join(__dirname, 'version.json');

  if (!fs.existsSync(filePath)) {
    return error(res, 'Version info tidak ditemukan.', 404);
  }

  let data;

  try {
    data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return error(res, 'Format version.json tidak valid.', 500);
  }

  return success(res, data, 'OK');
});

const limit = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const customerLimit = req.body.limit || 0;

  if (await settingModel.cekUserSetting(userId)) {
    await settingModel.updateOneValue(userId, 'customer_limit', customerLimit);
  } else {
    await settingModel.create({ user_id: userId, customer_limit: customerLimit });
  }

  return success(res, null, 'Berhasil diperbarui.');
});

const updatePreviewPrint = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;

  if (await settingModel.cekUserSetting(userId)) {
    const oldValue = Number(await settingModel.getOneValue(userId, 'preview_print'));
    const newValue = oldValue === 1 ? 0 : 1;
    await settingModel.updateOneValue(userId, 'preview_print', newValue);
  } else {
    await settingModel.create({ user_id: userId, preview_print: 1 });
  }

  return success(res, null, 'Berhasil diperbarui.');
});

const changeTheme = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;

  if (req.body.mode === undefined) {
    return error(res, 'Gagal menyimpan data ke database');
  }

  const newMode = Number(req.body.mode) === 1 ? 1 : 0;
  let result;

  if (await settingModel.cekUserSetting(userId)) {
    result = await settingModel.updateOneValue(userId, 'mode', newMode);
  } else {
    result = await settingModel.create({
      user_id: userId,
      mode: newMode,
      preview_print: 0,
      customer_limit: 0,
    });
  }

  if (!result) {
    return error(res, 'Gagal menyimpan data ke database');
  }

  return success(res, null, 'Tema berhasil disimpan');
});

module.exports = { appVersion, limit, updatePreviewPrint, changeTheme };
