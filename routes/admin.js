const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const User = require('../models/User');
const { auth, requireRole } = require('../middleware/auth');
const { sendEmail, credentialsEmail } = require('../middleware/email');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
router.use(auth, requireRole('admin'));

// GET /api/admin/staff — all staff (with their roles)
router.get('/staff', async (req, res) => {
  try {
    const staff = await User.find({
      'roles.role': { $in: ['coordinator', 'pl', 'hod'] },
      isActive: true
    }).sort({ name: 1 });
    res.json({ staff });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/admin/staff — create user OR add role to existing user
router.post('/staff', async (req, res) => {
  try {
    const { userId, password, name, email, role, deptId, program, semester, section } = req.body;
    if (!userId || !name || !role) return res.status(400).json({ error: 'userId, name, and role are required' });
    if (!['coordinator', 'pl', 'hod'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

    const roleData = { role };
    if (role === 'hod') { if (!deptId) return res.status(400).json({ error: 'Department required for HOD' }); roleData.deptId = deptId; }
    if (role === 'pl') {
      if (!program || !semester || !section) return res.status(400).json({ error: 'Program/semester/section required for PL' });
      roleData.deptId = program; // Will be mapped
      roleData.program = program; roleData.semester = parseInt(semester); roleData.section = section;
    }

    // Check if user already exists
    let user = await User.findOne({ userId: { $regex: new RegExp(`^${userId}$`, 'i') } });

    if (user) {
      // User exists — check if they already have this exact role
      const duplicate = user.roles.find(r => {
        if (r.role !== role) return false;
        if (role === 'hod') return r.deptId === deptId;
        if (role === 'pl') return r.program === program && r.semester === parseInt(semester) && r.section === section;
        if (role === 'coordinator') return true; // only one coordinator role needed
        return false;
      });
      if (duplicate) return res.status(400).json({ error: 'User already has this exact role assignment' });

      // Add new role to existing user
      user.roles.push(roleData);
      if (email && !user.email) user.email = email;
      if (name && user.name !== name) user.name = name;
      user.isActive = true;
      await user.save();

      res.status(200).json({ user: user.toJSON(), message: `Role "${role}" added to existing user ${userId}. Now has ${user.roles.length} role(s).` });
    } else {
      // New user — password required
      if (!password) return res.status(400).json({ error: 'Password required for new user' });
      user = new User({ userId, password, name, email, roles: [roleData] });
      await user.save();

      if (email) {
        const emailData = credentialsEmail(user, password);
        sendEmail(email, emailData.subject, emailData.html);
      }
      res.status(201).json({ user: user.toJSON(), message: `User "${userId}" created with role "${role}". Credentials sent.` });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/admin/staff/:userId/role/:roleId — remove specific role from user
router.delete('/staff/:userId/role/:roleId', async (req, res) => {
  try {
    const user = await User.findOne({ userId: req.params.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.roles = user.roles.filter(r => r._id.toString() !== req.params.roleId);

    // If no roles left (other than student), deactivate
    const staffRoles = user.roles.filter(r => ['coordinator', 'pl', 'hod'].includes(r.role));
    if (staffRoles.length === 0 && !user.hasRole('student') && !user.hasRole('admin')) {
      user.isActive = false;
    }
    await user.save();
    res.json({ message: 'Role removed', user: user.toJSON() });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET /api/admin/students
router.get('/students', async (req, res) => {
  try {
    const students = await User.find({ 'roles.role': 'student', isActive: true }).sort({ name: 1 });
    res.json({ students });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/admin/students/upload
router.post('/students/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    const students = json.map(r => ({
      userId: String(r.UserID || r.userid || r.UserId || '').trim(),
      password: String(r.Password || r.password || '').trim(),
      name: String(r.Name || r.name || '').trim(),
      fatherName: String(r.FatherName || r.fatherName || r.Father || r['Father Name'] || r["Father's Name"] || '').trim(),
      motherName: String(r.MotherName || r.motherName || r.Mother || r['Mother Name'] || r["Mother's Name"] || '').trim(),
      enrollmentNo: String(r.EnrollmentNo || r.enrollmentNo || r.Enrollment || r['Enrollment No'] || '').trim(),
      email: String(r.Email || r.email || '').trim().toLowerCase(),
    })).filter(s => s.userId && s.password && s.name);

    if (students.length === 0) return res.status(400).json({ error: 'No valid records found' });

    let created = 0, updated = 0, errors = [];
    for (const s of students) {
      try {
        const existing = await User.findOne({ userId: { $regex: new RegExp(`^${s.userId}$`, 'i') } });
        if (existing) {
          existing.name = s.name; existing.fatherName = s.fatherName; existing.motherName = s.motherName;
          existing.enrollmentNo = s.enrollmentNo; existing.email = s.email; existing.isActive = true;
          if (!existing.hasRole('student')) existing.roles.push({ role: 'student' });
          await existing.save(); updated++;
        } else {
          const user = new User({ ...s, roles: [{ role: 'student' }] });
          await user.save(); created++;
        }
      } catch (e) { errors.push(s.userId + ': ' + e.message); }
    }
    res.json({ message: `${students.length} processed: ${created} created, ${updated} updated`, created, updated, errors });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const Application = require('../models/Application');
    const [students, staff, apps] = await Promise.all([
      User.countDocuments({ 'roles.role': 'student', isActive: true }),
      User.countDocuments({ 'roles.role': { $in: ['coordinator', 'pl', 'hod'] }, isActive: true }),
      Application.countDocuments(),
    ]);
    res.json({ students, staff, totalApps: apps });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
