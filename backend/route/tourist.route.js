// 'use strict';
// const router = require('express').Router();
// const touristController = require('../controller/tourist.controller');
// const { auth } = require('../middleware/auth.middleware');

// router.post('/register', auth, touristController.registerTourist);
// router.post('/location', touristController.locationUpdate);
// router.get('/verify/:touristId', auth, touristController.verifyTourist);

// module.exports = router;

// --->
// 'use strict';
// const router = require('express').Router();
// const touristController = require('../controller/trip.controller.js');
// const mlController = require('../controller/ml.controller.js')

// const { auth, requireRole } = require('../middleware/auth.middleware.js');

// // register primary (walletId) + family digitalIds after KYC approved
// router.post('/register', auth, requireRole(['tourist']), touristController.registerTourist);

// // location update (existing)
// router.post('/location-update',  touristController.locationUpdate);

// // verify on-chain
// router.get('/verify/:touristId', auth, touristController.verifyTourist);

// router.post('/predict_anomaly', auth,  mlController.predictAnomaly);
// router.post('/geofence', auth, mlController.geofence);


// router.post('/add_geofence',auth, mlController.addGeofence)

// module.exports = router;

'use strict';
const router = require('express').Router();
const touristController = require('../controller/tourist01.controller.js');
const { auth, requireRole } = require('../middleware/auth.middleware');
const parser = require('../middleware/upload.middleware.js');
const SosAlert = require('../models/alert.model.js');

// Tourist Routes
router.post('/register', auth, requireRole(['tourist']), touristController.registerTourist);
router.post('/location', auth, requireRole(['tourist']), touristController.locationUpdate);
router.post('/sos', auth, requireRole(['tourist']), touristController.sosAlert);
router.post('/feedback', auth, requireRole(['tourist']), touristController.submitFeedback);
router.post('/efir', auth, requireRole(['tourist']), parser.single('evidence'), touristController.fileEFIR);

// Verification and Details Routes
router.get('/verify/:touristId', auth, touristController.verifyTourist);
router.get('/details/:touristId', auth, requireRole(['tourist']), touristController.getTouristDetails);

// Add the missing stats and alerts routes with proper handlers
router.get('/stats', auth, requireRole(['tourist']), touristController.getTouristStats);
router.get('/alerts/list', auth, requireRole(['tourist']), touristController.getAlerts);

// Authority Routes
router.patch('/status', auth, requireRole(['police', 'admin']), touristController.updateTouristStatus);
router.post('/sos/respond', auth, requireRole(['police', 'admin']), touristController.respondToSOS);

module.exports = router;
