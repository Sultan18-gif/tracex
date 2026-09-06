const express = require("express");

const {
  createCase,
  getCases
} = require("../controllers/caseController");

const router = express.Router();

// Create case
router.post("/", createCase);

// Get all cases
router.get("/", getCases);

module.exports = router;