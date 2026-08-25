const express = require('express');
const { error } = require('../utils/response');
const authActions = require('./AuthRoutes');
const userActions = require('./UserRoutes');
const settingActions = require('./SettingRoutes');
const datasetActions = require('./DatasetRoutes');
const productActions = require('./ProductRoutes');

const actions = { ...authActions, ...userActions, ...settingActions, ...datasetActions, ...productActions };

function runMiddlewareChain(middlewares, req, res) {
  return new Promise((resolve, reject) => {
    let i = 0;

    function next(err) {
      if (err) return reject(err);
      const mw = middlewares[i++];
      if (!mw) return resolve();
      mw(req, res, next);
    }

    next();
  });
}

const router = express.Router();

router.all('/', async (req, res, next) => {
  const action = req.query.action;
  const route = actions[action];

  if (!route) {
    return error(res, `Action tidak ditemukan: ${action}`, 404);
  }

  if (req.method !== route.method) {
    return error(res, `Method ${req.method} tidak diizinkan untuk action ${action}`, 405);
  }

  try {
    await runMiddlewareChain(route.middlewares, req, res);
    await route.handler(req, res, next);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
