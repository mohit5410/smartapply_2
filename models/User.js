const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const roleAssignmentSchema = new mongoose.Schema({
  role: { type: String, required: true, enum: ['admin', 'student', 'coordinator', 'pl', 'hod'] },
  deptId: String,       // for HOD
  program: String,      // for PL
  semester: Number,     // for PL
  section: String,      // for PL
  // coordinator has no extra fields
}, { _id: true });

const userSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, trim: true, lowercase: true },
  roles: [roleAssignmentSchema],
  fatherName: String,
  motherName: String,
  enrollmentNo: String,
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  this.updatedAt = new Date();
  next();
});

userSchema.methods.comparePassword = function (pw) { return bcrypt.compare(pw, this.password); };
userSchema.methods.hasRole = function (r) { return this.roles.some(x => x.role === r); };
userSchema.methods.toJSON = function () { const o = this.toObject(); delete o.password; return o; };

module.exports = mongoose.model('User', userSchema);
