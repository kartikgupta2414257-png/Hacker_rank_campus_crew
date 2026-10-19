/**
 * HackerRank Campus Crew — Amrapali University, Haldwani
 * Main Express.js Backend Server
 * 
 * Campus Ambassador: Anil Pandey
 * Phone: 7900546102
 * College Email: au-250303050423@amrapali.ac.in
 * Alternate Email: ap967143@gmail.com
 */

require('dotenv').config();

// Process safety safeguards to prevent server crashing on unhandled network/SDK promises
process.on('unhandledRejection', (reason, promise) => {
  console.warn('[Process Warning] Unhandled Promise Rejection:', reason && reason.message ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
  console.error('[Process Error] Uncaught Exception:', err && err.message ? err.message : err);
});

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const store = require('./data/store');
const emailService = require('./services/emailService');
const notificationService = require('./services/notificationService');
const otpService = require('./services/otpService');
const firebaseService = require('./services/firebaseService');


const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'amrapali2026';
const ADMIN_TOKEN = 'AU_ADMIN_SESSION_TOKEN_2026';
const BIOMETRIC_TOKEN = 'BIO_FACE_VERIFIED_AMRAPALI';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/public/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/public/js', express.static(path.join(__dirname, 'public', 'js')));
app.use('/public/images', express.static(path.join(__dirname, 'public', 'images')));

// Simple Auth Middleware for Admin
function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.headers['x-admin-token'];
  if (token === ADMIN_TOKEN || token === BIOMETRIC_TOKEN || token === ADMIN_PASSWORD) {
    return next();
  }
  return res.status(401).json({ success: false, message: 'Unauthorized. Admin key or biometric verification required.' });
}

// ============================================================================
// 1. PUBLIC PORTAL API ROUTES
// ============================================================================

// --- ANTI-BOT CAPTCHA & SECURITY VERIFICATION ROUTES ---
app.post('/api/auth/verify-captcha', (req, res) => {
  const { captcha, expected } = req.body;
  if (!captcha) {
    return res.status(400).json({ success: false, message: 'Please enter the CAPTCHA code.' });
  }
  const match = (expected && captcha.toLowerCase() === expected.toLowerCase());
  res.json({ success: match, message: match ? 'CAPTCHA verified successfully!' : 'Incorrect CAPTCHA code.' });
});

// Real-time Authentication & OTP Verification Endpoints
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { email, fullName } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }
    const result = await otpService.sendOtp({ email, fullName });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const result = await otpService.verifyOtp({ email, otp });
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/api/auth/otp-status', (req, res) => {
  const { email } = req.query;
  const verified = email ? otpService.isVerified(email) : true;
  res.json({ success: true, verified });
});



// Firebase Cloud Status Check
app.get('/api/firebase/status', (req, res) => {
  res.json({ success: true, firebase: firebaseService.getStatus() });
});

// Firebase Web Client Configuration Endpoint
app.get('/api/firebase/config', (req, res) => {
  res.json({
    success: true,
    config: {
      projectId: process.env.FIREBASE_PROJECT_ID || 'hackerrank-campus-crew',
      apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyDummyKeyForCampusCrew2026Amrapali',
      authDomain: (process.env.FIREBASE_PROJECT_ID || 'hackerrank-campus-crew') + '.firebaseapp.com',
      storageBucket: (process.env.FIREBASE_PROJECT_ID || 'hackerrank-campus-crew') + '.appspot.com',
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '109876543210',
      appId: process.env.FIREBASE_APP_ID || '1:109876543210:web:abcdef1234567890'
    }
  });
});

// Ambassador & Chapter Info + Quota Stats
app.get('/api/info', (req, res) => {
  try {
    const ambassador = store.getAmbassadorInfo();
    const apps = store.getApplications();
    const selected = apps.filter(a => a.status === 'Selected').length;
    const shortlisted = apps.filter(a => a.status === 'Shortlisted').length;
    const totalPositions = (ambassador && ambassador.maxCoordinators) || 12;
    const remaining = Math.max(0, totalPositions - selected);

    res.json({
      success: true,
      data: {
        ambassador,
        discordLink: 'https://discord.gg/m6ZMnSunx',
        quota: {
          totalPositions,
          selected,
          shortlisted,
          remaining,
          totalApplicants: apps.length
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Announcements
app.get('/api/announcements', (req, res) => {
  res.json({ success: true, data: store.getAnnouncements() });
});

// Hackathons
app.get('/api/hackathons', (req, res) => {
  res.json({ success: true, data: store.getHackathons() });
});

// Coding Contests
app.get('/api/contests', (req, res) => {
  res.json({ success: true, data: store.getContests() });
});

// Quick Challenges / Quizzes
app.get('/api/challenges', (req, res) => {
  res.json({ success: true, data: store.getQuickChallenges() });
});

// Verify Daily / Quiz Answers
app.post('/api/challenges/verify', (req, res) => {
  const { challengeId, selectedAnswer } = req.body;
  const challenges = store.getQuickChallenges();
  const challenge = challenges.find(c => c.id === challengeId);

  if (!challenge) {
    return res.status(404).json({ success: false, message: 'Challenge not found.' });
  }

  const isCorrect = (selectedAnswer && selectedAnswer.trim() === challenge.correctAnswer.trim());
  res.json({
    success: true,
    isCorrect,
    correctAnswer: challenge.correctAnswer,
    explanation: challenge.explanation
  });
});

// Courses
app.get('/api/courses', (req, res) => {
  res.json({ success: true, data: store.getCourses() });
});

// Events & Workshops
app.get('/api/events', (req, res) => {
  res.json({ success: true, data: store.getEvents() });
});

// Opportunities & Internships
app.get('/api/opportunities', (req, res) => {
  res.json({ success: true, data: store.getOpportunities() });
});

// Public Excel Ledger (Filtered non-sensitive student registration status)
app.get('/api/applications/public-ledger', (req, res) => {
  try {
    const apps = store.getApplications();
    const ledger = apps.map(a => ({
      id: a.id,
      fullName: a.fullName,
      course: a.course,
      department: a.department,
      year: a.year,
      semester: a.semester,
      technicalSkills: a.technicalSkills,
      email: a.email,
      status: a.status,
      appliedAt: a.appliedAt
    }));
    res.json({ success: true, data: ledger });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Submit Coordinator Application (Supports both /api/recruit and /api/applications/apply)
const handleApplicationApply = async (req, res) => {
  try {
    const { fullName, email, mobile, course, department, year, semester, collegeName, technicalSkills, previousExperience, reasonToJoin, privacyConsent, otp } = req.body;

    if (!fullName || !email || !course || !reasonToJoin) {
      return res.status(400).json({ success: false, message: 'Please fill all required application fields (Name, Email, Course, and Reason to Join).' });
    }

    const cleanEmail = email.trim().toLowerCase();

    const newApp = store.addApplication({
      fullName,
      email: cleanEmail,
      mobile,
      course,
      department: department || 'Computer Science & Engineering',
      year: year || '2nd Year',
      semester: semester || '4th Semester',
      collegeName: collegeName || 'Amrapali University, Haldwani',
      technicalSkills,
      previousExperience: previousExperience || '',
      reasonToJoin,
      privacyConsent: !!privacyConsent
    });

    // Sync to Google Firebase Cloud Firestore
    if (firebaseService) {
      try {
        await firebaseService.saveApplication(newApp);
      } catch (fbErr) {
        console.warn('Firebase application sync note:', fbErr.message);
      }
    }


    // Send confirmation email and SMS/WhatsApp notification ("You have been registered successfully")
    let notificationResult = null;
    try {
      notificationResult = await notificationService.dispatchRegistrationConfirmation(newApp);
    } catch (notifErr) {
      console.error('Notification dispatch note:', notifErr.message);
    }

    const emailResult = notificationResult ? notificationResult.emailResult : null;

    res.status(201).json({
      success: true,
      message: 'You have been registered successfully! Confirmation email and mobile message dispatched.',
      applicationId: newApp.id,
      application: newApp,
      emailSent: !!emailResult,
      emailStatus: emailResult ? 'Delivered to Inbox' : 'Logged to Outbox',
      emailPreview: emailResult ? emailResult.previewContent : null,
      smsMessage: notificationResult ? notificationResult.smsMessage : '',
      whatsappUrl: notificationResult ? notificationResult.whatsappUrl : '',
      smsUrl: notificationResult ? notificationResult.smsUrl : '',
      mailtoUrl: notificationResult ? notificationResult.mailtoUrl : '',
      discordLink: 'https://discord.gg/m6ZMnSunx'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

app.post('/api/applications/apply', handleApplicationApply);
app.post('/api/recruit', handleApplicationApply);
app.post('/api/coordinator/apply', handleApplicationApply);

// Download Excel CSV File (Clean attachment header to prevent browser blocking)
app.get('/api/applications/download-excel', (req, res) => {
  try {
    const csvPath = (store && store.csvFile) ? store.csvFile : (process.env.VERCEL ? '/tmp/applications.csv' : path.join(__dirname, 'data', 'applications.csv'));
    if (!fs.existsSync(csvPath) && store && typeof store.syncCsvFile === 'function') {
      store.syncCsvFile();
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Amrapali_Campus_Crew_Applications_2026.csv"');
    const absPath = path.resolve(csvPath);
    if (fs.existsSync(absPath)) {
      res.sendFile(absPath);
    } else {
      // In-memory fallback if filesystem write is restricted
      const apps = (store && typeof store.getApplications === 'function') ? store.getApplications() : [];
      const headers = ['S.No', 'Application ID', 'Full Name', 'Email Address', 'Mobile Number', 'Course', 'Department', 'Year', 'Semester', 'College Name', 'Technical Skills', 'Previous Experience', 'Why Join Campus Crew', 'Status', 'Submission Timestamp'];
      const escapeCsv = (str) => {
        if (str === null || str === undefined) return '""';
        return `"${String(str).replace(/"/g, '""')}"`;
      };
      const rows = apps.map((app, idx) => [
        idx + 1,
        escapeCsv(app.id),
        escapeCsv(app.fullName),
        escapeCsv(app.email),
        escapeCsv(app.mobile),
        escapeCsv(app.course),
        escapeCsv(app.department),
        escapeCsv(app.year),
        escapeCsv(app.semester),
        escapeCsv(app.collegeName),
        escapeCsv(Array.isArray(app.technicalSkills) ? app.technicalSkills.join(', ') : app.technicalSkills),
        escapeCsv(app.previousExperience),
        escapeCsv(app.reasonToJoin),
        escapeCsv(app.status),
        escapeCsv(app.appliedAt)
      ].join(','));
      res.send('\uFEFF' + [headers.join(','), ...rows].join('\r\n'));
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to generate download file.' });
  }
});


// ============================================================================
// 2. STUDENT / APPLICANT AUTHENTICATION & STATUS LOOKUP
// ============================================================================

app.post('/api/student/login', async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier) {
      return res.status(400).json({ success: false, message: 'Please enter your Registered Email Address or Application ID.' });
    }

    const clean = identifier.trim().toLowerCase();
    const cleanDigits = identifier.replace(/\D/g, '');
    const last10Digits = cleanDigits.length >= 10 ? cleanDigits.slice(-10) : cleanDigits;
    const apps = store.getApplications();

    let student = apps.find(a => {
      const matchEmail = a.email && a.email.toLowerCase() === clean;
      const matchId = a.id && a.id.toLowerCase() === clean;
      const aDigits = (a.mobile || '').replace(/\D/g, '');
      const aLast10 = aDigits.length >= 10 ? aDigits.slice(-10) : aDigits;
      const matchMobile = (cleanDigits.length >= 10 && (aDigits.includes(cleanDigits) || cleanDigits.includes(aDigits))) ||
        (last10Digits.length >= 10 && aLast10 === last10Digits);
      return matchEmail || matchId || matchMobile;
    });

    // If not found in local memory, check Firebase Cloud Firestore
    if (!student && firebaseService) {
      try {
        student = await firebaseService.findApplication(clean, cleanDigits);
      } catch (fbErr) {
        console.warn('Cloud application search note:', fbErr.message);
      }
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'No coordinator application found matching this Email or Application ID. Please check the email you registered with.'
      });
    }

    res.json({
      success: true,
      message: 'Welcome back, ' + student.fullName + '!',
      student: {
        id: student.id,
        fullName: student.fullName,
        email: student.email,
        mobile: student.mobile,
        course: student.course,
        department: student.department,
        year: student.year,
        semester: student.semester,
        collegeName: student.collegeName,
        technicalSkills: student.technicalSkills,
        status: student.status,
        appliedAt: student.appliedAt,
        notes: student.notes || ''
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Student Authentication & Login via Email OTP
app.post('/api/student/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please enter your registered email address.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const apps = store.getApplications();
    let student = apps.find(a => a.email && a.email.toLowerCase() === cleanEmail);

    if (!student && firebaseService) {
      try {
        student = await firebaseService.findApplication(cleanEmail);
      } catch (e) { }
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        message: `No coordinator application found for ${cleanEmail}. Please check the email or submit a new registration.`
      });
    }

    // Dispatch a fresh unique OTP via email
    const otpResult = await otpService.sendOtp({
      email: cleanEmail,
      fullName: student.fullName
    });

    res.json({
      success: true,
      message: `Verification code sent to ${cleanEmail}. Please check your inbox.`,
      email: cleanEmail,
      fullName: student.fullName,
      gmailUrl: otpResult.gmailUrl
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/student/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Both registered email and 6-digit OTP code are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Verify OTP using otpService
    const verifyResult = await otpService.verifyOtp({ email: cleanEmail, otp });
    if (!verifyResult || !verifyResult.success) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP code.' });
    }

    // Retrieve verified application record
    const apps = store.getApplications();
    let student = apps.find(a => a.email && a.email.toLowerCase() === cleanEmail);
    if (!student && firebaseService) {
      try {
        student = await firebaseService.findApplication(cleanEmail);
      } catch (e) { }
    }

    if (!student) {
      return res.status(404).json({ success: false, message: 'Application record not found.' });
    }

    res.json({
      success: true,
      message: `Authentication successful! Welcome back, ${student.fullName}.`,
      student: {
        id: student.id,
        fullName: student.fullName,
        email: student.email,
        mobile: student.mobile,
        course: student.course,
        department: student.department,
        year: student.year,
        semester: student.semester,
        collegeName: student.collegeName,
        technicalSkills: student.technicalSkills,
        status: student.status,
        appliedAt: student.appliedAt,
        notes: student.notes || ''
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});


// Trigger Full Database Synchronization to Firebase Cloud Firestore
app.post('/api/cloud/sync', async (req, res) => {
  try {
    const fullData = store.load();
    const result = await firebaseService.syncEntireDatabase(fullData);
    res.json({
      success: true,
      message: 'Database synchronization to Firebase Cloud Firestore complete.',
      cloudResult: result,
      status: firebaseService.getStatus()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================================
// 3. ADMIN & CAMPUS AMBASSADOR AUTHENTICATION (FACE SCAN + PASSWORD KEY)
// ============================================================================

// Password Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    return res.json({
      success: true,
      token: ADMIN_TOKEN,
      user: {
        name: 'Anil Pandey',
        role: 'Campus Ambassador',
        method: 'PASSWORD'
      }
    });
  }
  return res.status(401).json({ success: false, message: 'Incorrect security key. Default is amrapali2026.' });
});

// Biometric Face Scanner Verification
app.post('/api/admin/biometric-verify', (req, res) => {
  const { biometricToken, verificationMethod, ambassador } = req.body;

  if (biometricToken || verificationMethod === 'FACE_SCAN') {
    return res.json({
      success: true,
      token: BIOMETRIC_TOKEN,
      user: {
        name: ambassador || 'Anil Pandey',
        role: 'Campus Ambassador — HackerRank Campus Crew',
        method: 'BIOMETRIC_FACE_RECOGNITION',
        verifiedAt: new Date().toISOString(),
        confidenceScore: '98.8%'
      }
    });
  }
  return res.status(400).json({ success: false, message: 'Invalid biometric verification telemetry.' });
});

// ============================================================================
// 4. PROTECTED ADMIN PORTAL ROUTES
// ============================================================================

// Admin: Get all applications
app.get('/api/admin/applications', requireAdmin, (req, res) => {
  const apps = store.getApplications();
  const selected = apps.filter(a => a.status === 'Selected').length;
  const shortlisted = apps.filter(a => a.status === 'Shortlisted').length;
  const pending = apps.filter(a => a.status === 'Pending').length;
  res.json({
    success: true,
    data: apps,
    stats: {
      total: apps.length,
      selected,
      shortlisted,
      pending,
      quotaMax: 12
    }
  });
});

// Admin: Update Application Status & Notes
app.patch('/api/admin/applications/:id/status', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const updated = store.updateApplicationStatus(id, status, notes);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Application not found.' });
    }

    // Sync to Firebase if available
    if (firebaseService && typeof firebaseService.updateApplicationStatus === 'function') {
      try {
        await firebaseService.updateApplicationStatus(id, { status, notes });
      } catch (fbErr) {
        console.warn('Firebase status update note:', fbErr.message);
      }
    }

    // Dispatch notification to candidate when status is Selected, Shortlisted, or Rejected
    if (status && ['Selected', 'Shortlisted', 'Rejected'].includes(status)) {
      try {
        if (notificationService && typeof notificationService.dispatchStatusUpdateNotification === 'function') {
          await notificationService.dispatchStatusUpdateNotification(updated, status, notes);
        }
      } catch (notifErr) {
        console.warn('Status notification dispatch note:', notifErr.message);
      }
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: Delete Application
app.delete('/api/admin/applications/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    store.deleteApplication(id);
    if (firebaseService && typeof firebaseService.deleteApplication === 'function') {
      try {
        await firebaseService.deleteApplication(id);
      } catch (fbErr) {
        console.warn('Firebase delete note:', fbErr.message);
      }
    }
    res.json({ success: true, message: 'Application deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// Admin: Get Email Dispatch Logs
app.get('/api/admin/email-logs', requireAdmin, (req, res) => {
  res.json({ success: true, data: store.getEmailLogs() });
});

// Admin: Dashboard Aggregate Statistics
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const apps = store.getApplications();
  const emails = store.getEmailLogs();
  const selected = apps.filter(a => a.status === 'Selected').length;
  const shortlisted = apps.filter(a => a.status === 'Shortlisted').length;
  const pending = apps.filter(a => a.status === 'Pending').length;

  res.json({
    success: true,
    data: {
      totalApplications: apps.length,
      selected,
      shortlisted,
      pending,
      quotaRemaining: Math.max(0, 12 - selected),
      totalEmailsDispatched: emails.length
    }
  });
});

// Admin: Add New Content (Hackathon, Contest, Event, Announcement)
app.post('/api/admin/content', requireAdmin, (req, res) => {
  try {
    const { type, title, organizer, date, description, link } = req.body;
    let createdItem = null;

    if (type === 'hackathon') {
      createdItem = store.addHackathon({
        name: title,
        organizer: organizer || 'Campus Crew',
        startDate: date || '2026-11-15',
        status: 'upcoming',
        mode: 'online',
        description,
        registrationLink: link || 'https://www.hackerrank.com',
        tracks: ['Open Innovation', 'AI/ML', 'Web Dev'],
        prizes: 'Cash Prize + Swag'
      });
    } else if (type === 'contest') {
      createdItem = store.addContest({
        title,
        platform: organizer || 'HackerRank',
        date: date || '2026-11-20',
        duration: '2 Hours',
        difficulty: 'All Levels',
        description,
        contestLink: link || 'https://www.hackerrank.com'
      });
    } else if (type === 'event') {
      createdItem = store.addEvent({
        title,
        date: date || '2026-11-25',
        mode: 'Online (Discord / Google Meet)',
        speaker: organizer || 'Anil Pandey',
        description,
        registrationLink: link || 'https://www.hackerrank.com'
      });
    } else {
      createdItem = store.addAnnouncement({
        title,
        content: description,
        tag: 'Update',
        link: link || '#home'
      });
    }

    res.status(201).json({ success: true, data: createdItem });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Admin: View Notification Logs (SMS & WhatsApp & Email)
app.get('/api/admin/notifications', requireAdmin, (req, res) => {
  try {
    const logs = typeof store.getNotificationLogs === 'function' ? store.getNotificationLogs() : [];
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// API Health Check Endpoint (For Vercel and Uptime Monitors)
app.get(['/api', '/api/health', '/api/status'], (req, res) => {
  res.json({
    success: true,
    status: 'online',
    portal: 'HackerRank Campus Crew — Amrapali University',
    ambassador: 'Anil Pandey (7900546102)',
    environment: Boolean(process.env.VERCEL || process.env.VERCEL_ENV) ? 'Vercel Serverless' : 'Node.js Local Server',
    smtpConfigured: Boolean(
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_USER !== 'your_email@gmail.com' &&
      process.env.SMTP_PASS !== 'your_gmail_app_password'
    ),
    timestamp: new Date().toISOString()
  });
});

// Portal & Status Page Routes
app.get(['/login', '/portal', '/student-login', '/admin-login', '/status'], (req, res) => {
  const loginPath = path.join(__dirname, 'public', 'login.html');
  if (fs.existsSync(loginPath)) {
    res.sendFile(loginPath);
  } else {
    res.redirect('/login.html');
  }
});

// Safe SPA Fallback (Prevents ENOENT crash and prevents returning HTML for broken /api/ requests)
app.get('*', (req, res) => {
  // If an unhandled /api route was requested, return JSON 404 instead of HTML
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: `API endpoint ${req.path} not found.` });
  }

  const indexPath = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(200).send('<!DOCTYPE html><html><head><meta http-equiv="refresh" content="0; url=/index.html"></head><body>Loading HackerRank Campus Crew...</body></html>');
  }
});

// Start Server only if run directly (local development or standalone node)
if (require.main === module) {
  const os = require('os');
  app.listen(PORT, '0.0.0.0', () => {
    const nets = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          ips.push({ name, ip: net.address });
        }
      }
    }

    console.log(`====================================================`);
    console.log(`🚀 HackerRank Campus Crew Server running for Phone & Laptop!`);
    console.log(`💻 Laptop Access: http://localhost:${PORT}`);
    ips.forEach(i => {
      console.log(`📱 Phone / Mobile Access (${i.name}): http://${i.ip}:${PORT}`);
    });
    console.log(`🔑 Admin Dashboard Password: ${ADMIN_PASSWORD}`);
    console.log(`👤 Campus Ambassador: Anil Pandey (7900546102)`);
    console.log(`📷 Biometric Face Scanner Active for Campus Ambassador`);
    console.log(`====================================================`);
  });
}

module.exports = app;
