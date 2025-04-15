const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server")
const express = require("express")
const cors = require("cors")
const cookieParser = require("cookie-parser")
const {
  getUserByEmail,
  createUser,
  updateUserCounter,
  getUserById,
} = require("./db")

const app = express()
app.use(express.json())
app.use(cookieParser())

const CLIENT_URL = "http://localhost:5174"
const RP_ID = "localhost"

// app.use(cors({ origin: CLIENT_URL, credentials: true }))

const allowedOrigins = ["http://localhost:5174", "http://localhost:5174"];

app.use(cors({
    origin: function (origin, callback) {
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
}));

app.get("/init-register", async (req, res) => {
  const email = req.query.email
  if (!email) {
    return res.status(400).json({ error: "Email is required" })
  }

  if (getUserByEmail(email) != null) {
    return res.status(400).json({ error: "User already exists" })
  }

  const options = await generateRegistrationOptions({
    rpID: RP_ID,
    rpName: "Web Dev Simplified",
    userName: email,
  })

  res.cookie(
    "regInfo",
    JSON.stringify({
      userId: options.user.id,
      email,
      challenge: options.challenge,
    }),
    { httpOnly: true, maxAge: 60000, secure: true }
  )

  res.json(options)
})

app.post("/verify-register", async (req, res) => {
  const regInfo = JSON.parse(req.cookies.regInfo)

  if (!regInfo) {
    return res.status(400).json({ error: "Registration info not found" })
  }

  const verification = await verifyRegistrationResponse({
    response: req.body,
    expectedChallenge: regInfo.challenge,
    expectedOrigin: CLIENT_URL,
    expectedRPID: RP_ID,
  })

  if (verification.verified) {
    createUser(regInfo.userId, regInfo.email, {
      id: verification.registrationInfo.credentialID,
      publicKey: verification.registrationInfo.credentialPublicKey,
      counter: verification.registrationInfo.counter,
      deviceType: verification.registrationInfo.credentialDeviceType,
      backedUp: verification.registrationInfo.credentialBackedUp,
      transport: req.body.transports,
    })
    res.clearCookie("regInfo")
    return res.json({ verified: verification.verified })
  } else {
    return res
      .status(400)
      .json({ verified: false, error: "Verification failed" })
  }
})

app.get("/init-auth", async (req, res) => {
  const email = req.query.email
  if (!email) {
    return res.status(400).json({ error: "Email is required" })
  }

  const user = getUserByEmail(email)
  if (user == null) {
    return res.status(400).json({ error: "No user for this email" })
  }

  console.log("type:", typeof(user.passKey.id));
  

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    allowCredentials: [
      {
        id: user.passKey.id,
        type: "public-key",
        transports: user.passKey.transports,
      },
    ],
  })

  res.cookie(
    "authInfo",
    JSON.stringify({
      userId: user.id,
      challenge: options.challenge,
    }),
    { httpOnly: true, maxAge: 60000, secure: true }
  )

  res.json(options)
})

app.post("/verify-auth", async (req, res) => {
  try {
    const authInfo = JSON.parse(req.cookies.authInfo || "null");
    if (!authInfo) return res.status(400).json({ error: "Authentication info missing" });

    const user = await getUserById(authInfo.userId);
    
    // Debug logs
    console.log("User:", user);
    console.log("User passKey ID:", user?.passKey?.id);
    console.log("Request ID:", req.body.id);

    if (!user || !user.passKey?.id) {
      return res.status(400).json({ error: "Invalid user" });
    }

    // Convert both IDs to same format for comparison
    const storedId = base64url.encode(user.passKey.id);
    if (storedId !== req.body.id) {
      return res.status(400).json({ error: "Credential mismatch" });
    }

    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge: authInfo.challenge,
      expectedOrigin: CLIENT_URL,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: user.passKey.id,
        credentialPublicKey: user.passKey.publicKey,
        counter: user.passKey.counter,
        transports: user.passKey.transports,
      },
    });

    if (!verification.verified) {
      return res.status(400).json({ verified: false, error: "Verification failed" });
    }

    await updateUserCounter(user.id, verification.authenticationInfo.newCounter);
    res.clearCookie("authInfo");
    res.json({ verified: true });
    
  } catch (error) {
    console.error("Verify auth error:", error);
    res.status(500).json({ error: "Server error: " + error.message });
  }
});


app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000")
})
