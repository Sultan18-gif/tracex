const express = require("express");

const {
  generateReport,
  getReports,
  getReport,
  deleteReport,
} = require("../controllers/reportController");

const router = express.Router();

/* =========================================================
   FORENSIC REPORTS
========================================================= */

/*
  Generate a new forensic report.
*/
router.post(
  "/generate",
  generateReport
);

/*
  Get all forensic reports.
*/
router.get(
  "/",
  getReports
);

/*
  Get one forensic report.
*/
router.get(
  "/:reportId",
  getReport
);

/*
  Delete a report.
*/
router.delete(
  "/:reportId",
  deleteReport
);

module.exports = router;