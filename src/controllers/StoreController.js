const asyncHandler = require('../middleware/asyncHandler');
const { success, error } = require('../utils/response');
const { updateStoreCache } = require('../utils/cacheHelpers');
const storeModel = require('../models/Store');

const store = asyncHandler(async (req, res) => {
  const storeData = await storeModel.getStoreById(req.user.store_id);
  return success(res, storeData, 'Berhasil mengambil data Store');
});

const createMachine = asyncHandler(async (req, res) => {
  const data = {
    name: (req.body.name || '').trim(),
    type: (req.body.type || '').trim(),
    store_id: req.user.store_id,
  };

  const created = await storeModel.createMachine(data);

  if (!created) {
    return error(res, 'Gagal menyimpan data ke database', 500);
  }

  updateStoreCache(req.user.store_id, 'machines');
  return success(res, null, 'Mesin baru berhasil ditambahkan.');
});

const updateMachine = asyncHandler(async (req, res) => {
  const data = {
    name: (req.body.name || '').trim(),
    type: (req.body.type || '').trim(),
    machine_id: (req.body.machine_id || '').trim(),
  };

  const updated = await storeModel.updateMachine(data);

  if (!updated) {
    return error(res, 'Gagal menyimpan data ke database', 500);
  }

  updateStoreCache(req.user.store_id, 'machines');
  return success(res, null, 'Mesin berhasil diperbaharui.');
});

const deleteMachine = asyncHandler(async (req, res) => {
  const id = req.body.machine_id || 0;

  const deleted = await storeModel.deleteMachine(id, req.user.store_id);

  if (!deleted) {
    return error(res, 'Gagal menghapus mesin', 500);
  }

  updateStoreCache(req.user.store_id, 'machines');
  return success(res, null, 'Mesin berhasil dihapus.');
});

const machines = asyncHandler(async (req, res) => {
  const machineList = await storeModel.getMachineByStoreId(req.user.store_id);
  return success(res, machineList, 'Berhasil mengambil data mesin');
});

const storeName = asyncHandler(async (req, res) => {
  const stores = await storeModel.getStoreForMaklun(req.user.store_id);
  return success(res, stores, 'Berhasil mengambil data mesin');
});

module.exports = { store, createMachine, updateMachine, deleteMachine, machines, storeName };
