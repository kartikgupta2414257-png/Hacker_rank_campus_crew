/**
 * Firebase Firestore Backend Service for HackerRank Campus Crew — Amrapali University
 * Connects backend data (Applications, Real-time OTPs, Email Logs, Notification Logs) to Firebase.
 * 
 * Campus Ambassador: Anil Pandey (7900546102)
 */

const fs = require('fs');
const path = require('path');
let admin = null;
let appModule = null;
let firestoreModule = null;

try {
  admin = require('firebase-admin');
  appModule = require('firebase-admin/app');
  firestoreModule = require('firebase-admin/firestore');
} catch (e) {
  console.warn('⚠️ firebase-admin module not loaded:', e.message);
}

function createCertCredential(keyData) {
  if (appModule && typeof appModule.cert === 'function') return appModule.cert(keyData);
  if (admin && admin.credential && typeof admin.credential.cert === 'function') return admin.credential.cert(keyData);
  return null;
}

function createDefaultCredential() {
  try {
    if (appModule && typeof appModule.applicationDefault === 'function') return appModule.applicationDefault();
    if (admin && admin.credential && typeof admin.credential.applicationDefault === 'function') return admin.credential.applicationDefault();
  } catch (e) { }
  return null;
}

function resolveFirestore(appInstance) {
  try {
    if (firestoreModule && typeof firestoreModule.getFirestore === 'function') {
      return firestoreModule.getFirestore(appInstance);
    }
    if (admin && typeof admin.firestore === 'function') {
      return admin.firestore();
    }
  } catch (e) { }
  return null;
}

class FirebaseService {
  constructor() {
    this.app = null;
    this.db = null;
    this.isConnected = false;
    this.projectId = null;
    this.initFirebase();
  }

  /**
   * Initializes Firebase Admin SDK with project credentials or service account
   */
  initFirebase() {
    if (!admin && !appModule) return;

    try {
      // 1. Check for serviceAccountKey.json or firebase-key.json in project
      const possibleKeyFiles = [
        path.join(__dirname, '..', 'serviceAccountKey.json'),
        path.join(__dirname, '..', 'firebase-key.json'),
        path.join(__dirname, '..', 'firebase-service-account.json')
      ];

      let credential = null;
      for (const file of possibleKeyFiles) {
        if (fs.existsSync(file)) {
          try {
            const keyData = JSON.parse(fs.readFileSync(file, 'utf8'));
            credential = createCertCredential(keyData);
            this.projectId = keyData.project_id;
            console.log(`🔥 Loaded Firebase credentials from file: ${path.basename(file)} (Project: ${this.projectId})`);
            break;
          } catch (err) {
            console.error(`Error parsing Firebase key file ${file}:`, err.message);
          }
        }
      }

      // 2. Check environment variable for raw JSON string or file path
      if (!credential && process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
          const raw = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
          if (raw.startsWith('{')) {
            const keyData = JSON.parse(raw);
            credential = createCertCredential(keyData);
            this.projectId = keyData.project_id;
          } else if (fs.existsSync(raw)) {
            const keyData = JSON.parse(fs.readFileSync(raw, 'utf8'));
            credential = createCertCredential(keyData);
            this.projectId = keyData.project_id;
          }
        } catch (err) {
          console.error('Error loading FIREBASE_SERVICE_ACCOUNT from .env:', err.message);
        }
      }

      // 3. Project ID from environment
      const envProjectId = process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
      if (envProjectId) {
        this.projectId = envProjectId;
      }

      const initFn = (appModule && typeof appModule.initializeApp === 'function')
        ? appModule.initializeApp
        : (admin && typeof admin.initializeApp === 'function' ? admin.initializeApp : null);

      const getAppsFn = (appModule && typeof appModule.getApps === 'function')
        ? appModule.getApps
        : () => (admin && admin.apps ? admin.apps : []);

      if (credential && initFn) {
        const apps = getAppsFn();
        if (apps.length === 0) {
          const initConfig = { credential };
          if (this.projectId) initConfig.projectId = this.projectId;
          this.app = initFn(initConfig);
        } else {
          this.app = apps[0];
        }

        this.db = resolveFirestore(this.app);
        if (this.db) {
          this.isConnected = true;
          console.log(`✅ Live Firebase Firestore Connected successfully with Service Account! [Project: ${this.projectId || 'Default'}]`);
        }
      } else {
        console.log(`ℹ️ Firebase Service initialized in Hybrid Cloud Mode [Project ID: ${this.projectId || 'hackerrank-campus-crew'}].`);
        console.log('   Client-side Firebase Web SDK is active in frontend browser. To connect server-side Firestore, place serviceAccountKey.json in project root.');
      }
    } catch (err) {
      console.warn('ℹ️ Firebase initialization notice:', err.message);
      this.isConnected = false;
    }
  }

  /**
   * Saves Coordinator Registration Application to Firebase Firestore
   * @param {Object} application 
   */
  async saveApplication(application) {
    if (!application || !application.id) return null;

    if (this.isConnected && this.db) {
      try {
        const docRef = this.db.collection('applications').doc(application.id);
        const payload = {
          ...application,
          updatedAt: new Date().toISOString(),
          syncedToFirebaseAt: new Date().toISOString()
        };
        await docRef.set(payload, { merge: true });
        console.log(`🔥 [Firebase Firestore] Saved Application doc: applications/${application.id}`);
        return { success: true, firestoreId: application.id };
      } catch (err) {
        console.error(`⚠️ Firebase saveApplication error for ${application.id}:`, err.message);
      }
    }
    return { success: false, mode: 'local' };
  }

  /**
   * Updates application status & notes in Firebase Firestore
   * @param {string} id 
   * @param {Object} updateData 
   */
  async updateApplicationStatus(id, updateData = {}) {
    if (!id) return null;
    if (this.isConnected && this.db) {
      try {
        const docRef = this.db.collection('applications').doc(id);
        const payload = {
          ...updateData,
          updatedAt: new Date().toISOString()
        };
        await docRef.set(payload, { merge: true });
        console.log(`🔥 [Firebase Firestore] Updated Application doc: applications/${id}`);
        return { success: true, id };
      } catch (err) {
        console.error(`⚠️ Firebase updateApplicationStatus error for ${id}:`, err.message);
      }
    }
    return { success: false, mode: 'local' };
  }

  /**
   * Deletes an application from Firebase Firestore
   * @param {string} id 
   */
  async deleteApplication(id) {
    if (!id) return false;
    if (this.isConnected && this.db) {
      try {
        await this.db.collection('applications').doc(id).delete();
        console.log(`🔥 [Firebase Firestore] Deleted Application doc: applications/${id}`);
        return true;
      } catch (err) {
        console.error(`⚠️ Firebase deleteApplication error for ${id}:`, err.message);
      }
    }
    return false;
  }


  /**
   * Saves or updates a real-time OTP session in Firebase Firestore
   * @param {Object} otpSession 
   */
  async saveOtpSession(otpSession) {
    if (!otpSession || !otpSession.email) return null;

    if (this.isConnected && this.db) {
      try {
        const docId = otpSession.email.toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
        const docRef = this.db.collection('otp_verifications').doc(docId);
        const payload = {
          email: otpSession.email,
          mobile: otpSession.mobile || '',
          fullName: otpSession.fullName || '',
          otp: otpSession.otp,
          createdAt: new Date(otpSession.createdAt || Date.now()).toISOString(),
          expiresAt: new Date(otpSession.expiresAt || (Date.now() + 10 * 60 * 1000)).toISOString(),
          attempts: otpSession.attempts || 0,
          verified: !!otpSession.verified,
          verifiedAt: otpSession.verifiedAt ? new Date(otpSession.verifiedAt).toISOString() : null,
          token: otpSession.token || null,
          updatedAt: new Date().toISOString()
        };
        await docRef.set(payload, { merge: true });
        console.log(`🔥 [Firebase Firestore] Synced OTP session doc: otp_verifications/${docId} (Code: ${otpSession.otp})`);
        return { success: true, docId };
      } catch (err) {
        console.error('⚠️ Firebase saveOtpSession error:', err.message);
      }
    }
    return { success: false, mode: 'local' };
  }

  /**
   * Updates OTP verification status to Verified in Firebase Firestore
   * @param {string} email 
   * @param {string} token 
   */
  async updateOtpVerification(email, token) {
    if (!email) return;

    if (this.isConnected && this.db) {
      try {
        const docId = email.toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
        const docRef = this.db.collection('otp_verifications').doc(docId);
        await docRef.set({
          verified: true,
          verifiedAt: new Date().toISOString(),
          token: token || null,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log(`🔥 [Firebase Firestore] Marked OTP Verified for: ${email}`);
      } catch (err) {
        console.error('⚠️ Firebase updateOtpVerification error:', err.message);
      }
    }
  }

  /**
   * Logs dispatched email records into Firebase Firestore
   * @param {Object} emailLog 
   */
  async logEmail(emailLog) {
    if (this.isConnected && this.db) {
      try {
        const docId = emailLog.id || `EML-${Date.now()}`;
        await this.db.collection('email_logs').doc(docId).set({
          ...emailLog,
          syncedAt: new Date().toISOString()
        }, { merge: true });
        console.log(`🔥 [Firebase Firestore] Logged Email: email_logs/${docId}`);
      } catch (err) {
        console.error('⚠️ Firebase logEmail error:', err.message);
      }
    }
  }

  /**
   * Logs dispatched SMS / WhatsApp notification records into Firebase Firestore
   * @param {Object} notifLog 
   */
  async logNotification(notifLog) {
    if (this.isConnected && this.db) {
      try {
        const docId = notifLog.id || `NOTIF-${Date.now()}`;
        await this.db.collection('notification_logs').doc(docId).set({
          ...notifLog,
          syncedAt: new Date().toISOString()
        }, { merge: true });
        console.log(`🔥 [Firebase Firestore] Logged Notification: notification_logs/${docId}`);
      } catch (err) {
        console.error('⚠️ Firebase logNotification error:', err.message);
      }
    }
  }

  /**
   * Syncs an array of all current applications from local store to Firebase
   * @param {Array} apps 
   */
  async syncAllApplications(apps = []) {
    if (!this.isConnected || !this.db || !Array.isArray(apps)) return;

    try {
      const batch = this.db.batch();
      apps.forEach(app => {
        if (app.id) {
          const ref = this.db.collection('applications').doc(app.id);
          batch.set(ref, { ...app, syncedAt: new Date().toISOString() }, { merge: true });
        }
      });
      await batch.commit();
      console.log(`🔥 [Firebase Firestore] Synced ${apps.length} applications to Firebase!`);
    } catch (err) {
      console.error('⚠️ Firebase bulk sync error:', err.message);
    }
  }

  /**
   * Searches for a student application in Cloud Firestore
   * @param {string} query 
   * @param {string} digits 
   */
  async findApplication(query, digits = '') {
    if (!this.isConnected || !this.db) return null;
    try {
      const snap = await this.db.collection('applications').get();
      let found = null;
      const cleanQ = (query || '').toLowerCase().trim();
      const last10Q = digits.length >= 10 ? digits.slice(-10) : digits;

      snap.forEach(doc => {
        if (found) return;
        const data = doc.data();
        const id = (data.id || '').toLowerCase().trim();
        const email = (data.email || '').toLowerCase().trim();
        const mDigits = (data.mobile || '').replace(/\D/g, '');
        const last10M = mDigits.length >= 10 ? mDigits.slice(-10) : mDigits;

        if (id === cleanQ || email === cleanQ) {
          found = data;
        } else if (digits.length >= 7 && (mDigits.includes(digits) || digits.includes(mDigits))) {
          found = data;
        } else if (last10Q.length >= 10 && last10M === last10Q) {
          found = data;
        }
      });
      return found;
    } catch (err) {
      console.warn('⚠️ Firebase findApplication error:', err.message);
      return null;
    }
  }

  /**
   * Fetches all registered applications directly from Cloud Firestore
   */
  async fetchApplicationsFromCloud() {
    if (!this.isConnected || !this.db) return [];
    try {
      const snap = await this.db.collection('applications').get();
      const list = [];
      snap.forEach(doc => list.push(doc.data()));
      return list;
    } catch (err) {
      console.warn('⚠️ Firebase fetchApplications error:', err.message);
      return [];
    }
  }

  /**
   * Synchronizes the entire local database payload to Firebase Cloud Firestore
   * @param {Object} dbData 
   */
  async syncEntireDatabase(dbData) {
    if (!this.isConnected || !this.db || !dbData) return { success: false, mode: 'local' };
    try {
      const batch = this.db.batch();

      // 1. Sync Applications
      if (Array.isArray(dbData.applications)) {
        dbData.applications.forEach(app => {
          if (app.id) {
            const ref = this.db.collection('applications').doc(app.id);
            batch.set(ref, { ...app, syncedAt: new Date().toISOString() }, { merge: true });
          }
        });
      }

      // 2. Sync Email Logs
      if (Array.isArray(dbData.emailLogs)) {
        dbData.emailLogs.forEach(em => {
          const docId = em.id || `EML-${Date.now()}`;
          const ref = this.db.collection('email_logs').doc(docId);
          batch.set(ref, { ...em, syncedAt: new Date().toISOString() }, { merge: true });
        });
      }

      await batch.commit();
      console.log(`🔥 [Firebase Firestore] Synced full database to cloud! (${dbData.applications?.length || 0} apps, ${dbData.emailLogs?.length || 0} emails)`);
      return { success: true, count: dbData.applications?.length || 0 };
    } catch (err) {
      console.error('⚠️ Firebase full database sync error:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Returns current connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      projectId: this.projectId,
      cloudStorage: 'Firebase Firestore',
      collections: ['applications', 'otp_verifications', 'email_logs', 'notification_logs'],
      mode: this.isConnected ? 'LIVE_FIREBASE_FIRESTORE' : 'HYBRID_LOCAL_FALLBACK'
    };
  }
}

module.exports = new FirebaseService();
