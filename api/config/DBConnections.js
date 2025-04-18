const mongoose = require("mongoose");
require('dotenv').config();

const url = process.env.CONNECTION_URL;

// MongoDB connection function
async function connectDB() {
  try {
    await mongoose.connect(url, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1); // Exit the process if connection fails
  }
}

module.exports = connectDB;
