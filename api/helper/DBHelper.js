require('dotenv').config();
const User = require("../models/userModels");
const base64url = require("base64url");


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

module.exports = {getUserByEmail,getUserById,createUser,updateUserCounter};