const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  githubId: {
    type: String,
    default: null
  },

  googleId: {
    type: String,
    default: null
  },

  username: {
    type: String
  },

  avatar: {
    type: String
  }
});

module.exports = mongoose.model("User", userSchema);