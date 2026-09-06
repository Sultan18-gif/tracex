const generateReport = async (req, res) => {
  try {
    const { caseId } = req.body;

    res.json({
      caseId,
      reportStatus: "Generated",
      message: "Investigation report generated successfully"
    });

  } catch (error) {
    res.status(500).json({
      message: "Unable to generate report"
    });
  }
};

module.exports = {
  generateReport
};