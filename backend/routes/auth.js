const express = require("express");
const passport = require("passport");
const GitHubStrategy = require("passport-github2").Strategy;
const jwt = require("jsonwebtoken");
const User = require("../models/user");

const router = express.Router();

/* Passport Strategy */
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL
    },
    async (_, __, profile, done) => {
      let user = await User.findOne({ githubId: profile.id });

      if (!user) {
        user = await User.create({
          githubId: profile.id,
          username: profile.username,
          avatar: profile.photos[0].value
        });
      }

      done(null, user);
    }
  )
);

router.get("/github", passport.authenticate("github", { scope: ["user:email"] }));

router.get("/github/callback", passport.authenticate("github", { session: false }), (req, res) => {
    const token = jwt.sign(
      { id: req.user._id },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    const frontendBase = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
    res.redirect(`${frontendBase}/login-success?token=${token}`);
  }
);

module.exports = router;
