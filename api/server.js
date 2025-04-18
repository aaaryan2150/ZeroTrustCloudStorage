require('dotenv').config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const connectDB = require("./config/DBConnections");
const fileUpload = require('express-fileupload');

const CLIENT_URL = process.env.CLIENT_URL;

// Connect to MongoDB
connectDB();

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  useTempFiles: false
}));
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

app.use('/',require("./routes/userRoutes"));
app.use('/',require("./routes/dashboardRoutes"));

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});

