require('dotenv').config();
const jwt = require('jsonwebtoken');
const {getUserByEmail} = require("../helper/DBHelper");

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

module.exports = authenticateUser;