const asyncHandler = require('../middleware/asyncHandler');
const { success } = require('../utils/response');
const { updateStoreCache } = require('../utils/cacheHelpers');
const locationModel = require('../models/Location');

const index = asyncHandler(async (req, res) => {
  const locations = await locationModel.getAllLocation();
  return success(res, locations);
});

const setLocation = asyncHandler(async (req, res) => {
  const data = {
    store_id: req.user.store_id,
    latitude: req.body.latitude || null,
    longitude: req.body.longitude || null,
  };

  if (await locationModel.checkLocation(data.store_id)) {
    await locationModel.updateLocation(data);
  } else {
    await locationModel.createLocation(data);
  }

  updateStoreCache(data.store_id, 'locations');
  return success(res, null, 'Lokasi berhasil diperbarui.');
});

module.exports = { index, setLocation };
