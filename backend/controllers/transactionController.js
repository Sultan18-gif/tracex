const getTransactions = async (req, res) => {
  try {
    const { address } = req.params;

    res.json({
      walletAddress: address,
      transactions: []
    });

  } catch (error) {
    res.status(500).json({
      message: "Unable to fetch transactions"
    });
  }
};

module.exports = {
  getTransactions
};