const asyncHandler = require("express-async-handler");
require('dotenv').config();
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");
const User = require("../models/userModels");
const base64url = require("base64url");
const jwt = require('jsonwebtoken');
const {getUserByEmail,createUser,updateUserCounter} = require("../helper/DBHelper");
const transporter = require("../helper/transporter");
const generateAuthToken = require("../helper/generateAuthToken")

const CLIENT_URL = process.env.CLIENT_URL;
const RP_ID = process.env.RP_ID;

const initRegister = asyncHandler(async (req, res) => {
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

const verifyRegister = asyncHandler(async (req, res) => {
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

const initAuth = asyncHandler(async (req, res) => {
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

const verifyAuth = asyncHandler( async (req, res) => {
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

const sendOtp = asyncHandler(async (req, res) => {
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

const verifyOtp = asyncHandler(async (req, res) => {
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

module.exports = {
    initRegister,
    verifyRegister,
    initAuth,
    verifyAuth,
    sendOtp,
    verifyOtp
};
