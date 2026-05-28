const getTestMessage = (req, res) => {
  res.status(200).json({ message: "API is working" });
};

const getProtectedMessage = (req, res) => {
  res.status(200).json({
    message: "Protected route access granted",
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
    },
  });
};

module.exports = {
  getTestMessage,
  getProtectedMessage,
};
