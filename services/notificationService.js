/**
 * Notification Service for HackerRank Campus Crew — Amrapali University
 * Handles Email, SMS, and WhatsApp notification dispatch for Student Coordinators.
 * 
 * Campus Ambassador: Anil Pandey (7900546102)
 * Official Discord: https://discord.gg/m6ZMnSunx
 */

const emailService = require('./emailService');
const store = require('../data/store');

class NotificationService {
  constructor() {
    this.discordLink = 'https://discord.gg/m6ZMnSunx';
  }

  /**
   * Sanitizes and normalizes Indian mobile numbers into standard formats:
   * - clean10: 10-digit raw number (e.g., 9876543210)
   * - e164: +919876543210
   * - withCountry: 919876543210
   */
  normalizeIndianMobile(mobile) {
    if (!mobile || typeof mobile !== 'string') return null;
    let digits = mobile.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
      digits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith('0')) {
      digits = digits.slice(1);
    }
    const isValid = digits.length === 10 && /^[6-9]\d{9}$/.test(digits);
    return {
      isValid,
      clean10: digits,
      e164: `+91${digits}`,
      withCountry: `91${digits}`
    };
  }

  /**
   * Attempts live dispatch via Indian SMS gateways (Fast2SMS / Twilio / Custom DLT Gateway)
   */
  async dispatchViaSmsGateway({ clean10, e164, otp, message }) {
    const fast2smsKey = process.env.FAST2SMS_API_KEY;
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
    const customGatewayUrl = process.env.SMS_GATEWAY_URL;

    // 1. Fast2SMS (Popular in India: supports Quick OTP route without complex DLT for dev/testing)
    if (fast2smsKey) {
      try {
        console.log(`📡 [Fast2SMS Gateway] Triggering real-time OTP to ${clean10}...`);
        const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            'authorization': fast2smsKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            route: 'otp',
            variables_values: String(otp),
            numbers: clean10
          })
        });
        const result = await response.json();
        if (result.return) {
          console.log(`✅ [Fast2SMS Success] OTP delivered to +91 ${clean10}! Request ID:`, result.request_id);
          return { success: true, gateway: 'Fast2SMS', requestId: result.request_id };
        } else {
          console.warn(`⚠️ [Fast2SMS Notice] Gateway response:`, result.message);
          return { success: false, gateway: 'Fast2SMS', error: result.message };
        }
      } catch (err) {
        console.error('⚠️ [Fast2SMS Exception]:', err.message);
        return { success: false, gateway: 'Fast2SMS', error: err.message };
      }
    }

    // 2. Twilio Gateway (+91 E.164 formatting)
    if (twilioSid && twilioToken && twilioPhone) {
      try {
        console.log(`📡 [Twilio Gateway] Triggering SMS to ${e164}...`);
        const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
        const params = new URLSearchParams();
        params.append('To', e164);
        params.append('From', twilioPhone);
        params.append('Body', message);

        const auth = Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64');
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params.toString()
        });
        const result = await response.json();
        if (response.ok) {
          console.log(`✅ [Twilio Success] SMS dispatched to ${e164}! SID:`, result.sid);
          return { success: true, gateway: 'Twilio', sid: result.sid };
        } else {
          console.warn(`⚠️ [Twilio Error]:`, result.message, `Code: ${result.code}`);
          return { success: false, gateway: 'Twilio', error: result.message, code: result.code };
        }
      } catch (err) {
        console.error('⚠️ [Twilio Exception]:', err.message);
        return { success: false, gateway: 'Twilio', error: err.message };
      }
    }

    // 3. Custom Indian DLT SMS Gateway Webhook
    if (customGatewayUrl) {
      try {
        console.log(`📡 [Custom DLT Gateway] Sending request to ${customGatewayUrl}...`);
        const response = await fetch(customGatewayUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(process.env.SMS_GATEWAY_KEY ? { 'Authorization': `Bearer ${process.env.SMS_GATEWAY_KEY}` } : {})
          },
          body: JSON.stringify({
            mobile: clean10,
            mobile_e164: e164,
            otp: String(otp),
            message: message,
            sender_id: process.env.SMS_SENDER_ID || 'AMRAPU',
            template_id: process.env.SMS_DLT_TE_ID || ''
          })
        });
        const result = await response.json();
        console.log(`✅ [Custom Gateway Response]:`, result);
        return { success: response.ok, gateway: 'Custom', result };
      } catch (err) {
        console.error('⚠️ [Custom Gateway Exception]:', err.message);
        return { success: false, gateway: 'Custom', error: err.message };
      }
    }

    // No live SMS gateway configured
    return {
      success: false,
      gateway: 'None',
      reason: 'No SMS Gateway API Key present in .env. Running in Hybrid Mode with WhatsApp/Email/Dev dispatch.'
    };
  }

  /**
   * Dispatches OTP verification message to applicant's mobile & WhatsApp
   * @param {Object} param0 
   */
  async dispatchOtpNotification({ mobile, email, fullName, otp }) {
    const norm = this.normalizeIndianMobile(mobile);
    const cleanMobile = norm ? norm.clean10 : (mobile || '').replace(/\D/g, '');
    const e164 = norm ? norm.e164 : (cleanMobile ? `+91${cleanMobile}` : '');
    const smsMessage = `HackerRank Campus Crew AU: Your verification OTP is ${otp}. Valid for 10 minutes to authenticate your application at Amrapali University. Do not share with anyone.`;

    // Attempt live SMS Gateway
    let gatewayResult = { success: false, gateway: 'None' };
    if (norm && norm.isValid) {
      gatewayResult = await this.dispatchViaSmsGateway({
        clean10: cleanMobile,
        e164,
        otp,
        message: smsMessage
      });
    } else {
      console.warn(`⚠️ [Mobile Validation] Provided number '${mobile}' is not a standard 10-digit Indian mobile.`);
    }

    const smsLog = {
      mobile: mobile || 'Not Provided',
      normalizedE164: e164,
      email: email,
      studentName: fullName || 'Candidate',
      otp: otp,
      message: smsMessage,
      type: 'MOBILE_OTP_VERIFICATION',
      status: gatewayResult.success ? `Delivered via ${gatewayResult.gateway}` : 'Hybrid Direct / Development Simulation',
      gatewayInfo: gatewayResult,
      timestamp: new Date().toISOString()
    };

    if (typeof store.logNotification === 'function') {
      store.logNotification(smsLog);
    }

    console.log(`📱 [SMS/WhatsApp OTP Dispatch] To: ${mobile} (${e164}) | Code: [${otp}] | Status: ${smsLog.status}`);

    const encodedMsg = encodeURIComponent(smsMessage);
    const whatsappUrl = cleanMobile ? `https://api.whatsapp.com/send?phone=91${cleanMobile}&text=${encodedMsg}` : '';
    const smsUrl = cleanMobile ? `sms:${cleanMobile}?body=${encodedMsg}` : '';

    return {
      smsMessage,
      whatsappUrl,
      smsUrl,
      otp,
      gatewayResult
    };
  }

  /**
   * Dispatches both email and SMS/messaging confirmations to applicant
   * @param {Object} student 
   */
  async dispatchRegistrationConfirmation(student) {
    const cleanMobile = (student.mobile || '').replace(/\D/g, '');
    const smsMessage = `HackerRank Campus Crew AU: Hello ${student.fullName}! You have been registered successfully (ID: ${student.id})! Connect to our official Discord community: ${this.discordLink} — Campus Ambassador Anil Pandey (7900546102).`;

    // 1. Send / Log Email
    let emailResult = null;
    try {
      emailResult = await emailService.sendCoordinatorRegistrationEmail(student);
    } catch (err) {
      console.error('Email dispatch error:', err.message);
    }

    // 2. Dispatch / Log SMS & Mobile Message (only if candidate provided mobile)
    if (cleanMobile) {
      const smsLog = {
        mobile: student.mobile,
        studentName: student.fullName,
        applicationId: student.id,
        message: smsMessage,
        type: 'SMS_AND_WHATSAPP',
        status: 'Dispatched (Simulated Gateway)',
        timestamp: new Date().toISOString()
      };

      if (typeof store.logNotification === 'function') {
        store.logNotification(smsLog);
      }

      console.log(`📱 [SMS/WhatsApp Dispatch] To: ${student.mobile} | Message: "${smsMessage}"`);
    }

    // 3. Generate direct messaging intent links
    const encodedMsg = encodeURIComponent(smsMessage);
    const whatsappUrl = cleanMobile ? `https://api.whatsapp.com/send?phone=91${cleanMobile}&text=${encodedMsg}` : '';
    const smsUrl = cleanMobile ? `sms:${cleanMobile}?body=${encodedMsg}` : '';

    // 4. Generate direct mailto link for one-click opening in Gmail/Mail on Phone & Laptop
    const mailSubject = encodeURIComponent("You have been registered successfully — HackerRank Campus Crew");
    const mailBody = encodeURIComponent(
      `Hello ${student.fullName},\n\nYou have been registered successfully for the Student Coordinator position (${student.id}) at HackerRank Campus Crew, Amrapali University!\n\nOfficial Discord Server: ${this.discordLink}\n\nCampus Ambassador: Anil Pandey (7900546102)\nAmrapali University, Haldwani\nCollege Email: au-250303050423@amrapali.ac.in\nAlternate Email: ap967143@gmail.com`
    );
    const mailtoUrl = `mailto:${student.email}?subject=${mailSubject}&body=${mailBody}`;

    return {
      emailResult,
      smsMessage,
      whatsappUrl,
      smsUrl,
      mailtoUrl,
      discordLink: this.discordLink
    };
  }

  /**
   * Dispatches status update notification (Selected, Shortlisted, Rejected) via Email & SMS/WhatsApp
   */
  async dispatchStatusUpdateNotification(student, status, notes = '') {
    if (!student) return null;
    const cleanMobile = (student.mobile || '').replace(/\D/g, '');
    let statusText = `Status updated to ${status}`;
    if (status === 'Selected') statusText = '🎉 Congratulations! You have been Selected as Student Coordinator';
    else if (status === 'Shortlisted') statusText = '⭐ You have been Shortlisted for Interview Round';
    else if (status === 'Rejected') statusText = 'Application Status Update';

    const smsMessage = `HackerRank Campus Crew AU: Hello ${student.fullName}! ${statusText} (ID: ${student.id}). Details on Discord: ${this.discordLink} — Anil Pandey (7900546102).`;

    let emailResult = null;
    try {
      if (emailService && typeof emailService.sendStatusUpdateEmail === 'function') {
        emailResult = await emailService.sendStatusUpdateEmail(student, status, notes);
      }
    } catch (err) {
      console.warn('Status email error:', err.message);
    }

    const smsLog = {
      mobile: student.mobile,
      studentName: student.fullName,
      applicationId: student.id,
      message: smsMessage,
      type: `STATUS_UPDATE_${status.toUpperCase()}`,
      status: 'Dispatched (Simulated Gateway)',
      timestamp: new Date().toISOString()
    };

    if (store && typeof store.logNotification === 'function') {
      try {
        store.logNotification(smsLog);
      } catch (e) { }
    }

    const encodedMsg = encodeURIComponent(smsMessage);
    const whatsappUrl = cleanMobile ? `https://api.whatsapp.com/send?phone=91${cleanMobile}&text=${encodedMsg}` : '';
    const smsUrl = cleanMobile ? `sms:${cleanMobile}?body=${encodedMsg}` : '';

    return {
      success: true,
      emailResult,
      smsMessage,
      whatsappUrl,
      smsUrl
    };
  }
}

module.exports = new NotificationService();

