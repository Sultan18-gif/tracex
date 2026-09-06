const express = require('express');
const router = express.Router();
const { runTrace, getMapData } = require('../controllers/traceController');

router.post('/:reportId', runTrace);
router.get('/:id/map-data', getMapData);

module.exports = router;