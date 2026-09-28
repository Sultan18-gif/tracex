const express = require("express");

const router = express.Router();

const {
  getVASPs,
  getVASP,
  createVASP,
  updateVASP,
  deleteVASP,
} = require("../controllers/vaspController");

router.get("/", getVASPs);

router.get("/:vaspId", getVASP);

router.post("/", createVASP);

router.put("/:vaspId", updateVASP);

router.delete("/:vaspId", deleteVASP);

module.exports = router;