/**
 * SMTP email helper.
 * Standalone test mode: Run `node sendEmail.js <email>` in terminal.
 */
require('dotenv').config();
const nodemailer = require('nodemailer');

const DEFAULT_SUBJECT = 'Official Notification — HackerRank Campus Crew AU';

/**
 * Accepts either sendEmail({ to, subject, html, text }) or
 * sendEmail(to, subject, html, text).
 */
const sendEmail = async (optionsOrTo, subject, html, text) => {
  let to;
  let from;
  let subj;
  let htmlContent;
  let textContent;

  if (typeof optionsOrTo === 'object' && optionsOrTo !== null) {
    to = optionsOrTo.to;
    subj = optionsOrTo.subject || optionsOrTo.subj;
    htmlContent = optionsOrTo.html;
    textContent = optionsOrTo.text;
    from = optionsOrTo.from;
  } else {
    to = optionsOrTo;
    subj = subject;
    htmlContent = html;
    textContent = text;
  }

  if (!to || (Array.isArray(to) && to.length === 0)) {
    return { success: false, error: 'Recipient email ("to") is required.' };
  }

  const smtpUser = (process.env.SMTP_USER || '').trim();
  const smtpPass = (process.env.SMTP_PASS || '').trim();
  if (!smtpUser || !smtpPass || smtpUser === 'your_email@gmail.com' || smtpPass === 'your_gmail_app_password') {
    return { success: false, error: 'SMTP_USER and SMTP_PASS must be configured.' };
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: { user: smtpUser, pass: smtpPass }
  });
  const recipientList = Array.isArray(to) ? to : [to];

  try {
    const info = await transporter.sendMail({
      from: from || process.env.SMTP_FROM || smtpUser,
      to: recipientList,
      subject: subj || DEFAULT_SUBJECT,
      html: htmlContent || `<p>${textContent || 'Notification from HackerRank Campus Crew'}</p>`,
      text: textContent || (htmlContent ? htmlContent.replace(/<[^>]*>?/gm, '') : '')
    });
    console.log(`Email sent to ${recipientList.join(', ')} via SMTP (ID: ${info.messageId})`);
    return { success: true, data: info };
  } catch (err) {
    console.error('[sendEmail] SMTP delivery failed:', err.message);
    return { success: false, error: err.message };
  }
};

module.exports = sendEmail;
module.exports.sendEmail = sendEmail;
module.exports.default = sendEmail;

if (require.main === module) {
  const testRecipient = process.argv[2] || 'test@example.com';
  console.log(`Testing SMTP email delivery to ${testRecipient}`);
  sendEmail({
    to: testRecipient,
    subject: 'Verification Test — HackerRank Campus Crew AU (SMTP)',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 24px; background: #0b111c; color: #e6edf3; border-radius: 8px; border: 1px solid #1f2937;">
        <h2 style="color: #00ea64; margin-top: 0;">SMTP Email Setup Test</h2>
        <p>This is a test email sent from <code>sendEmail.js</code>.</p>
        <p style="color: #94a3b8;">HackerRank Campus Crew &bull; Amrapali University, Haldwani</p>
      </div>
    `
  }).then(result => {
    console.log('Test Execution Result:', result);
    process.exitCode = result.success ? 0 : 1;
  });
}
