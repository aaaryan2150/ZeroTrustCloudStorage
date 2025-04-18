require('dotenv').config();
const jwt = require('jsonwebtoken');

const generateAuthToken = (user) => {
    return jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );
};

module.exports = generateAuthToken;