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
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const {getUserByEmail,createUser,updateUserCounter} = require("../helper/DBHelper");

const CLIENT_URL = process.env.CLIENT_URL;
const RP_ID = process.env.RP_ID;

const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'Gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

module.exports = transporter;