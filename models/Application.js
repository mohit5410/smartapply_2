const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema({
  role: { type: String, required: true },
  by: { type: String, required: true },
  userId: String,
  action: { type: String, enum: ['approve', 'reject'], required: true },
  comment: String,
  date: { type: Date, default: Date.now },
});

const applicationSchema = new mongoose.Schema({
  appNumber: { type: String, required: true, unique: true },
  subject: { type: String, required: true },
  content: { type: String, required: true },

  // Student info (snapshot at submission time)
  studentUserId: { type: String, required: true },
  studentName: { type: String, required: true },
  fatherName: String,
  motherName: String,
  enrollmentNo: { type: String, required: true },
  studentEmail: String,

  // Academic info (selected at submission time)
  program: { type: String, required: true },
  semester: { type: Number, required: true },
  section: { type: String, required: true },
  department: String,
  deptId: String,

  // Routing
  coordinatorName: { type: String, required: true },
  coordinatorUserId: String,
  plName: String,
  plUserId: String,
  hodName: String,
  hodUserId: String,

  // Status
  status: {
    type: String,
    enum: ['pending_coordinator', 'rejected_coordinator', 'pending_pl', 'rejected_pl', 'pending_hod', 'rejected_hod', 'approved'],
    default: 'pending_coordinator',
  },

  approvals: [approvalSchema],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

applicationSchema.index({ studentUserId: 1 });
applicationSchema.index({ status: 1 });
applicationSchema.index({ coordinatorUserId: 1 });
applicationSchema.index({ plUserId: 1 });
applicationSchema.index({ deptId: 1 });

module.exports = mongoose.model('Application', applicationSchema);
