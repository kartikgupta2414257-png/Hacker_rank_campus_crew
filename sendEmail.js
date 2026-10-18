/**
 * ============================================================================
 * HackerRank Campus Crew — Amrapali University, Haldwani
 * File: sendEmail.js
 * Description: High-Reliability Resend Email Dispatcher (https://resend.com)
 * Inspired by: Thapa Technical's Resend Node.js Setup (https://youtu.be/Z3Ikht1QOjo)
 * ============================================================================
 * 
 * FEATURES & ERROR SAFEGUARDS:
 * - Dual Syntax Support: Both sendEmail({ to, subject, html }) & sendEmail(to, subject, html)
 * - Auto-detects custom verified domain vs default onboarding@resend.dev
 * - Zero crash on missing API key or network timeout
 * - ESM & CommonJS compatible (module.exports, named, and default export)
 * - Standalone test mode: Run `node sendEmail.js <email>` in terminal
 */

require('dotenv').config();
const { Resend } = require('resend');

// Global configuration defaults (Easy to modify for future requirements)
const CONFIG = {
  defaultFrom: process.env.RESEND_FROM || 'HackerRank Campus Crew <onboarding@resend.dev>',
  defaultSubject: 'Official Notification — HackerRank Campus Crew AU',
  dashboardUrl: 'https://resend.com/api-keys',
  domainsUrl: 'https://resend.com/domains'
};

/**
 * Returns a configured Resend SDK client instance
 * Lazily initialized so runtime updates to process.env are instantly detected.
 * @returns {Resend|null}
 */
function getResendClient() {
  const key = (process.env.RESEND_API_KEY || '').trim();
  if (key && key !== 're_xxxxxxxxxxxxxxxxxxxxxxxx') {
    try {
      return new Resend(key);
    } catch (err) {
      console.error('[sendEmail.js] Resend client initialization error:', err.message);
    }
  }
  return null;
}

/**
 * Core sendEmail utility function
 * 
 * Usage Examples:
 *   1) Object syntax:
 *      await sendEmail({
 *        to: 'student@example.com',
 *        subject: 'Your OTP Code',
 *        html: '<h1>123456</h1>'
 *      });
 * 
 *   2) Positional syntax:
 *      await sendEmail('student@example.com', 'Subject', '<p>Message</p>');
 * 
 * @param {string|object} optionsOrTo - Recipient email or options object
 * @param {string} [subject] - Subject line (if using positional syntax)
 * @param {string} [html] - HTML content (if using positional syntax)
 * @param {string} [text] - Plain text fallback (optional)
 * @returns {Promise<{success: boolean, data?: object, error?: any}>}
 */
const sendEmail = async (optionsOrTo, subject, html, text) => {
  let to, from, subj, htmlContent, textContent;

  // 1. Normalize parameters from either object or positional syntax
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

  // 2. Validate recipient
  if (!to || (Array.isArray(to) && to.length === 0)) {
    console.error('❌ [sendEmail] Recipient email ("to") is required.');
    return { success: false, error: 'Recipient email ("to") is required.' };
  }

  const recipientList = Array.isArray(to) ? to : [to];
  const sender = from || CONFIG.defaultFrom;
  const resend = getResendClient();

  // 3. Check API key presence
  if (!resend) {
    console.warn('⚠️ [sendEmail] RESEND_API_KEY is not configured or is using placeholder in .env.');
    console.log(`ℹ️ Please add your live Resend API key to .env: ${CONFIG.dashboardUrl}`);
    return {
      success: false,
      error: 'RESEND_API_KEY is missing or unconfigured in .env'
    };
  }

  const payload = {
    from: sender,
    to: recipientList,
    subject: subj || CONFIG.defaultSubject,
    html: htmlContent || `<p>${textContent || 'Notification from HackerRank Campus Crew'}</p>`,
    text: textContent || (htmlContent ? htmlContent.replace(/<[^>]*>?/gm, '') : '')
  };

  const apiKey = (process.env.RESEND_API_KEY || '').trim();

  // Method 1: Official Resend SDK Object with emails.send
  try {
    if (resend && typeof resend.emails?.send === 'function') {
      const { data, error } = await resend.emails.send(payload);

      if (!error && data?.id) {
        console.log(`✅ [Resend SDK Success] Email delivered to ${recipientList.join(', ')} (ID: ${data.id})`);
        return { success: true, data };
      }

      if (error) {
        console.error('❌ [Resend SDK Note]:', error.message || error);
        if (typeof error.message === 'string' && error.message.includes('testing emails to your own email')) {
          console.log(`💡 TIP: Using test sender (${sender}) on free plan only allows sending to the Resend account owner email. Verify your domain at ${CONFIG.domainsUrl} to send to any student email.`);
          return { success: false, error };
        }
      }
    }
  } catch (sdkErr) {
    console.warn('⚠️ [Resend SDK Exception], falling back to direct HTTP Authorization Header:', sdkErr.message);
  }

  // Method 2: Direct Resend HTTP Request with Authorization Bearer Header (as recommended by Resend REST API)
  if (apiKey && apiKey !== 're_xxxxxxxxxxxxxxxxxxxxxxxx') {
    try {
      const httpRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await httpRes.json();

      if (httpRes.ok && data?.id) {
        console.log(`✅ [Resend Auth-Header Success] Email delivered to ${recipientList.join(', ')} (ID: ${data.id})`);
        return { success: true, data };
      }

      console.error('❌ [Resend REST API Response]:', data);
      return { success: false, error: data.message || data };
    } catch (httpErr) {
      console.error('❌ [Resend HTTP Request Error]:', httpErr.message);
      return { success: false, error: httpErr.message };
    }
  }

  return { success: false, error: 'Failed to dispatch email via Resend transport.' };
};

// Export compatibility for both CommonJS and ES Modules
module.exports = sendEmail;
module.exports.sendEmail = sendEmail;
module.exports.default = sendEmail;

// Standalone execution test mode: node sendEmail.js <recipient_email>
if (require.main === module) {
  const testRecipient = process.argv[2] || 'test@example.com';
  console.log(`\n======================================================`);
  console.log(`🚀 [sendEmail.js] Running standalone test`);
  console.log(`   Target Email : ${testRecipient}`);
  console.log(`   Sender       : ${CONFIG.defaultFrom}`);
  console.log(`======================================================\n`);

  sendEmail({
    to: testRecipient,
    subject: 'Verification Test — HackerRank Campus Crew AU (Resend)',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 24px; background: #0b111c; color: #e6edf3; border-radius: 8px; border: 1px solid #1f2937;">
        <h2 style="color: #00ea64; margin-top: 0;">✅ Resend Node.js Email Setup Verified!</h2>
        <p>This is a live test email sent from <code>sendEmail.js</code> based on Thapa Technical's tutorial.</p>
        <p style="color: #94a3b8;">HackerRank Campus Crew &bull; Amrapali University, Haldwani</p>
      </div>
    `
  }).then(res => {
    console.log('Test Execution Result:', res);
    process.exit(res.success ? 0 : 0);
  });
}
