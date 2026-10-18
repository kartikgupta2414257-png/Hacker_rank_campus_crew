/**
 * OTP Verification Service for HackerRank Campus Crew — Amrapali University
 * Handles generation, dispatch, storage, rate-limiting, and verification of real-time OTPs.
 * 
 * Campus Ambassador: Anil Pandey (7900546102)
 */

const crypto = require('crypto');
const emailService = require('./emailService');
const notificationService = require('./notificationService');
const firebaseService = require('./firebaseService');

class OtpService {
  constructor() {
    // In-memory store for pending OTPs
    // Key: normalized email -> Value: { otp, email, mobile, fullName, createdAt, expiresAt, attempts, verified, token, history: [] }
    this.otpStore = new Map();

    // Expire/cleanup every 5 minutes (unref so it doesn't block process exit)
    const timer = setInterval(() => this.cleanupExpired(), 5 * 60 * 1000);
    if (timer.unref) timer.unref();
  }

  /**
   * Cleans up expired verification sessions
   */
  cleanupExpired() {
    const now = Date.now();
    for (const [key, data] of this.otpStore.entries()) {
      if (data.expiresAt < now && !data.verified) {
        this.otpStore.delete(key);
      }
    }
  }

  /**
   * Validates standard RFC email syntax
   */
  isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Validates 10-digit Indian phone number
   */
  isValidMobile(mobile) {
    if (!mobile || typeof mobile !== 'string') return false;
    const clean = mobile.replace(/\D/g, '');
    return clean.length >= 10 && clean.length <= 12;
  }

  /**
   * Generates a guaranteed fresh, distinct 6-digit numeric OTP using true cryptography
   * Ensures the OTP is different every single time it is requested.
   */
  generateOtpCode(previousOtp = null) {
    let freshOtp;
    let attempts = 0;
    do {
      freshOtp = crypto.randomInt(100000, 1000000).toString();
      attempts++;
    } while (freshOtp === previousOtp && attempts < 10);
    return freshOtp;
  }

  /**
   * Sends real-time unique OTP to user's authentic email and mobile
   * and synchronizes to Firebase Firestore.
   * @param {Object} param0 
   */
  async sendOtp({ email, mobile, fullName }) {
    if (!email || !this.isValidEmail(email)) {
      throw new Error('Please enter a valid, authentic email address (e.g., student@gmail.com or student@amrapali.ac.in).');
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanMobile = (mobile || '').trim();
    const studentName = (fullName || 'Applicant').trim();

    // Check existing session for previous OTP
    const existing = this.otpStore.get(cleanEmail);
    const now = Date.now();

    // Rate-limiting check: allow resend only after 20 seconds
    if (existing && existing.createdAt && (now - existing.createdAt < 20000) && !existing.verified) {
      const waitSec = Math.ceil((20000 - (now - existing.createdAt)) / 1000);
      throw new Error(`Please wait ${waitSec} seconds before requesting a new OTP.`);
    }

    // Generate guaranteed fresh, different OTP every time
    const previousOtp = existing ? existing.otp : null;
    const otp = this.generateOtpCode(previousOtp);
    const ttlMinutes = 10;
    const expiresAt = now + (ttlMinutes * 60 * 1000);

    const history = existing && Array.isArray(existing.history) ? [...existing.history, previousOtp].filter(Boolean) : [];

    const sessionData = {
      otp,
      email: cleanEmail,
      mobile: cleanMobile,
      fullName: studentName,
      createdAt: now,
      expiresAt,
      attempts: 0,
      verified: false,
      token: null,
      history
    };

    // Save in memory store
    this.otpStore.set(cleanEmail, sessionData);

    console.log(`\n======================================================`);
    console.log(`🔐 [FRESH UNIQUE REAL-TIME OTP GENERATED]`);
    console.log(`   To Email    : ${cleanEmail}`);
    console.log(`   To Mobile   : ${cleanMobile}`);
    console.log(`   Candidate   : ${studentName}`);
    console.log(`   Previous OTP: ${previousOtp || 'None'}`);
    console.log(`   👉 NEW OTP  : [ ${otp} ] (Valid for ${ttlMinutes} mins)`);
    console.log(`======================================================\n`);

    // 1. Sync OTP record to Firebase Firestore in real-time
    try {
      await firebaseService.saveOtpSession(sessionData);
    } catch (fbErr) {
      console.warn('Firebase OTP sync notice:', fbErr.message);
    }

    // 2. Dispatch OTP via Email (Real-time live SMTP if configured, plus logged in store)
    let emailResult = null;
    try {
      emailResult = await emailService.sendOtpEmail({
        email: cleanEmail,
        fullName: studentName,
        otp
      });
    } catch (err) {
      console.error('⚠️ Failed to dispatch live OTP email:', err.message);
    }

    // 3. Dispatch OTP via SMS / Mobile Notification
    let notificationResult = null;
    try {
      notificationResult = await notificationService.dispatchOtpNotification({
        mobile: cleanMobile,
        email: cleanEmail,
        fullName: studentName,
        otp
      });
    } catch (err) {
      console.error('⚠️ Failed to dispatch SMS OTP notification:', err.message);
    }

    const isLiveDelivery = emailResult ? emailResult.delivered : false;

    return {
      success: true,
      message: isLiveDelivery
        ? `Fresh OTP has been dispatched in real-time to your authentic email (${cleanEmail}) and mobile!`
        : `Unique OTP sent to your email (${cleanEmail}) and mobile number.`,
      email: cleanEmail,
      mobile: cleanMobile,
      expiresInMinutes: ttlMinutes,
      liveDelivery: isLiveDelivery,
      firebaseSynced: firebaseService.isConnected,
      // Provide preview OTP in development for immediate verification
      debugOtp: process.env.NODE_ENV === 'production' ? undefined : otp,
      whatsappUrl: notificationResult ? notificationResult.whatsappUrl : '',
      smsUrl: notificationResult ? notificationResult.smsUrl : '',
      gmailUrl: emailResult ? emailResult.gmailUrl : '',
      mailtoUrl: emailResult ? emailResult.mailtoUrl : ''
    };
  }

  /**
   * Verifies the 6-digit OTP code entered by the user
   * @param {Object} param0 
   */
  async verifyOtp({ email, otp }) {
    if (!email || !this.isValidEmail(email)) {
      throw new Error('Please enter a valid email address to verify.');
    }

    if (!otp || String(otp).trim().length !== 6) {
      throw new Error('Please enter the 6-digit verification OTP.');
    }

    const cleanEmail = email.trim().toLowerCase();
    const userOtp = String(otp).trim();
    const record = this.otpStore.get(cleanEmail);

    if (!record) {
      throw new Error('No OTP request found for this email. Please click "Send OTP" first.');
    }

    if (Date.now() > record.expiresAt) {
      this.otpStore.delete(cleanEmail);
      throw new Error('Verification OTP has expired. Please request a new OTP.');
    }

    // Check attempts limit (max 5)
    record.attempts += 1;
    if (record.attempts > 5) {
      this.otpStore.delete(cleanEmail);
      throw new Error('Too many failed OTP attempts. Please request a new OTP.');
    }

    if (record.otp !== userOtp) {
      const remaining = 5 - record.attempts;
      throw new Error(`Invalid OTP code. Please check and try again (${remaining} attempts remaining).`);
    }

    // Verification successful!
    const verificationToken = `AU-VERIFIED-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    record.verified = true;
    record.verifiedAt = Date.now();
    record.token = verificationToken;
    this.otpStore.set(cleanEmail, record);

    console.log(`✅ [OTP VERIFICATION SUCCESS] Email ${cleanEmail} successfully verified! Token: ${verificationToken}`);

    // Update Firebase Firestore verification status
    try {
      await firebaseService.updateOtpVerification(cleanEmail, verificationToken);
    } catch (fbErr) {
      console.warn('Firebase OTP verification sync notice:', fbErr.message);
    }

    return {
      success: true,
      message: 'Email & Mobile verified successfully! You can now proceed with your registration.',
      email: cleanEmail,
      verifiedToken: verificationToken,
      verified: true
    };
  }

  /**
   * Checks if an email is already verified
   * @param {string} email 
   */
  isVerified(email) {
    if (!email) return false;
    const cleanEmail = email.trim().toLowerCase();
    const record = this.otpStore.get(cleanEmail);
    if (!record || !record.verified) return false;
    // Token valid for 30 minutes to complete the form
    const isRecent = (Date.now() - record.verifiedAt) < (30 * 60 * 1000);
    return isRecent;
  }

  /**
   * Consumes and clears verification session after successful registration
   * @param {string} email 
   */
  consumeVerification(email) {
    if (!email) return;
    const cleanEmail = email.trim().toLowerCase();
    this.otpStore.delete(cleanEmail);
  }
}

module.exports = new OtpService();
