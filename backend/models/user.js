const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  githubId: { type: String, required: true },
  username: String,
  avatar: String
});

module.exports = mongoose.model("User", userSchema);
