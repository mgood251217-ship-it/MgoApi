const asyncHandler = require('../middleware/asyncHandler');
const { success } = require('../utils/response');
const { getStoreDataset } = require('../utils/cacheHelpers');

const checkUpdateDataset = asyncHandler(async (req, res) => {
  const data = getStoreDataset(req.user.store_id);
  return success(res, data, 'success');
});

module.exports = { checkUpdateDataset };
