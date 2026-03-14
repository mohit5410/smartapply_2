const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Token includes activeRole and roleData (selected at login)
function generateToken(user, activeRole, roleData) {
  return jwt.sign(
    { id: user._id, userId: user.userId, activeRole, roleData },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

async function auth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid token' });
    req.user = user;
    req.activeRole = decoded.activeRole;   // "admin", "student", "coordinator", "pl", "hod"
    req.roleData = decoded.roleData || {}; // { deptId, program, semester, section }
    req.token = token;
    next();
  } catch (err) { res.status(401).json({ error: 'Authentication failed' }); }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.activeRole)) return res.status(403).json({ error: 'Access denied for this role' });
    next();
  };
}

module.exports = { generateToken, auth, requireRole };
