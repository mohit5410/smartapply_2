const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { generateToken, auth } = require('../middleware/auth');

// POST /api/auth/login — returns user with all roles
router.post('/login', async (req, res) => {
  try {
    const { userId, password } = req.body;
    if (!userId || !password) return res.status(400).json({ error: 'User ID and password required' });
    const user = await User.findOne({ userId: { $regex: new RegExp(`^${userId}$`, 'i') }, isActive: true });
    if (!user) return res.status(401).json({ error: 'Invalid User ID or Password' });
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid User ID or Password' });

    const userJson = user.toJSON();

    // If user has only 1 role, auto-select it and return token
    if (user.roles.length === 1) {
      const r = user.roles[0];
      const token = generateToken(user, r.role, { deptId: r.deptId, program: r.program, semester: r.semester, section: r.section });
      return res.json({ token, user: userJson, activeRole: r.role, roleData: r.toObject(), needsRoleSelect: false });
    }

    // Multiple roles — return user without token, frontend must call /select-role
    res.json({ user: userJson, needsRoleSelect: true, tempUserId: user._id });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/auth/select-role — after login, pick which role to use
router.post('/select-role', async (req, res) => {
  try {
    const { tempUserId, roleId } = req.body;
    if (!tempUserId || !roleId) return res.status(400).json({ error: 'Missing data' });
    const user = await User.findById(tempUserId);
    if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid user' });
    const roleAssignment = user.roles.id(roleId);
    if (!roleAssignment) return res.status(400).json({ error: 'Invalid role selection' });
    const token = generateToken(user, roleAssignment.role, {
      deptId: roleAssignment.deptId, program: roleAssignment.program,
      semester: roleAssignment.semester, section: roleAssignment.section
    });
    res.json({ token, user: user.toJSON(), activeRole: roleAssignment.role, roleData: roleAssignment.toObject() });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/auth/change-password
router.post('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
    if (newPassword.length < 4) return res.status(400).json({ error: 'Min 4 characters' });
    const isMatch = await req.user.comparePassword(currentPassword);
    if (!isMatch) return res.status(400).json({ error: 'Current password is wrong' });
    req.user.password = newPassword;
    await req.user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user.toJSON(), activeRole: req.activeRole, roleData: req.roleData });
});

module.exports = router;
