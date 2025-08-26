import express from "express";
import session from "express-session";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { generateState, generateCodeVerifier } from "arctic";
import { Google } from "arctic"; // ✅ use provider client

dotenv.config();

const app = express();
const port = 8080;
const prisma = new PrismaClient();

// 🟢 Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: false, // set true if using HTTPS in production
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

// 🟢 Initialize Arctic Google client
const google = new Google(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost:8080/callback" // must match Google Console settings
);

// 🟢 Login route
app.get("/login", async (req, res) => {
  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  // Save values in session for later verification
  req.session.state = state;
  req.session.codeVerifier = codeVerifier;

  // Build the Google auth URL
  const url = await google.createAuthorizationURL(state, codeVerifier, {
    scopes: ["openid", "email", "profile"],
  });

  res.redirect(url.toString());
});

// 🟢 Callback route
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  const state = req.query.state;

  if (!code || !state) {
    return res.status(400).send("Missing code or state");
  }

  if (state !== req.session.state) {
    return res.status(400).send("Invalid state");
  }

  try {
    // Exchange code + codeVerifier for tokens
    const tokens = await google.validateAuthorizationCode(
      code.toString(),
      req.session.codeVerifier
    );

    // Fetch user info from Google
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    const profile = await userInfoRes.json();

    // 1. Check if account exists (by providerAccountId)
    let account = await prisma.account.findUnique({
      where: { providerAccountId: profile.sub }, // Google's unique user ID
      include: { user: true },
    });

    let user;

    if (account) {
      // 2. If account exists, update tokens
      user = await prisma.user.update({
        where: { id: account.userId },
        data: {
          accounts: {
            update: {
              where: { id: account.id },
              data: {
                provider: "google",
                providerAccountId: profile.sub,
                // (Optional: add token storage fields here if you extend Account model)
              },
            },
          },
        },
      });
    } else {
      // 3. If account doesn’t exist, create new user + account
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          accounts: {
            create: {
              provider: "google",
              providerAccountId: profile.sub,
            },
          },
        },
      });
    }

    // 4. Save session
    req.session.userId = user.id;

    res.redirect("/dashboard");
  } catch (err) {
    console.error(err);
    res.status(500).send("OAuth Error");
  }
});


// 🟢 Protected route example
app.get("/dashboard", async (req, res) => {
  if (!req.session.userId) {
    return res.redirect("/login");
  }

  const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
  res.send(`Hello, ${user.name}! Your email is ${user.email}`);
});

app.listen(port, () => {
  console.log(` Server running at http://localhost:${port}`);
});
