require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const User = require('./models/User');
const { initEmail } = require('./middleware/email');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/ai', require('./routes/ai'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.get('*', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

async function seedAdmin() {
  try {
    const existing = await User.findOne({ 'roles.role': 'admin' });
    if (!existing) {
      const admin = new User({
        userId: process.env.ADMIN_USER || 'admin',
        password: process.env.ADMIN_PASSWORD || 'admin123',
        name: 'System Administrator',
        email: 'admin@amity.edu',
        roles: [{ role: 'admin' }],
      });
      await admin.save();
      console.log('[Setup] Admin created: admin / ' + (process.env.ADMIN_PASSWORD || 'admin123'));
    } else { console.log('[Setup] Admin exists'); }
  } catch (err) { console.error('[Setup] Error:', err.message); }
}

async function start() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smartapply');
    console.log('[DB] Connected');
    await seedAdmin();
    initEmail();
    app.listen(PORT, () => {
      console.log('\n  ╔══════════════════════════════════════════╗');
      console.log('  ║      📝 SmartApply Server Running        ║');
      console.log(`  ║  URL:   http://localhost:${PORT}             ║`);
      console.log('  ║  Admin: admin / admin123                 ║');
      console.log('  ║  Multi-Role System Enabled               ║');
      console.log('  ╚══════════════════════════════════════════╝\n');
    });
  } catch (err) { console.error('[Fatal]', err.message); process.exit(1); }
}
start();
