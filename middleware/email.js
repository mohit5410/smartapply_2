const nodemailer = require('nodemailer');

let transporter = null;

function initEmail() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log('[Email] Service configured with', process.env.SMTP_HOST);
  } else {
    console.log('[Email] SMTP not configured — emails will be logged to console');
  }
}

async function sendEmail(to, subject, html) {
  if (!to) return;

  if (!transporter) {
    console.log(`[Email → ${to}] ${subject}`);
    return;
  }

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'SmartApply <noreply@amity.edu>',
      to,
      subject,
      html,
    });
    console.log(`[Email Sent → ${to}] ${subject}`);
  } catch (err) {
    console.error(`[Email Error → ${to}]`, err.message);
  }
}

// Email templates
function applicationSubmittedEmail(app) {
  return {
    subject: `Application Submitted: ${app.subject} (${app.appNumber})`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#2563eb">Application Submitted</h2>
      <p>Dear ${app.studentName},</p>
      <p>Your application <strong>${app.appNumber}</strong> has been submitted successfully.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Subject</td><td style="padding:8px;border:1px solid #e5e7eb">${app.subject}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Program</td><td style="padding:8px;border:1px solid #e5e7eb">${app.program} — Sem ${app.semester}, Sec ${app.section}</td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Status</td><td style="padding:8px;border:1px solid #e5e7eb">Pending Coordinator Review</td></tr>
      </table>
      <p>You will be notified at each stage of the approval process.</p>
      <p style="color:#888;font-size:12px">SmartApply — Amity University</p>
    </div>`,
  };
}

function applicationUpdateEmail(app, action, roleName, comment) {
  const statusText = action === 'approve' ? 'approved' : 'rejected';
  const color = action === 'approve' ? '#16a34a' : '#ef4444';
  return {
    subject: `Application ${statusText}: ${app.subject} (${app.appNumber})`,
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:${color}">Application ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}</h2>
      <p>Dear ${app.studentName},</p>
      <p>Your application <strong>${app.appNumber}</strong> has been <strong style="color:${color}">${statusText}</strong> by ${roleName}.</p>
      ${comment ? `<p><strong>Comment:</strong> ${comment}</p>` : ''}
      <p>Current Status: <strong>${app.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</strong></p>
      <p style="color:#888;font-size:12px">SmartApply — Amity University</p>
    </div>`,
  };
}

function credentialsEmail(user, plainPassword) {
  return {
    subject: 'SmartApply — Your Login Credentials',
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#2563eb">Welcome to SmartApply</h2>
      <p>Dear ${user.name},</p>
      <p>Your account has been created. Here are your login credentials:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">User ID</td><td style="padding:8px;border:1px solid #e5e7eb"><strong>${user.userId}</strong></td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Password</td><td style="padding:8px;border:1px solid #e5e7eb"><strong>${plainPassword}</strong></td></tr>
        <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold">Role</td><td style="padding:8px;border:1px solid #e5e7eb">${user.role.toUpperCase()}</td></tr>
      </table>
      <p style="color:#dc2626"><strong>Please change your password after first login.</strong></p>
      <p style="color:#888;font-size:12px">SmartApply — Amity University</p>
    </div>`,
  };
}

module.exports = { initEmail, sendEmail, applicationSubmittedEmail, applicationUpdateEmail, credentialsEmail };
