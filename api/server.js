require('dotenv').config();
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/DBConnections");
const User = require("./models/userModels");
const base64url = require("base64url");
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { put, del, list} = require('@vercel/blob');
const fileUpload = require('express-fileupload');
const serverless = require("serverless-http");

// Connect to MongoDB
connectDB();

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  useTempFiles: false
}));

const CLIENT_URL = "http://localhost:5173";
const RP_ID = "localhost";

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: "iqbgprjfmozfaqiv"
  }
});

// Rate limiting for MFA endpoints
const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per window
  message: 'Too many attempts, please try again later'
});

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

// Database helper functions
const getUserByEmail = async (email) => await User.findOne({ email });
const getUserById = async (id) => await User.findOne({ id });

const createUser = async (id, email, passKey) => {
  const encodedId = Buffer.isBuffer(passKey.id) ? 
    base64url.encode(passKey.id) : 
    passKey.id;
  const user = new User({
    id,
    email,
    passKey: {
      id: encodedId,
      publicKey: base64url.encode(passKey.publicKey),
      counter: passKey.counter,
      deviceType: passKey.deviceType,
      backedUp: passKey.backedUp,
      transports: passKey.transports,
    },
    mfaEnabled: true // Default MFA state
  });
  await user.save();
};

const updateUserCounter = async (id, counter) => {
  await User.updateOne({ id }, { "passKey.counter": counter });
};

// Registration Flow
app.get("/init-register", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Email required" });

    const existingUser = await getUserByEmail(email);
    if (existingUser) return res.status(400).json({ error: "User exists" });

    const options = await generateRegistrationOptions({
      rpID: RP_ID,
      rpName: "WebAuthn Demo",
      userName: email,
    });

    res.cookie("regInfo", JSON.stringify({
      userId: options.user.id,
      email,
      challenge: options.challenge
    }), { httpOnly: true, maxAge: 60000, secure: true });

    res.json(options);
  } catch (error) {
    console.error("Init register error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/verify-register", async (req, res) => {
  try {
    const regInfo = JSON.parse(req.cookies.regInfo || "null");
    if (!regInfo) return res.status(400).json({ error: "Registration info missing" });

    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge: regInfo.challenge,
      expectedOrigin: CLIENT_URL,
      expectedRPID: RP_ID,
    });

    if (!verification.verified) {
      return res.status(400).json({ verified: false, error: "Verification failed" });
    }

    await createUser(regInfo.userId, regInfo.email, {
      id: verification.registrationInfo.credentialID,
      publicKey: verification.registrationInfo.credentialPublicKey,
      counter: verification.registrationInfo.counter,
      deviceType: verification.registrationInfo.credentialDeviceType,
      backedUp: verification.registrationInfo.credentialBackedUp,
      transports: req.body.transports || [],
    });

    res.clearCookie("regInfo");
    res.json({ verified: true });
  } catch (error) {
    console.error("Verify register error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Authentication Flow
app.get("/init-auth", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "Email required" });

    const user = await getUserByEmail(email);
    console.log(user);
    
    if (!user) return res.status(400).json({ error: "User not found" });

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: [{
        id: user.passKey.id,
        type: "public-key",
        transports: user.passKey.transports || [],
      }],
    });

    res.cookie("authInfo", JSON.stringify({
      userId: user._id.toString(),
      challenge: options.challenge
    }), { httpOnly: true, maxAge: 60000, secure: true });

    res.json(options);
  } catch (error) {
    console.error("Init auth error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/verify-auth", async (req, res) => {
  try {
    const authInfo = JSON.parse(req.cookies.authInfo || "null");
    if (!authInfo) return res.status(400).json({ error: "Authentication info missing" });
    
    const user = await User.findById(authInfo.userId);
    if (!user || user.passKey.id !== req.body.id) {
      return res.status(400).json({ error: "Invalid user" });
    }

    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge: authInfo.challenge,
      expectedOrigin: CLIENT_URL,
      expectedRPID: RP_ID,
      authenticator: {
        credentialID: base64url.toBuffer(user.passKey.id),
        credentialPublicKey: base64url.toBuffer(user.passKey.publicKey),
        counter: user.passKey.counter,
        transports: user.passKey.transports,
      },
    });

    if (!verification.verified) {
      return res.status(400).json({ verified: false, error: "Verification failed" });
    }

    await updateUserCounter(user.id, verification.authenticationInfo.newCounter);
    res.clearCookie("authInfo");

    // MFA Check
    // if (user.mfaEnabled) {
    //   const otp = Math.floor(100000 + Math.random() * 900000).toString();
    //   const otpExpiry = Date.now() + 300000;
      
    //   await User.updateOne({ _id: user._id }, { 
    //     otp,
    //     otpExpiry,
    //     lastMfaAttempt: Date.now()
    //   });

    //   try {
    //     await transporter.sendMail({
    //       from: `"Secure App" <${process.env.EMAIL_USER}>`,
    //       to: user.email,
    //       subject: 'Your MFA Verification Code',
    //       text: `Your verification code is: ${otp}\nThis code expires in 5 minutes.`,
    //       html: `<b>${otp}</b> <p>This code expires in 5 minutes.</p>`
    //     });
    //   } catch (emailError) {
    //     console.error('Email send error:', emailError);
    //     return res.status(500).json({ error: 'Failed to send MFA email' });
    //   }

    //   return res.json({ 
    //     verified: true, 
    //     mfaRequired: true,
    //     message: "MFA code sent to registered email"
    //   });
    // }

    // Generate final token for non-MFA users
    // const authToken = generateAuthToken(user);
    // return res.json({ 
    //   verified: true, 
    //   mfaRequired: false,
    //   user: { id: user.id, email: user.email },
    //   token: authToken
    // });

  } catch (error) {
    console.error("Verify auth error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// MFA Endpoints
app.post('/mfa/send-otp', mfaLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const user = await getUserByEmail(email);
    console.log(user);
    
    if (!user) return res.status(404).json({ error: 'User not found' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = Date.now() + 300000;

    await User.updateOne({ email }, { 
      otp,
      otpExpiry,
      lastMfaAttempt: Date.now()
    });

    await transporter.sendMail({
      from: `"Secure App" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your MFA Verification Code',
      text: `Your verification code is: ${otp}`,
      html: `<b>${otp}</b> <p>This code expires in 5 minutes.</p>`
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Failed to process MFA request' });
  }
});

app.post('/mfa/verify-otp', mfaLimiter, async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await getUserByEmail(email);
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.otpExpiry < Date.now()) return res.status(400).json({ error: 'OTP expired' });
    if (user.otp !== otp) return res.status(400).json({ error: 'Invalid OTP' });

    // Clear OTP and generate final token
    await User.updateOne({ email }, { 
      otp: null,
      otpExpiry: null,
      lastMfaAttempt: null
    });

    const authToken = generateAuthToken(user);
    res.json({ 
      verified: true,
      user: { id: user.id, email: user.email },
      token: authToken
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'MFA verification failed' });
  }
});

// Helper functions
const generateAuthToken = (user) => {
  return jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
};

// User Info Endpoint - Add this to your server.js file
app.get("/api/user-info", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Return user information (exclude sensitive data)
    res.json({
      id: user.id,
      email: user.email,
      // Add other non-sensitive user information as needed
    });
  } catch (error) {
    console.error('Error getting user info:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    res.status(500).json({ error: 'Server error' });
  }
});


// Add this middleware to authenticate requests
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await getUserByEmail(decoded.email);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    res.status(500).json({ error: 'Server error' });
  }
};

// File Upload endpoint
app.post('/api/upload', authenticateUser, async (req, res) => {
  try {
    if (!req.files || Object.keys(req.files).length === 0) {
      return res.status(400).json({ error: 'No files were uploaded' });
    }

    const files = Array.isArray(req.files.files) ? req.files.files : [req.files.files];
    const uploadResults = [];

    for (const file of files) {
      // Create a unique file path with user ID to separate files by user
      const fileName = `${req.user.id}/${Date.now()}-${file.name}`;
      
      // Upload to Vercel Blob
      const blob = await put(fileName, file.data, {
        access: 'public', // Use private for user files
        contentType: file.mimetype
      });

      // Save file metadata to your database
      // This depends on your database model, but you'd want to store:
      // - blob.url (for retrieval)
      // - blob.pathname (for deletion)
      // - file.name (original filename)
      // - file.size
      // - req.user.id (owner)
      
      // Add file to database (implement according to your DB model)
      // Example:
      // const newFile = new File({
      //   userId: req.user.id,
      //   name: file.name,
      //   size: file.size,
      //   blobUrl: blob.url,
      //   blobPathname: blob.pathname
      // });
      // await newFile.save();
      
      uploadResults.push({
        name: file.name,
        size: file.size,
        url: blob.url
      });
    }

    res.status(200).json({ success: true, files: uploadResults });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'File upload failed' });
  }
});

// List files endpoint
app.get('/api/files', authenticateUser, async (req, res) => {
  try {
    // Retrieve files for the authenticated user from your database
    // Example:
    // const files = await File.find({ userId: req.user.id });
    
    // For demo purposes, let's list blobs with the user's ID prefix
    // In production, you should query your database instead
    const { blobs } = await list({ prefix: `${req.user.id}/` });
    
    const files = blobs.map(blob => ({
      id: blob.pathname,
      name: blob.pathname.split('/').pop().substring(14), // Remove timestamp prefix
      size: blob.size,
      url: blob.url
    }));
    
    res.json(files);
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: 'Failed to retrieve files' });
  }
});

// Download file endpoint
app.get('/api/download/:fileId(*)', authenticateUser, async (req, res) => {
  try {
    const fileId = req.params.fileId;
    console.log(fileId);
    
    
    // In production, verify this file belongs to the user by checking your database
    // Example:
    // const file = await File.findOne({ _id: fileId, userId: req.user.id });
    // if (!file) return res.status(404).json({ error: 'File not found' });
    
    // Generate a signed URL for the blob that expires after a short time
    const signedUrl = await get(fileId, { expires: 60 * 5 }); // 5 minute expiry
    
    res.json({ url: signedUrl.url });
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Delete file endpoint
app.delete('/api/files/:fileId(*)', authenticateUser, async (req, res) => {
  try {
    const fileId = req.params.fileId;
    
    // In production, verify this file belongs to the user by checking your database
    // Example:
    // const file = await File.findOne({ _id: fileId, userId: req.user.id });
    // if (!file) return res.status(404).json({ error: 'File not found' });
    
    // Delete from Vercel Blob
    await del(fileId);
    
    // Remove from your database
    // Example:
    // await File.deleteOne({ _id: fileId });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});


// app.listen(3000, () => {
//   console.log("Server running on http://localhost:3000");
// });

module.exports.handler = serverless(app);