const nodemailer = require('nodemailer');

let store = null;
try {
  store = require('../data/store');
} catch (e) {
  store = null;
}

class EmailService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    const host = process.env.SMTP_HOST || 'smtp.gmail.com';
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = Number(process.env.SMTP_PORT || 587);

    if (user && pass && user !== 'your_email@gmail.com' && pass !== 'your_gmail_app_password') {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: { user, pass }
        });
        console.log('✅ Live SMTP / Gmail Email Transport initialized for:', user);
      } catch (err) {
        console.error('⚠️ Failed to initialize SMTP transporter:', err.message);
      }
    }
  }

  safeLogEmail(payload) {
    if (store && typeof store.logEmail === 'function') {
      try {
        return store.logEmail(payload);
      } catch (err) {
        console.warn('Store logEmail note:', err.message);
      }
    }
    return payload;
  }

  /**
   * Sends OTP, registration, and status emails through the configured SMTP server.
   */
  async deliverMail({ to, subject, html, text, fromName, fromEmail }) {
    let delivered = false;
    let provider = null;
    let errorDetails = this.transporter ? null : 'SMTP_USER and SMTP_PASS must be configured.';
    let messageId = null;

    if (this.transporter) {
      try {
        const smtpFrom = fromEmail || process.env.SMTP_FROM || process.env.SMTP_USER;
        const info = await this.transporter.sendMail({
          from: `"${fromName || 'HackerRank Campus Crew AU'}" <${smtpFrom}>`,
          to,
          subject,
          text,
          html
        });
        delivered = true;
        provider = 'SMTP';
        messageId = info.messageId;
        console.log(`✉️ Live email successfully sent to ${to} via SMTP`);
      } catch (err) {
        console.error('⚠️ SMTP email sending failed:', err.message);
        errorDetails = errorDetails ? `${errorDetails} | SMTP: ${err.message}` : err.message;
      }
    }

    return {
      delivered,
      provider: delivered ? provider : 'Simulated / Logged',
      errorDetails,
      messageId
    };
  }

  /**
   * Dispatches real-time OTP verification email through SMTP
   * @param {Object} param0 
   */
  async sendOtpEmail({ email, fullName, otp }) {
    const subject = `Your Verification Code: ${otp} — HackerRank Campus Crew`;
    const plainText = `Hello ${fullName || 'Candidate'},

Your one-time verification code (OTP) for registration at HackerRank Campus Crew, Amrapali University is:

${otp}

This code is valid for 10 minutes. Please enter this code on the registration page to authenticate your email address.
Do NOT share this code with anyone.

Regards,
Anil Pandey
Campus Ambassador — HackerRank Campus Crew
Amrapali University, Haldwani
Phone: 7900546102
Email: au-250303050423@amrapali.ac.in / ap967143@gmail.com`;

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #0f141c; color: #e6edf3; border-radius: 8px; border: 1px solid #1f2937; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #091e13 0%, #0d1117 100%); padding: 24px; border-bottom: 2px solid #00ea64;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 26px; font-weight: bold; color: #00ea64; letter-spacing: -0.5px;">[H] HackerRank</span>
            <span style="color: #9ca3af; font-size: 14px; margin-left: 8px;">Campus Crew &bull; Amrapali University</span>
          </div>
          <h2 style="color: #ffffff; margin: 16px 0 4px 0; font-size: 20px;">Email Verification Code (OTP)</h2>
          <p style="color: #94a3b8; margin: 0; font-size: 13px;">Authentic Email Verification for Candidate Registration</p>
        </div>
        
        <div style="padding: 24px; line-height: 1.6; color: #d1d5db; font-size: 15px;">
          <p style="font-size: 16px; color: #f3f4f6;">Hello <strong style="color: #00ea64;">${fullName || 'Candidate'}</strong>,</p>
          
          <p>Please use the following One-Time Password (OTP) to authenticate your email address and verify your application for HackerRank Campus Crew, Amrapali University:</p>
          
          <!-- Big OTP Display Box -->
          <div style="background: #111827; border: 2px dashed #00ea64; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
            <div style="font-size: 12px; color: #9ca3af; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;">Your Verification Code</div>
            <div style="font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #00ea64; font-family: 'JetBrains Mono', Consolas, monospace;">${otp}</div>
            <div style="font-size: 13px; color: #38bdf8; margin-top: 8px;">
              <i style="font-style: normal;">&#9201;</i> Valid for 10 minutes &bull; Single-use only
            </div>
          </div>
          
          <p style="color: #94a3b8; font-size: 13px;">
            If you did not request this code, you can safely ignore this email. Never share this code with anyone.
          </p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #1f2937;">
            <p style="margin: 0; color: #9ca3af; font-size: 14px;">Regards,</p>
            <p style="margin: 4px 0 0 0; color: #00ea64; font-weight: bold; font-size: 16px;">Anil Pandey</p>
            <p style="margin: 2px 0; color: #cbd5e1; font-size: 13px;">Campus Ambassador &mdash; HackerRank Campus Crew</p>
            <p style="margin: 2px 0; color: #94a3b8; font-size: 13px;">Amrapali University, Haldwani</p>
            <p style="margin: 4px 0; color: #94a3b8; font-size: 12px;">
              Phone: <strong>7900546102</strong> &bull; Email: <a href="mailto:au-250303050423@amrapali.ac.in" style="color: #38bdf8;">au-250303050423@amrapali.ac.in</a> / <a href="mailto:ap967143@gmail.com" style="color: #38bdf8;">ap967143@gmail.com</a>
            </p>
          </div>
        </div>
        
        <div style="background: #090d13; padding: 14px 24px; text-align: center; font-size: 11px; color: #6b7280; border-top: 1px solid #1f2937;">
          This is an automated security verification message from HackerRank Campus Crew at Amrapali University, Haldwani.
          <br>&copy; ${new Date().getFullYear()} HackerRank Campus Crew AU. All rights reserved.
        </div>
      </div>
    `;

    const delivery = await this.deliverMail({
      to: email,
      subject,
      html: htmlBody,
      text: plainText,
      fromName: 'HackerRank Campus Crew AU'
    });

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainText)}`;
    const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainText)}`;

    const logEntry = this.safeLogEmail({
      to: email,
      studentName: fullName || 'Candidate',
      subject,
      body: plainText,
      html: htmlBody,
      type: 'EMAIL_OTP_VERIFICATION',
      status: delivery.delivered ? `Delivered (${delivery.provider})` : 'Logged (Simulated / Ready for Direct Webmail)',
      error: delivery.errorDetails,
      provider: delivery.provider,
      messageId: delivery.messageId
    });

    return {
      delivered: delivery.delivered,
      logEntry,
      liveTransport: delivery.delivered,
      provider: delivery.provider,
      messageId: delivery.messageId,
      error: delivery.errorDetails,
      gmailUrl,
      mailtoUrl
    };
  }

  /**
   * Dispatches registration confirmation email through SMTP
   */
  async sendCoordinatorRegistrationEmail(student) {
    const discordLink = "https://discord.gg/m6ZMnSunx";
    const subject = "You have been registered successfully — HackerRank Campus Crew";
    const plainText = `Hello ${student.fullName},

You have been registered successfully!

Your registration for the Student Coordinator position at HackerRank Campus Crew, Amrapali University, has been submitted successfully!

Thank you for your interest. Your application will be reviewed, and shortlisted candidates will be contacted with further updates.

Official Discord Community:
Join our Discord server now to connect with Campus Ambassador Anil Pandey and receive contest updates:
${discordLink}

Please note that registration does not guarantee selection.

Application Details:
- Application ID: ${student.id}
- Course & Year: ${student.course} (${student.year}, Sem ${student.semester})
- College: ${student.collegeName}
- Submitted: ${new Date(student.appliedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}

Regards,
Anil Pandey
Campus Ambassador — HackerRank Campus Crew
Amrapali University, Haldwani
Phone: 7900546102
Email: au-250303050423@amrapali.ac.in / ap967143@gmail.com`;

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #0f141c; color: #e6edf3; border-radius: 8px; border: 1px solid #1f2937; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #091e13 0%, #0d1117 100%); padding: 24px; border-bottom: 2px solid #00ea64;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 26px; font-weight: bold; color: #00ea64; letter-spacing: -0.5px;">[H] HackerRank</span>
            <span style="color: #9ca3af; font-size: 14px; margin-left: 8px;">Campus Crew &bull; Amrapali University</span>
          </div>
          <h2 style="color: #ffffff; margin: 16px 0 4px 0; font-size: 22px;">
            &#9989; You Have Been Registered Successfully!
          </h2>
          <p style="color: #94a3b8; margin: 0; font-size: 13px;">Official Acknowledgment of Candidate Application</p>
        </div>
        
        <div style="padding: 24px; line-height: 1.6; color: #d1d5db; font-size: 15px;">
          <p style="font-size: 16px; color: #f3f4f6;">Hello <strong style="color: #00ea64;">${student.fullName}</strong>,</p>
          
          <div style="background: rgba(0, 234, 100, 0.1); border-left: 4px solid #00ea64; padding: 14px 18px; margin: 18px 0; border-radius: 4px;">
            <strong style="color: #00ea64; font-size: 16px;">Registration Confirmed: You have been registered successfully!</strong>
            <p style="margin: 4px 0 0 0; color: #d1d5db; font-size: 14px;">
              Your application for the <strong>Student Coordinator position (12 Seats Quota)</strong> at <strong>HackerRank Campus Crew, Amrapali University</strong> has been officially received and authenticated.
            </p>
          </div>
          
          <p>Thank you for your interest. Your application will be reviewed, and shortlisted candidates will be contacted with further updates regarding interview rounds.</p>
          
          <div style="background: #161f2e; border: 1px solid #1f2937; padding: 14px 18px; margin: 20px 0; border-radius: 6px;">
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">Application Summary</p>
            <p style="margin: 4px 0; color: #f3f4f6;"><strong>Application ID:</strong> <span style="color: #38bdf8; font-family: monospace; font-weight: bold;">${student.id}</span></p>
            <p style="margin: 4px 0; color: #f3f4f6;"><strong>Program:</strong> ${student.course} &bull; ${student.year} (Sem ${student.semester})</p>
            <p style="margin: 4px 0; color: #f3f4f6;"><strong>Institution:</strong> ${student.collegeName}</p>
            <p style="margin: 4px 0; color: #f3f4f6;"><strong>Technical Skills:</strong> ${Array.isArray(student.technicalSkills) ? student.technicalSkills.join(', ') : student.technicalSkills}</p>
          </div>

          <!-- Official Discord Callout Box -->
          <div style="background: rgba(88, 101, 242, 0.12); border: 1px solid #5865f2; padding: 16px 20px; border-radius: 6px; margin: 22px 0; text-align: center;">
            <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: bold; color: #ffffff;">🎮 Join Our Official Campus Crew Discord Server</p>
            <p style="margin: 0 0 14px 0; font-size: 13px; color: #94a3b8;">Stay updated with interview schedules, campus hackathons, and mentor discussions with Anil Pandey.</p>
            <a href="${discordLink}" style="display: inline-block; background: #5865f2; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-weight: bold; font-size: 14px;">Connect on Discord Server</a>
          </div>
          
          <p style="color: #f59e0b; font-size: 13px; background: rgba(245, 158, 11, 0.1); padding: 10px 14px; border-radius: 6px;">
            <em>Please note that registration does not guarantee selection. Screening is based on skills, technical enthusiasm, and peer leadership.</em>
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #1f2937;">
            <p style="margin: 0; color: #9ca3af; font-size: 14px;">Regards,</p>
            <p style="margin: 4px 0 0 0; color: #00ea64; font-weight: bold; font-size: 16px;">Anil Pandey</p>
            <p style="margin: 2px 0; color: #cbd5e1; font-size: 13px;">Campus Ambassador &mdash; HackerRank Campus Crew</p>
            <p style="margin: 2px 0; color: #94a3b8; font-size: 13px;">Amrapali University, Haldwani</p>
            <p style="margin: 4px 0; color: #94a3b8; font-size: 12px;">
              Phone: <strong>7900546102</strong> &bull; Email: <a href="mailto:au-250303050423@amrapali.ac.in" style="color: #38bdf8;">au-250303050423@amrapali.ac.in</a> / <a href="mailto:ap967143@gmail.com" style="color: #38bdf8;">ap967143@gmail.com</a>
            </p>
          </div>
        </div>
        
        <div style="background: #090d13; padding: 14px 24px; text-align: center; font-size: 11px; color: #6b7280; border-top: 1px solid #1f2937;">
          This is an official communication from HackerRank Campus Crew at Amrapali University, Haldwani. 
          <br>&copy; ${new Date().getFullYear()} HackerRank Campus Crew AU. All rights reserved.
        </div>
      </div>
    `;

    const delivery = await this.deliverMail({
      to: student.email,
      subject,
      html: htmlBody,
      text: plainText,
      fromName: 'Anil Pandey (Campus Crew AU)'
    });

    const logPayload = {
      to: student.email,
      studentName: student.fullName,
      subject,
      body: plainText,
      html: htmlBody,
      type: 'REGISTRATION_CONFIRMATION',
      status: delivery.delivered ? `Delivered (${delivery.provider})` : 'Logged (Simulated Outbox)',
      error: delivery.errorDetails,
      provider: delivery.provider,
      messageId: delivery.messageId
    };

    return this.safeLogEmail(logPayload);
  }

  /**
   * Dispatches status update notification email through SMTP
   */
  async sendStatusUpdateEmail(student, status, notes = '') {
    const discordLink = "https://discord.gg/m6ZMnSunx";
    let statusTitle = "Application Status Update";
    let statusColor = "#38bdf8";
    let statusMessage = `Your application status has been updated to: ${status}.`;

    if (status === 'Selected') {
      statusTitle = "🎉 Congratulations! You Are Selected as Student Coordinator";
      statusColor = "#00ea64";
      statusMessage = "Congratulations! Based on your technical skills, leadership, and enthusiasm, you have been officially selected as a Student Coordinator for the HackerRank Campus Crew at Amrapali University!";
    } else if (status === 'Shortlisted') {
      statusTitle = "⭐ You Have Been Shortlisted — HackerRank Campus Crew";
      statusColor = "#f59e0b";
      statusMessage = "Good news! Your application has been shortlisted for the next interview round of HackerRank Campus Crew, Amrapali University.";
    } else if (status === 'Rejected') {
      statusTitle = "Update on Your Campus Crew Application";
      statusColor = "#ef4444";
      statusMessage = "Thank you for applying for the Student Coordinator role. While we are unable to proceed with your application for the 12-seat quota at this time, we encourage you to participate in upcoming campus hackathons and contests!";
    }

    const subject = `${statusTitle} — HackerRank Campus Crew AU`;
    const plainText = `Hello ${student.fullName},

${statusMessage}

Application ID: ${student.id}
Current Status: ${status}
${notes ? `Coordinator Notes: ${notes}\n` : ''}
Join our Discord Server to connect with Campus Ambassador Anil Pandey:
${discordLink}

Regards,
Anil Pandey
Campus Ambassador — HackerRank Campus Crew
Amrapali University, Haldwani
Phone: 7900546102
Email: au-250303050423@amrapali.ac.in / ap967143@gmail.com`;

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background: #0f141c; color: #e6edf3; border-radius: 8px; border: 1px solid #1f2937; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #091e13 0%, #0d1117 100%); padding: 24px; border-bottom: 2px solid ${statusColor};">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 26px; font-weight: bold; color: #00ea64; letter-spacing: -0.5px;">[H] HackerRank</span>
            <span style="color: #9ca3af; font-size: 14px; margin-left: 8px;">Campus Crew &bull; Amrapali University</span>
          </div>
          <h2 style="color: #ffffff; margin: 16px 0 4px 0; font-size: 20px;">${statusTitle}</h2>
        </div>
        
        <div style="padding: 24px; line-height: 1.6; color: #d1d5db; font-size: 15px;">
          <p style="font-size: 16px; color: #f3f4f6;">Hello <strong style="color: #00ea64;">${student.fullName}</strong>,</p>
          
          <div style="background: rgba(255, 255, 255, 0.05); border-left: 4px solid ${statusColor}; padding: 14px 18px; margin: 18px 0; border-radius: 4px;">
            <strong style="color: ${statusColor}; font-size: 16px;">Status: ${status}</strong>
            <p style="margin: 6px 0 0 0; color: #e2e8f0; font-size: 14px;">${statusMessage}</p>
            ${notes ? `<p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 13px;"><em>Note: ${notes}</em></p>` : ''}
          </div>

          <div style="background: rgba(88, 101, 242, 0.12); border: 1px solid #5865f2; padding: 16px 20px; border-radius: 6px; margin: 22px 0; text-align: center;">
            <p style="margin: 0 0 8px 0; font-size: 15px; font-weight: bold; color: #ffffff;">🎮 Connect on Discord</p>
            <a href="${discordLink}" style="display: inline-block; background: #5865f2; color: #ffffff; text-decoration: none; padding: 10px 20px; border-radius: 4px; font-weight: bold; font-size: 14px;">Join Official Discord</a>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #1f2937;">
            <p style="margin: 0; color: #9ca3af; font-size: 14px;">Regards,</p>
            <p style="margin: 4px 0 0 0; color: #00ea64; font-weight: bold; font-size: 16px;">Anil Pandey</p>
            <p style="margin: 2px 0; color: #cbd5e1; font-size: 13px;">Campus Ambassador &mdash; HackerRank Campus Crew</p>
            <p style="margin: 2px 0; color: #94a3b8; font-size: 13px;">Amrapali University, Haldwani</p>
            <p style="margin: 4px 0; color: #94a3b8; font-size: 12px;">
              Phone: <strong>7900546102</strong> &bull; Email: <a href="mailto:au-250303050423@amrapali.ac.in" style="color: #38bdf8;">au-250303050423@amrapali.ac.in</a> / <a href="mailto:ap967143@gmail.com" style="color: #38bdf8;">ap967143@gmail.com</a>
            </p>
          </div>
        </div>
      </div>
    `;

    const delivery = await this.deliverMail({
      to: student.email,
      subject,
      html: htmlBody,
      text: plainText,
      fromName: 'Anil Pandey (Campus Crew AU)'
    });

    const logPayload = {
      to: student.email,
      studentName: student.fullName,
      subject,
      body: plainText,
      html: htmlBody,
      type: `STATUS_UPDATE_${status.toUpperCase()}`,
      status: delivery.delivered ? `Delivered (${delivery.provider})` : 'Logged (Simulated Outbox)',
      error: delivery.errorDetails,
      provider: delivery.provider,
      messageId: delivery.messageId
    };

    return this.safeLogEmail(logPayload);
  }

  async sendSelectionEmail(student, notes) {
    return this.sendStatusUpdateEmail(student, 'Selected', notes);
  }

  async sendShortlistEmail(student, notes) {
    return this.sendStatusUpdateEmail(student, 'Shortlisted', notes);
  }

  async sendRejectionEmail(student, notes) {
    return this.sendStatusUpdateEmail(student, 'Rejected', notes);
  }

  async dispatchEmail(options) {
    const delivery = await this.deliverMail({
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      fromName: options.fromName,
      fromEmail: options.fromEmail
    });

    return {
      success: delivery.delivered,
      status: delivery.delivered ? `Delivered (${delivery.provider})` : 'Logged (Simulated Outbox)',
      provider: delivery.provider,
      messageId: delivery.messageId,
      error: delivery.errorDetails
    };
  }
}

module.exports = new EmailService();
