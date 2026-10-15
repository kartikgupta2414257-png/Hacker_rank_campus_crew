const fs = require('fs');
const path = require('path');
const os = require('os');
const initialData = require('./seed');

const isVercel = Boolean(
  process.env.VERCEL ||
  process.env.VERCEL_ENV ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.LAMBDA_TASK_ROOT
);
const baseDir = __dirname;

class DataStore {
  constructor() {
    this.cache = null;
    this.dbFile = isVercel ? '/tmp/database.json' : path.join(baseDir, 'database.json');
    this.csvFile = isVercel ? '/tmp/applications.csv' : path.join(baseDir, 'applications.csv');
    this.init();
  }

  init() {
    try {
      if (isVercel && !fs.existsSync('/tmp')) {
        fs.mkdirSync('/tmp', { recursive: true });
      }

      // If running on Vercel and temp DB doesn't exist yet, seed from bundled file or initialData
      if (!fs.existsSync(this.dbFile)) {
        const bundledDb = path.join(baseDir, 'database.json');
        if (fs.existsSync(bundledDb)) {
          try {
            const bundledContent = fs.readFileSync(bundledDb, 'utf-8');
            this.cache = JSON.parse(bundledContent);
            const dir = path.dirname(this.dbFile);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.dbFile, bundledContent, 'utf-8');
          } catch (e) {
            this.save(initialData);
          }
        } else {
          this.save(initialData);
        }
      }
      this.syncCsvFile();
    } catch (err) {
      console.warn('Store init warning (in-memory mode active):', err.message);
    }
  }

  load() {
    if (this.cache) {
      return this.cache;
    }
    try {
      if (fs.existsSync(this.dbFile)) {
        const raw = fs.readFileSync(this.dbFile, 'utf-8');
        this.cache = JSON.parse(raw);
        return this.cache;
      }
      const bundledDb = path.join(baseDir, 'database.json');
      if (fs.existsSync(bundledDb)) {
        const raw = fs.readFileSync(bundledDb, 'utf-8');
        this.cache = JSON.parse(raw);
        return this.cache;
      }
      this.cache = JSON.parse(JSON.stringify(initialData));
      return this.cache;
    } catch (err) {
      console.warn('Error reading database, using in-memory fallback:', err.message);
      this.cache = JSON.parse(JSON.stringify(initialData));
      return this.cache;
    }
  }

  save(data) {
    this.cache = data;
    try {
      const dir = path.dirname(this.dbFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.dbFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.warn('Persistent save note (in-memory updated):', err.message);
    }
  }

  // Sync entire applications table to Excel-compatible CSV file line-by-line
  syncCsvFile() {
    try {
      const dir = path.dirname(this.csvFile);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const data = this.load();
      const applications = data.applications || [];


      const headers = [
        'S.No',
        'Application ID',
        'Full Name',
        'Email Address',
        'Mobile Number',
        'Course',
        'Department',
        'Year',
        'Semester',
        'College Name',
        'Technical Skills',
        'Previous Experience',
        'Why Join Campus Crew',
        'Status',
        'Submission Timestamp'
      ];

      const escapeCsv = (str) => {
        if (str === null || str === undefined) return '""';
        const s = String(str).replace(/"/g, '""');
        return `"${s}"`;
      };

      const rows = applications.map((app, idx) => [
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

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
      fs.writeFileSync(this.csvFile, csvContent, 'utf-8');
    } catch (err) {
      console.warn('Sync CSV file note:', err.message);
    }
  }

  // --- Ambassador & Config ---
  getAmbassadorInfo() {
    const data = this.load();
    return data.ambassador;
  }

  // --- Applications ---
  getApplications() {
    const data = this.load();
    return data.applications || [];
  }

  getFirebase() {
    try {
      return require('../services/firebaseService');
    } catch (e) {
      return null;
    }
  }

  addApplication(appData) {
    const data = this.load();
    const count = (data.applications || []).length + 1;
    const pad = String(count).padStart(3, '0');
    const newApp = {
      id: `APP-AU-${new Date().getFullYear()}-${pad}`,
      fullName: appData.fullName,
      email: appData.email,
      mobile: appData.mobile,
      course: appData.course,
      department: appData.department,
      year: appData.year,
      semester: appData.semester,
      collegeName: appData.collegeName || "Amrapali University, Haldwani",
      technicalSkills: Array.isArray(appData.technicalSkills) ? appData.technicalSkills : (appData.technicalSkills ? appData.technicalSkills.split(',').map(s => s.trim()) : []),
      previousExperience: appData.previousExperience || "",
      reasonToJoin: appData.reasonToJoin,
      privacyConsent: !!appData.privacyConsent,
      status: "Pending",
      appliedAt: new Date().toISOString(),
      notes: ""
    };

    data.applications = [newApp, ...(data.applications || [])];
    this.save(data);
    this.syncCsvFile();

    // Sync to Firebase Firestore in real-time
    const fb = this.getFirebase();
    if (fb && typeof fb.saveApplication === 'function') {
      fb.saveApplication(newApp).catch(err => console.warn('Firebase store sync note:', err.message));
    }

    return newApp;
  }

  updateApplicationStatus(id, status, notes) {
    const data = this.load();
    const index = (data.applications || []).findIndex(a => a.id === id);
    if (index === -1) return null;

    if (status) data.applications[index].status = status;
    if (notes !== undefined) data.applications[index].notes = notes;
    data.applications[index].updatedAt = new Date().toISOString();

    this.save(data);
    this.syncCsvFile();

    // Update in Firebase Firestore
    const fb = this.getFirebase();
    if (fb && typeof fb.saveApplication === 'function') {
      fb.saveApplication(data.applications[index]).catch(err => console.warn('Firebase status sync note:', err.message));
    }

    return data.applications[index];
  }

  deleteApplication(id) {
    const data = this.load();
    data.applications = (data.applications || []).filter(a => a.id !== id);
    this.save(data);
    this.syncCsvFile();

    // Delete in Firebase Firestore
    const fb = this.getFirebase();
    if (fb && typeof fb.deleteApplication === 'function') {
      fb.deleteApplication(id).catch(err => console.warn('Firebase delete sync note:', err.message));
    }
    return true;
  }


  // --- Email Logs ---
  logEmail(emailLog) {
    const data = this.load();
    const newLog = {
      id: `EML-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...emailLog
    };
    data.emailLogs = [newLog, ...(data.emailLogs || [])];
    this.save(data);

    // Sync to Firebase Firestore
    const fb = this.getFirebase();
    if (fb && typeof fb.logEmail === 'function') {
      fb.logEmail(newLog).catch(err => console.warn('Firebase email log sync note:', err.message));
    }

    return newLog;
  }

  getEmailLogs() {
    const data = this.load();
    return data.emailLogs || [];
  }

  // --- Notification & SMS Logs ---
  logNotification(notification) {
    const data = this.load();
    const newLog = {
      id: `NOTIF-${Date.now()}`,
      timestamp: new Date().toISOString(),
      ...notification
    };
    data.notificationLogs = [newLog, ...(data.notificationLogs || [])];
    this.save(data);

    // Sync to Firebase Firestore
    const fb = this.getFirebase();
    if (fb && typeof fb.logNotification === 'function') {
      fb.logNotification(newLog).catch(err => console.warn('Firebase notif log sync note:', err.message));
    }

    return newLog;
  }

  getNotificationLogs() {
    const data = this.load();
    return data.notificationLogs || [];
  }

  // --- Hackathons ---
  getHackathons() {
    return this.load().hackathons || [];
  }

  addHackathon(item) {
    const data = this.load();
    const newItem = { id: `hack-${Date.now()}`, ...item };
    data.hackathons = [newItem, ...(data.hackathons || [])];
    this.save(data);
    return newItem;
  }

  deleteHackathon(id) {
    const data = this.load();
    data.hackathons = (data.hackathons || []).filter(h => h.id !== id);
    this.save(data);
    return true;
  }

  // --- Contests ---
  getContests() {
    return this.load().contests || [];
  }

  addContest(item) {
    const data = this.load();
    const newItem = { id: `cnt-${Date.now()}`, ...item };
    data.contests = [newItem, ...(data.contests || [])];
    this.save(data);
    return newItem;
  }

  deleteContest(id) {
    const data = this.load();
    data.contests = (data.contests || []).filter(c => c.id !== id);
    this.save(data);
    return true;
  }

  // --- Quick Challenges ---
  getQuickChallenges() {
    const data = this.load();
    return data.challenges || data.quickChallenges || [];
  }

  addQuickChallenge(item) {
    const data = this.load();
    const newItem = { id: `qc-${Date.now()}`, ...item };
    data.quickChallenges = [newItem, ...(data.quickChallenges || [])];
    this.save(data);
    return newItem;
  }

  // --- Courses ---
  getCourses() {
    return this.load().courses || [];
  }

  addCourse(item) {
    const data = this.load();
    const newItem = { id: `crs-${Date.now()}`, ...item };
    data.courses = [newItem, ...(data.courses || [])];
    this.save(data);
    return newItem;
  }

  deleteCourse(id) {
    const data = this.load();
    data.courses = (data.courses || []).filter(c => c.id !== id);
    this.save(data);
    return true;
  }

  // --- Events ---
  getEvents() {
    return this.load().events || [];
  }

  addEvent(item) {
    const data = this.load();
    const newItem = { id: `evt-${Date.now()}`, ...item };
    data.events = [newItem, ...(data.events || [])];
    this.save(data);
    return newItem;
  }

  deleteEvent(id) {
    const data = this.load();
    data.events = (data.events || []).filter(e => e.id !== id);
    this.save(data);
    return true;
  }

  // --- Opportunities ---
  getOpportunities() {
    return this.load().opportunities || [];
  }

  addOpportunity(item) {
    const data = this.load();
    const newItem = { id: `opp-${Date.now()}`, ...item };
    data.opportunities = [newItem, ...(data.opportunities || [])];
    this.save(data);
    return newItem;
  }

  deleteOpportunity(id) {
    const data = this.load();
    data.opportunities = (data.opportunities || []).filter(o => o.id !== id);
    this.save(data);
    return true;
  }

  // --- Announcements ---
  getAnnouncements() {
    return this.load().announcements || [];
  }

  addAnnouncement(item) {
    const data = this.load();
    const newItem = { id: `ann-${Date.now()}`, date: new Date().toISOString().split('T')[0], ...item };
    data.announcements = [newItem, ...(data.announcements || [])];
    this.save(data);
    return newItem;
  }

  deleteAnnouncement(id) {
    const data = this.load();
    data.announcements = (data.announcements || []).filter(a => a.id !== id);
    this.save(data);
    return true;
  }
}

module.exports = new DataStore();
