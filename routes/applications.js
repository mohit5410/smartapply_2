const express = require('express');
const router = express.Router();
const Application = require('../models/Application');
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const { sendEmail, applicationSubmittedEmail, applicationUpdateEmail } = require('../middleware/email');

router.use(auth);

// GET /api/applications
router.get('/', async (req, res) => {
  try {
    const role = req.activeRole;
    let query = {};
    if (role === 'student') query = { studentUserId: req.user.userId };
    else if (role === 'coordinator') query = { coordinatorUserId: req.user.userId };
    else if (role === 'pl') query = { plUserId: req.user.userId };
    else if (role === 'hod') query = { deptId: req.roleData.deptId };
    else if (role === 'admin') query = {};
    const apps = await Application.find(query).sort({ createdAt: -1 });
    res.json({ applications: apps });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

router.get('/:id', async (req, res) => {
  try {
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'Not found' });
    res.json({ application: app });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// POST /api/applications — submit (students only)
router.post('/', async (req, res) => {
  try {
    if (req.activeRole !== 'student') return res.status(403).json({ error: 'Only students can submit' });
    const { subject, content, program, semester, section, department, deptId,
      coordinatorName, coordinatorUserId, plName, plUserId, hodName, hodUserId } = req.body;
    if (!subject || !content || !program || !semester || !section || !coordinatorName)
      return res.status(400).json({ error: 'Missing required fields' });

    const count = await Application.countDocuments();
    const appNumber = 'APP-' + new Date().getFullYear() + '-' + String(count + 10001).padStart(5, '0');

    const app = new Application({
      appNumber, subject, content,
      studentUserId: req.user.userId, studentName: req.user.name,
      fatherName: req.user.fatherName, motherName: req.user.motherName,
      enrollmentNo: req.user.enrollmentNo, studentEmail: req.user.email,
      program, semester, section, department, deptId,
      coordinatorName, coordinatorUserId,
      plName: plName || 'Unassigned', plUserId,
      hodName: hodName || 'Unassigned', hodUserId,
      status: 'pending_coordinator',
    });
    await app.save();
    const emailData = applicationSubmittedEmail(app);
    sendEmail(req.user.email, emailData.subject, emailData.html);
    res.status(201).json({ application: app });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/applications/:id/action — approve/reject using activeRole
router.post('/:id/action', async (req, res) => {
  try {
    const { action, comment } = req.body;
    if (!['approve', 'reject'].includes(action)) return res.status(400).json({ error: 'Invalid action' });
    const app = await Application.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'Not found' });

    const role = req.activeRole;
    const roleLabel = role === 'coordinator' ? 'Coordinator' : role === 'pl' ? 'Program Leader' : 'HOD';

    if (role === 'coordinator' && app.status !== 'pending_coordinator') return res.status(400).json({ error: 'Not pending coordinator review' });
    if (role === 'pl' && app.status !== 'pending_pl') return res.status(400).json({ error: 'Not pending PL review' });
    if (role === 'hod' && app.status !== 'pending_hod') return res.status(400).json({ error: 'Not pending HOD review' });

    app.approvals.push({ role: roleLabel, by: req.user.name, userId: req.user.userId, action, comment, date: new Date() });

    if (action === 'approve') {
      if (role === 'coordinator') app.status = 'pending_pl';
      else if (role === 'pl') app.status = 'pending_hod';
      else if (role === 'hod') app.status = 'approved';
    } else {
      app.status = 'rejected_' + (role === 'coordinator' ? 'coordinator' : role === 'pl' ? 'pl' : 'hod');
    }
    app.updatedAt = new Date();
    await app.save();
    const emailData = applicationUpdateEmail(app, action, roleLabel, comment);
    sendEmail(app.studentEmail, emailData.subject, emailData.html);
    res.json({ application: app });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET ALL coordinators (common to all depts)
router.get('/data/coordinators', async (req, res) => {
  try {
    const users = await User.find({ 'roles.role': 'coordinator', isActive: true }).select('userId name email');
    res.json({ coordinators: users });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET PL for program+sem+section
router.get('/data/pl', async (req, res) => {
  try {
    const { program, semester, section } = req.query;
    const user = await User.findOne({
      'roles': { $elemMatch: { role: 'pl', program, semester: parseInt(semester), section } },
      isActive: true
    }).select('userId name email');
    res.json({ pl: user || null });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

// GET HOD for dept
router.get('/data/hod', async (req, res) => {
  try {
    const { deptId } = req.query;
    const user = await User.findOne({
      'roles': { $elemMatch: { role: 'hod', deptId } },
      isActive: true
    }).select('userId name email');
    res.json({ hod: user || null });
  } catch (err) { res.status(500).json({ error: 'Server error' }); }
});

module.exports = router;
