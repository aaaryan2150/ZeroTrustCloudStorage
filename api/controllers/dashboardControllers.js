const asyncHandler = require("express-async-handler");
require('dotenv').config();
const jwt = require('jsonwebtoken');
const { put, del, list} = require('@vercel/blob');
const {getUserByEmail,updateUserCounter} = require("../helper/DBHelper");
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} = require("@simplewebauthn/server");
const CLIENT_URL = process.env.CLIENT_URL;
const RP_ID = process.env.RP_ID;
const User = require("../models/userModels");
const base64url = require("base64url");




const loadUserInfo = asyncHandler(async (req, res) => {
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

const uploadFiles = asyncHandler(async (req, res) => {
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

const listFiles = asyncHandler(async (req, res) => {
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

const downloadFiles = asyncHandler(async (req, res) => {
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

const deleteFiles = asyncHandler(async (req, res) => {
    try {
      const fileId = req.params.fileId;

      // Delete from Vercel Blob
      await del(fileId);
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
});

const deleteInitAuth = asyncHandler(async (req, res) => {
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
      console.log("STEP 1 SUCCESS");
      
    } catch (error) {
      console.error("Init auth error:", error);
      res.status(500).json({ error: "Server error" });
    }
});

const deleteVerifyAuth = asyncHandler( async (req, res) => {
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
      console.log("STEP 2 SUCCESS");
      res.json({ verified: true });
      
    } catch (error) {
      console.error("Verify auth error:", error);
      res.status(500).json({ error: "Server error" });
    }
});


module.exports = {
    loadUserInfo,
    uploadFiles,
    listFiles,
    downloadFiles,
    deleteFiles,
    deleteInitAuth,
    deleteVerifyAuth
}
