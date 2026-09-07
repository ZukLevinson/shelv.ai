import nodemailer from 'nodemailer';
import { db } from '../db/database.js';
import { logAction } from './actionService.js';

export interface LoggedInHolderInfo {
  holderId: string;
  holderName: string;
  userEmail: string;
  userName: string;
  userId: string;
  lastLoginAt: string;
}

export interface SendAlertResult {
  holderId: string;
  holderName: string;
  email: string;
  status: 'sent' | 'simulated' | 'failed' | 'skipped_not_logged_in' | 'throttled';
  subject?: string;
  alertId?: string;
  reason?: string;
}

// Helper: Check if an inventory holder has already logged in
export function getLoggedInHolder(holderId: string): LoggedInHolderInfo | null {
  if (!holderId) return null;

  // 1. Direct coupling via holder_id
  let row = db.prepare(`
    SELECT u.id as user_id, u.email as user_email, u.name as user_name, 
           COALESCE(u.last_login_at, u.created_at) as last_login_at,
           h.id as holder_id, h.name as holder_name, h.email as holder_email
    FROM users u
    JOIN inventory_holders h ON u.holder_id = h.id
    WHERE h.id = ?
    ORDER BY u.last_login_at DESC, u.updated_at DESC
    LIMIT 1
  `).get(holderId) as any;

  // 2. Fallback: match by email (case-insensitive) if holder has an email that matches a user account
  if (!row) {
    row = db.prepare(`
      SELECT u.id as user_id, u.email as user_email, u.name as user_name, 
             COALESCE(u.last_login_at, u.created_at) as last_login_at,
             h.id as holder_id, h.name as holder_name, h.email as holder_email
      FROM users u
      JOIN inventory_holders h ON (h.email IS NOT NULL AND h.email != '' AND LOWER(u.email) = LOWER(h.email))
      WHERE h.id = ?
      ORDER BY u.last_login_at DESC, u.updated_at DESC
      LIMIT 1
    `).get(holderId) as any;
  }

  if (row && row.user_email) {
    return {
      holderId: row.holder_id,
      holderName: row.holder_name || row.user_name,
      userEmail: row.user_email,
      userName: row.user_name,
      userId: row.user_id,
      lastLoginAt: row.last_login_at,
    };
  }

  return null;
}

// Check if an alert was already sent for this reference key recently (cooldown in minutes)
export function isAlertThrottled(referenceKey: string, cooldownMinutes: number = 60): boolean {
  if (!referenceKey) return false;

  const normalizedKey = referenceKey.trim().toUpperCase();
  const recent = db.prepare(`
    SELECT id, created_at FROM email_alerts 
    WHERE reference_key = ? COLLATE NOCASE
      AND created_at >= datetime('now', '-' || ? || ' minutes')
    LIMIT 1
  `).get(normalizedKey, cooldownMinutes) as any;

  return !!recent;
}

// Create Nodemailer Transporter
export function getMailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
  }

  // Fallback: JSON transport for simulation / testing when SMTP is not configured
  return nodemailer.createTransport({
    jsonTransport: true,
  });
}

// Send an email alert and log to database
export async function sendEmailAlert(params: {
  recipientEmail: string;
  recipientName: string;
  holderId: string;
  exceptionType: string;
  referenceKey: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
}): Promise<{ success: boolean; alertId: string; status: 'sent' | 'simulated' | 'failed'; error?: string }> {
  const alertId = 'alert-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const fromAddress = process.env.SMTP_FROM || process.env.EMAIL_FROM || 'shelv.ai Inventory Alerts <alerts@shelv.ai>';
  const isSmtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

  const transporter = getMailTransporter();

  try {
    const mailOptions = {
      from: fromAddress,
      to: `${params.recipientName} <${params.recipientEmail}>`,
      subject: params.subject,
      html: params.bodyHtml,
      text: params.bodyText || params.subject,
    };

    const info = await transporter.sendMail(mailOptions);
    const status = isSmtpConfigured ? 'sent' : 'simulated';

    if (!isSmtpConfigured) {
      console.log(`[Email Alert - Simulated] To: ${params.recipientEmail} (${params.recipientName}) | Subject: "${params.subject}"`);
    } else {
      console.log(`[Email Alert - Sent] To: ${params.recipientEmail} | MessageId: ${info.messageId}`);
    }

    db.prepare(`
      INSERT INTO email_alerts (
        id, recipient_email, recipient_name, holder_id, exception_type, reference_key, subject, body_html, status, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(
      alertId,
      params.recipientEmail,
      params.recipientName,
      params.holderId,
      params.exceptionType,
      params.referenceKey,
      params.subject,
      params.bodyHtml,
      status
    );

    logAction({
      actionType: 'email_alert_sent',
      description: `התראת מייל (${status === 'sent' ? 'נשלחה' : 'סימולציה'}): "${params.subject}" אל ${params.recipientEmail}`,
      entityType: 'email_alert',
      entityId: alertId,
      performedBy: 'מערכת התראות',
      stateAfter: {
        alertId,
        recipientEmail: params.recipientEmail,
        holderId: params.holderId,
        exceptionType: params.exceptionType,
        status,
      }
    });

    return { success: true, alertId, status };
  } catch (err: any) {
    console.error('[Email Alert - Error] Failed to send email to', params.recipientEmail, err);

    db.prepare(`
      INSERT INTO email_alerts (
        id, recipient_email, recipient_name, holder_id, exception_type, reference_key, subject, body_html, status, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'failed', ?)
    `).run(
      alertId,
      params.recipientEmail,
      params.recipientName,
      params.holderId,
      params.exceptionType,
      params.referenceKey,
      params.subject,
      params.bodyHtml,
      err.message || String(err)
    );

    return { success: false, alertId, status: 'failed', error: err.message };
  }
}

// Generate styled HTML email wrapper with shelv.ai branding
function generateEmailTemplate(title: string, badgeText: string, contentHtml: string): string {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';

  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #030712; color: #f3f4f6; margin: 0; padding: 20px; direction: rtl; }
    .container { max-width: 600px; margin: 0 auto; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .header { background: linear-gradient(135deg, #065f46 0%, #047857 50%, #059669 100%); padding: 24px; text-align: center; }
    .header-logo { display: inline-block; width: 44px; height: 44px; line-height: 44px; background: rgba(255,255,255,0.2); color: #ffffff; border-radius: 12px; font-weight: 900; font-size: 24px; margin-bottom: 8px; }
    .header h1 { color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; background-color: #dc2626; color: #fee2e2; margin-top: 8px; }
    .content { padding: 24px; }
    .card { background-color: #1f2937; border: 1px solid #374151; border-radius: 12px; padding: 16px; margin: 16px 0; }
    .item-prop { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #374151; font-size: 13px; }
    .item-prop:last-child { border-bottom: none; }
    .prop-label { color: #9ca3af; font-weight: 500; }
    .prop-val { color: #f9fafb; font-weight: 600; text-align: left; }
    .prop-val-highlight { color: #f87171; font-weight: 700; }
    .btn { display: inline-block; width: 100%; box-sizing: border-box; text-align: center; background-color: #10b981; color: #ffffff; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; margin-top: 20px; }
    .footer { text-align: center; padding: 16px; font-size: 11px; color: #6b7280; border-top: 1px solid #1f2937; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-logo">S</div>
      <h1>shelv.ai - התראת חריגת מצאי</h1>
      <div><span class="badge">${badgeText}</span></div>
    </div>
    <div class="content">
      ${contentHtml}
      <a href="${appUrl}" class="btn">כניסה למערכת shelv.ai לבירור וטיפול בחריגה</a>
    </div>
    <div class="footer">
      הודעה זו נשלחה באופן אוטומטי ממערכת shelv.ai בעקבות סריקת מצאי וזיהוי חריגה.<br>
      אם אינך בעל המצאי המיועד, נא לפנות למנהל המערכת.
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * 1. Alert relevant inventory holders when an unauthorized item is scanned in a room
 */
export async function alertOnUnauthorizedScan(scanData: {
  serialNumber?: string | null;
  masha: string;
  description?: string;
  scannedRoomId: string;
  scannedRoomName: string;
  scannedHolderId: string;
  scannedHolderName: string;
  officialHolderId?: string | null;
  officialHolderName?: string | null;
  scannedBy: string;
  scannedAt?: string;
}): Promise<SendAlertResult[]> {
  const results: SendAlertResult[] = [];
  const cleanId = String(scanData.serialNumber || scanData.masha).trim().toUpperCase();
  const itemIdentifier = scanData.serialNumber ? `S/N ${scanData.serialNumber.trim().toUpperCase()}` : `מסח"א ${scanData.masha}`;
  const timestamp = scanData.scannedAt ? new Date(scanData.scannedAt).toLocaleString('he-IL') : new Date().toLocaleString('he-IL');
  const itemDesc = scanData.description || `מסח"א ${scanData.masha}`;

  // Target 1: Official Holder (the person who signed on this item, but it was found in someone else's room)
  if (scanData.officialHolderId && scanData.officialHolderId !== scanData.scannedHolderId) {
    const loggedInOfficial = getLoggedInHolder(scanData.officialHolderId);
    if (!loggedInOfficial) {
      results.push({
        holderId: scanData.officialHolderId,
        holderName: scanData.officialHolderName || 'בעל מצאי רשמי',
        email: '',
        status: 'skipped_not_logged_in',
        reason: 'בעל המצאי הרשמי טרם התחבר למערכת',
      });
    } else {
      const refKey = `unauthorized_official:${cleanId}:${scanData.scannedRoomId}`;
      if (isAlertThrottled(refKey, 60)) {
        results.push({
          holderId: scanData.officialHolderId,
          holderName: loggedInOfficial.holderName,
          email: loggedInOfficial.userEmail,
          status: 'throttled',
          reason: 'התראה לפריט זה כבר נשלחה ב-60 הדקות האחרונות',
        });
      } else {
        const subject = `[shelv.ai] התראת מצאי: פריט השייך לך (${itemIdentifier}) נסרק בחדר אחר`;
        const content = `
          <p style="font-size: 14px; line-height: 1.6;">שלום <strong>${loggedInOfficial.holderName}</strong>,</p>
          <p style="font-size: 14px; line-height: 1.6;">
            במהלך סריקת מלאי שבוצעה במערכת, זוהה פריט הרשום על שמך בחדר שאינו משויך אליך:
          </p>
          <div class="card">
            <div class="item-prop"><span class="prop-label">תיאור פריט:</span><span class="prop-val">${itemDesc}</span></div>
            <div class="item-prop"><span class="prop-label">מסח"א:</span><span class="prop-val" style="font-family: monospace;">${scanData.masha}</span></div>
            ${scanData.serialNumber ? `<div class="item-prop"><span class="prop-label">מספר סידורי (S/N):</span><span class="prop-val" style="font-family: monospace;">${scanData.serialNumber.trim().toUpperCase()}</span></div>` : ''}
            <div class="item-prop"><span class="prop-label">נמצא בחדר:</span><span class="prop-val-highlight">${scanData.scannedRoomName}</span></div>
            <div class="item-prop"><span class="prop-label">בעל המצאי של החדר:</span><span class="prop-val-highlight">${scanData.scannedHolderName}</span></div>
            <div class="item-prop"><span class="prop-label">נסרק ע"י:</span><span class="prop-val">${scanData.scannedBy}</span></div>
            <div class="item-prop"><span class="prop-label">מועד סריקה:</span><span class="prop-val">${timestamp}</span></div>
          </div>
          <p style="font-size: 13px; color: #9ca3af; line-height: 1.5;">
            אם הפריט הועבר בהסכמתך, ניתן לאשר את העברת החתימה במערכת shelv.ai. אם לא, נא לפנות לבעל המצאי בחדר או למנהל המלאי.
          </p>
        `;
        const html = generateEmailTemplate(subject, 'ציוד זוהה במיקום זר', content);
        const res = await sendEmailAlert({
          recipientEmail: loggedInOfficial.userEmail,
          recipientName: loggedInOfficial.holderName,
          holderId: scanData.officialHolderId,
          exceptionType: 'unauthorized_transfer',
          referenceKey: refKey,
          subject,
          bodyHtml: html,
        });
        results.push({
          holderId: scanData.officialHolderId,
          holderName: loggedInOfficial.holderName,
          email: loggedInOfficial.userEmail,
          status: res.status,
          subject,
          alertId: res.alertId,
        });
      }
    }
  }

  // Target 2: Scanned Room Holder (the person in whose room an unauthorized asset was found)
  if (scanData.scannedHolderId) {
    const loggedInScanned = getLoggedInHolder(scanData.scannedHolderId);
    if (!loggedInScanned) {
      results.push({
        holderId: scanData.scannedHolderId,
        holderName: scanData.scannedHolderName || 'בעל מצאי החדר',
        email: '',
        status: 'skipped_not_logged_in',
        reason: 'בעל מצאי החדר שבו נסרק הפריט טרם התחבר למערכת',
      });
    } else {
      const refKey = `unauthorized_scanned_room:${cleanId}:${scanData.scannedRoomId}`;
      if (isAlertThrottled(refKey, 60)) {
        results.push({
          holderId: scanData.scannedHolderId,
          holderName: loggedInScanned.holderName,
          email: loggedInScanned.userEmail,
          status: 'throttled',
          reason: 'התראה לפריט זה כבר נשלחה ב-60 הדקות האחרונות',
        });
      } else {
        const supposedName = scanData.officialHolderName || 'גורם אחר בארגון';
        const subject = `[shelv.ai] התראת מצאי: זוהה פריט זר בחדרך (${scanData.scannedRoomName})`;
        const content = `
          <p style="font-size: 14px; line-height: 1.6;">שלום <strong>${loggedInScanned.holderName}</strong>,</p>
          <p style="font-size: 14px; line-height: 1.6;">
            במהלך סריקת מלאי בחדרך (<strong>${scanData.scannedRoomName}</strong>), נסרק פריט שאינו רשום על שמך במצאי:
          </p>
          <div class="card">
            <div class="item-prop"><span class="prop-label">תיאור פריט:</span><span class="prop-val">${itemDesc}</span></div>
            <div class="item-prop"><span class="prop-label">מסח"א:</span><span class="prop-val" style="font-family: monospace;">${scanData.masha}</span></div>
            ${scanData.serialNumber ? `<div class="item-prop"><span class="prop-label">מספר סידורי (S/N):</span><span class="prop-val" style="font-family: monospace;">${scanData.serialNumber}</span></div>` : ''}
            <div class="item-prop"><span class="prop-label">חדר בו נסרק:</span><span class="prop-val-highlight">${scanData.scannedRoomName}</span></div>
            <div class="item-prop"><span class="prop-label">בעל חתימה רשמי:</span><span class="prop-val-highlight">${supposedName}</span></div>
            <div class="item-prop"><span class="prop-label">נסרק ע"י:</span><span class="prop-val">${scanData.scannedBy}</span></div>
            <div class="item-prop"><span class="prop-label">מועד סריקה:</span><span class="prop-val">${timestamp}</span></div>
          </div>
          <p style="font-size: 13px; color: #9ca3af; line-height: 1.5;">
            אם הפריט אמור לעבור לחתימתך, ניתן לאשר את העברת החתימה במערכת shelv.ai.
          </p>
        `;
        const html = generateEmailTemplate(subject, 'ציוד זר זוהה בחדרך', content);
        const res = await sendEmailAlert({
          recipientEmail: loggedInScanned.userEmail,
          recipientName: loggedInScanned.holderName,
          holderId: scanData.scannedHolderId,
          exceptionType: 'unauthorized_transfer',
          referenceKey: refKey,
          subject,
          bodyHtml: html,
        });
        results.push({
          holderId: scanData.scannedHolderId,
          holderName: loggedInScanned.holderName,
          email: loggedInScanned.userEmail,
          status: res.status,
          subject,
          alertId: res.alertId,
        });
      }
    }
  }

  return results;
}

/**
 * 2. Alert relevant inventory holders when a sweep session completes with discrepancies
 */
export async function alertOnSweepCompleted(sessionId: string): Promise<SendAlertResult[]> {
  const results: SendAlertResult[] = [];

  const session = db.prepare(`
    SELECT s.*, r.name as room_name, r.code as room_code, r.holder_id, h.name as holder_name
    FROM sweep_sessions s
    JOIN rooms r ON s.room_id = r.id
    JOIN inventory_holders h ON r.holder_id = h.id
    WHERE s.id = ?
  `).get(sessionId) as any;

  if (!session) return results;

  // Import detectAnomalies dynamically to avoid cycle
  const { detectAnomalies } = await import('./anomalyService.js');
  const anomalies = detectAnomalies();

  // Find quota discrepancies for this room's holder
  const holderDiscrepancies = anomalies.quotaDiscrepancies.filter(q => q.holderId === session.holder_id);
  // Find unauthorized items found in this room
  const roomUnauthorized = anomalies.unauthorizedTransfers.filter(u => u.scannedRoomId === session.room_id);

  if (holderDiscrepancies.length === 0 && roomUnauthorized.length === 0) {
    return results; // No exceptions for this room/holder
  }

  const loggedIn = getLoggedInHolder(session.holder_id);
  if (!loggedIn) {
    results.push({
      holderId: session.holder_id,
      holderName: session.holder_name,
      email: '',
      status: 'skipped_not_logged_in',
      reason: 'בעל המצאי טרם התחבר למערכת',
    });
    return results;
  }

  const refKey = `sweep_completed:${sessionId}:${session.holder_id}`;
  if (isAlertThrottled(refKey, 60)) {
    results.push({
      holderId: session.holder_id,
      holderName: loggedIn.holderName,
      email: loggedIn.userEmail,
      status: 'throttled',
      reason: 'התראת סיום סריקה זו כבר נשלחה',
    });
    return results;
  }

  const subject = `[shelv.ai] סיכום סריקת מלאי: אותרו פערי מצאי בחדר ${session.room_name}`;
  let content = `
    <p style="font-size: 14px; line-height: 1.6;">שלום <strong>${loggedIn.holderName}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6;">
      הסתיימה סריקת מלאי בחדר <strong>${session.room_name} (${session.room_code})</strong> המשויך אליך, ונמצאו הממצאים הבאים:
    </p>
  `;

  if (holderDiscrepancies.length > 0) {
    content += `
      <h3 style="color: #f59e0b; font-size: 14px; margin-top: 16px;">⚠️ פערי חתימות (ציוד חסר במצאי):</h3>
      <div class="card">
    `;
    holderDiscrepancies.forEach(d => {
      content += `
        <div class="item-prop">
          <span class="prop-label">${d.description} (מסח"א ${d.masha}):</span>
          <span class="prop-val-highlight">חסר ${Math.abs(d.difference)} יח' (צפוי ${d.expectedQuantity}, נסרקו ${d.actualDiscovered})</span>
        </div>
      `;
    });
    content += `</div>`;
  }

  if (roomUnauthorized.length > 0) {
    content += `
      <h3 style="color: #ef4444; font-size: 14px; margin-top: 16px;">🚨 ציוד זר שנסרק בחדר (אינו בחתימתך):</h3>
      <div class="card">
    `;
    roomUnauthorized.forEach(u => {
      content += `
        <div class="item-prop">
          <span class="prop-label">${u.description} (S/N: ${u.serialNumber || 'ללא'}):</span>
          <span class="prop-val">${u.supposedHolderName}</span>
        </div>
      `;
    });
    content += `</div>`;
  }

  const html = generateEmailTemplate(subject, 'פערי מצאי בסריקה', content);
  const res = await sendEmailAlert({
    recipientEmail: loggedIn.userEmail,
    recipientName: loggedIn.holderName,
    holderId: session.holder_id,
    exceptionType: 'sweep_discrepancy',
    referenceKey: refKey,
    subject,
    bodyHtml: html,
  });

  results.push({
    holderId: session.holder_id,
    holderName: loggedIn.holderName,
    email: loggedIn.userEmail,
    status: res.status,
    subject,
    alertId: res.alertId,
  });

  return results;
}

/**
 * 3. Alert all relevant inventory holders for all pending anomalies currently in the system
 * Useful for bulk alert dispatch or on-demand manager trigger
 */
export async function alertAllPendingAnomalies(): Promise<{
  totalEvaluated: number;
  sentCount: number;
  simulatedCount: number;
  skippedNotLoggedInCount: number;
  throttledCount: number;
  results: SendAlertResult[];
}> {
  const { detectAnomalies } = await import('./anomalyService.js');
  const anomalies = detectAnomalies();
  const allResults: SendAlertResult[] = [];

  // A. Process unauthorized transfers
  for (const transfer of anomalies.unauthorizedTransfers) {
    const scanAlerts = await alertOnUnauthorizedScan({
      serialNumber: transfer.serialNumber,
      masha: transfer.masha,
      description: transfer.description,
      scannedRoomId: transfer.scannedRoomId,
      scannedRoomName: transfer.scannedRoomName,
      scannedHolderId: transfer.scannedHolderId,
      scannedHolderName: transfer.scannedHolderName,
      officialHolderId: transfer.officialHolderId || transfer.supposedHolderId,
      officialHolderName: transfer.officialHolderName || transfer.supposedHolderName,
      scannedBy: transfer.scannedBy,
      scannedAt: transfer.scannedAt,
    });
    allResults.push(...scanAlerts);
  }

  // B. Process quota discrepancies
  for (const discrepancy of anomalies.quotaDiscrepancies) {
    const loggedIn = getLoggedInHolder(discrepancy.holderId);
    if (!loggedIn) {
      allResults.push({
        holderId: discrepancy.holderId,
        holderName: discrepancy.holderName,
        email: '',
        status: 'skipped_not_logged_in',
        reason: 'בעל המצאי טרם התחבר למערכת',
      });
      continue;
    }

    const refKey = `quota_discrepancy:${discrepancy.holderId}:${discrepancy.masha}`;
    if (isAlertThrottled(refKey, 120)) {
      allResults.push({
        holderId: discrepancy.holderId,
        holderName: loggedIn.holderName,
        email: loggedIn.userEmail,
        status: 'throttled',
        reason: 'התראה לפער זה כבר נשלחה בשעתיים האחרונות',
      });
      continue;
    }

    const subject = `[shelv.ai] התראת מצאי: פער חתימות עבור מסח"א ${discrepancy.masha}`;
    const content = `
      <p style="font-size: 14px; line-height: 1.6;">שלום <strong>${loggedIn.holderName}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.6;">
        בבדיקת מצאי שוטפת, נמצא פער חסר בין כמות הציוד החתומה על שמך לבין הכמות שנמצאה בפועל בסריקות:
      </p>
      <div class="card">
        <div class="item-prop"><span class="prop-label">תיאור פריט:</span><span class="prop-val">${discrepancy.description}</span></div>
        <div class="item-prop"><span class="prop-label">מסח"א:</span><span class="prop-val" style="font-family: monospace;">${discrepancy.masha}</span></div>
        <div class="item-prop"><span class="prop-label">כמות חתומה באקסל:</span><span class="prop-val">${discrepancy.expectedQuantity} יח'</span></div>
        <div class="item-prop"><span class="prop-label">כמות שנסרקה בפועל:</span><span class="prop-val">${discrepancy.actualDiscovered} יח'</span></div>
        <div class="item-prop"><span class="prop-label">פער חסר:</span><span class="prop-val-highlight">חסר ${Math.abs(discrepancy.difference)} יח'</span></div>
      </div>
      <p style="font-size: 13px; color: #9ca3af; line-height: 1.5;">
        נא לוודא שכל הפריטים נסרקו בחדריך או לבדוק האם פריטים הועברו לחדרים אחרים.
      </p>
    `;
    const html = generateEmailTemplate(subject, 'פער חתימות במצאי', content);
    const res = await sendEmailAlert({
      recipientEmail: loggedIn.userEmail,
      recipientName: loggedIn.holderName,
      holderId: discrepancy.holderId,
      exceptionType: 'quota_discrepancy',
      referenceKey: refKey,
      subject,
      bodyHtml: html,
    });
    allResults.push({
      holderId: discrepancy.holderId,
      holderName: loggedIn.holderName,
      email: loggedIn.userEmail,
      status: res.status,
      subject,
      alertId: res.alertId,
    });
  }

  const sentCount = allResults.filter(r => r.status === 'sent').length;
  const simulatedCount = allResults.filter(r => r.status === 'simulated').length;
  const skippedNotLoggedInCount = allResults.filter(r => r.status === 'skipped_not_logged_in').length;
  const throttledCount = allResults.filter(r => r.status === 'throttled').length;

  return {
    totalEvaluated: allResults.length,
    sentCount,
    simulatedCount,
    skippedNotLoggedInCount,
    throttledCount,
    results: allResults,
  };
}

/**
 * 4. Fetch email alert history for auditing
 */
export function getEmailAlertHistory(limit: number = 50, offset: number = 0) {
  const alerts = db.prepare(`
    SELECT a.*, h.name as holder_name
    FROM email_alerts a
    LEFT JOIN inventory_holders h ON a.holder_id = h.id
    ORDER BY a.created_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const total = (db.prepare('SELECT COUNT(*) as count FROM email_alerts').get() as any).count;

  return { total, limit, offset, alerts };
}
