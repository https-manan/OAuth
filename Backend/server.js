const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { generateState, generateCodeVerifier, Google } = require('arctic');
const session = require('express-session');
require('dotenv').config();

const app = express();
const port = 8080;
const prisma = new PrismaClient();

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: false,
    maxAge: 1000 * 60 * 60 * 24
  }
}));

const google = new Google(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost:8080/google/callback"
);

app.get('/', async (req, res) => {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  const url = await google.createAuthorizationURL(
    state,
    codeVerifier,
    ["https://www.googleapis.com/auth/userinfo.email", "https://www.googleapis.com/auth/userinfo.profile", "openid"]
  );

  req.session.state = state;
  req.session.codeVerifier = codeVerifier;
  res.redirect(url.toString());
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});