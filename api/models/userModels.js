const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  email: { type: String, unique: true, required: true },
  passKey: {
    id: { type: String, required: true },          // base64url encoded
    publicKey: { type: String, required: true },   // base64url encoded
    counter: { type: Number, required: true },
    deviceType: String,
    backedUp: Boolean,
    transports: [String],
  },
  mfaEnabled: { type: Boolean, default: false },
  otp: String,
  otpExpiry: Date,
  lastMfaAttempt: Date  // Add this new field
});

const User = mongoose.model("User", userSchema);
module.exports = User;
