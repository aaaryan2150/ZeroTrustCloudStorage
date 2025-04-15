const mongoose = require("mongoose");

// MongoDB connection function
async function connectDB() {
  try {
    await mongoose.connect("mongodb+srv://Aaryan:kwPTXfB4IjIb8P5Q@cluster0.vk2lrvq.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0", {
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
