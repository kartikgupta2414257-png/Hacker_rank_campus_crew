/**
 * OTP Verification Service for HackerRank Campus Crew — Amrapali University
 * Handles generation, dispatch, storage, rate-limiting, and verification of real-time OTPs.
 * 
 * Campus Ambassador: Anil Pandey (7900546102)
 */

const crypto = require('crypto');
const emailService = require('./emailService');
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
   * Sends a real-time unique OTP to the user's email and synchronizes it to Firebase.
   * @param {Object} param0 
   */
  async sendOtp({ email, fullName }) {
    if (!email || !this.isValidEmail(email)) {
      throw new Error('Please enter a valid, authentic email address (e.g., student@gmail.com or student@amrapali.ac.in).');
    }

    const cleanEmail = email.trim().toLowerCase();
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
      fullName: studentName,
      createdAt: now,
      expiresAt,
      attempts: 0,
      verified: false,
      token: null,
      history
    };

    // Do not activate the OTP until SMTP confirms it was accepted for delivery.
    let emailResult;
    try {
      emailResult = await emailService.sendOtpEmail({
        email: cleanEmail,
        fullName: studentName,
        otp
      });
    } catch (err) {
      console.error('⚠️ Failed to dispatch live OTP email:', err.message);
      throw new Error(`Could not send the OTP email: ${err.message}`);
    }

    if (!emailResult || !emailResult.delivered) {
      const deliveryError = emailResult && (emailResult.error || (emailResult.logEntry && emailResult.logEntry.error));
      const authHelp = deliveryError && /5\.7\.[89]|invalid login|authentication/i.test(deliveryError)
        ? ' For Gmail, use a Google App Password (requires 2-Step Verification), not your regular account password.'
        : '';
      const message = `Could not send the OTP email. Check SMTP_USER, SMTP_PASS, and SMTP settings.${authHelp}`;
      console.error(`[OTP email delivery failed] ${deliveryError || 'SMTP is not configured.'}`);
      throw new Error(message);
    }

    this.otpStore.set(cleanEmail, sessionData);

    try {
      await firebaseService.saveOtpSession(sessionData);
    } catch (fbErr) {
      console.warn('Firebase OTP sync notice:', fbErr.message);
    }

    return {
      success: true,
      message: `OTP sent to ${cleanEmail}. Please check your inbox and spam folder.`,
      email: cleanEmail,
      expiresInMinutes: ttlMinutes,
      firebaseSynced: firebaseService.isConnected,
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
