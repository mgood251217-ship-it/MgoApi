const { protect } = require('../middleware/AuthMiddleware');
const meterController = require('../controllers/MeterController');

module.exports = {
  meter_outdoor: { method: 'GET', middlewares: [protect], handler: meterController.getOutdoor },
  meter_indoor: { method: 'GET', middlewares: [protect], handler: meterController.getIndoor },
  meter_jersey: { method: 'GET', middlewares: [protect], handler: meterController.getJersey },
  meter_akrilik: { method: 'GET', middlewares: [protect], handler: meterController.getAkrilik },
  meter_laser: { method: 'GET', middlewares: [protect], handler: meterController.getLaser },
  meter_merchandise: { method: 'GET', middlewares: [protect], handler: meterController.getMerchandise },
  meter_sublim: { method: 'GET', middlewares: [protect], handler: meterController.getSublim },
  meter_mercendise_akrilik: {
    method: 'GET',
    middlewares: [protect],
    handler: meterController.getMercendiseAkrilik,
  },
  meter_dtf: { method: 'GET', middlewares: [protect], handler: meterController.getDtf },
  meter_cetakan: { method: 'GET', middlewares: [protect], handler: meterController.getCetakan },
  meter_bahan_sublim: { method: 'GET', middlewares: [protect], handler: meterController.getBahanSublim },
  meter_finishing_jersey: {
    method: 'GET',
    middlewares: [protect],
    handler: meterController.getFinishingJersey,
  },
};
