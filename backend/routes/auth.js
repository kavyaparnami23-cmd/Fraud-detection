const express = require("express");
const passport = require("passport");

const GitHubStrategy = require("passport-github2").Strategy;
const GoogleStrategy = require("passport-google-oauth20").Strategy;

const jwt = require("jsonwebtoken");
const User = require("../models/user");

const router = express.Router();

/* =========================
   GitHub OAuth Strategy
========================= */

passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: process.env.GITHUB_CALLBACK_URL
    },

    async (_, __, profile, done) => {
      try {
        let user = await User.findOne({
          githubId: profile.id
        });

        if (!user) {
          user = await User.create({
            githubId: profile.id,
            username: profile.username || profile.displayName,
            avatar: profile.photos?.[0]?.value || ""
          });
        }

        done(null, user);
      } catch (error) {
        done(error, null);
      }
    }
  )
);


/* =========================
   Google OAuth Strategy
========================= */

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },

    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({
          googleId: profile.id
        });

        if (!user) {
          user = await User.create({
            googleId: profile.id,
            username:
              profile.displayName ||
              profile.name?.givenName ||
              "Google User",
            avatar: profile.photos?.[0]?.value || ""
          });
        }

        done(null, user);
      } catch (error) {
        done(error, null);
      }
    }
  )
);


/* =========================
   GitHub Login
========================= */

router.get(
  "/github",
  passport.authenticate("github", {
    scope: ["user:email"]
  })
);


/* =========================
   GitHub Callback
========================= */

router.get(
  "/github/callback",
  passport.authenticate("github", {
    session: false
  }),

  (req, res) => {
    const token = jwt.sign(
      {
        id: req.user._id
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d"
      }
    );

    const frontendBase = (
      process.env.FRONTEND_URL || "http://localhost:5173"
    ).replace(/\/$/, "");

    res.redirect(
      `${frontendBase}/login-success?token=${token}`
    );
  }
);


/* =========================
   Google Login
========================= */

router.get(
  "/google",
  passport.authenticate("google", {
    scope: ["profile", "email"]
  })
);


/* =========================
   Google Callback
========================= */

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false
  }),

  (req, res) => {
    const token = jwt.sign(
      {
        id: req.user._id
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d"
      }
    );

    const frontendBase = (
      process.env.FRONTEND_URL || "http://localhost:5173"
    ).replace(/\/$/, "");

    res.redirect(
      `${frontendBase}/login-success?token=${token}`
    );
  }
);


module.exports = router;