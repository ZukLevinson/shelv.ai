import nodemailer from 'nodemailer';
import { db } from '../db/database.js';
import { logAction } from './actionService.js';

export interface ResolvedContact {
  holderId: string;
  name: string;
  email: string | null;
  personalNumber?: string | null;
  source: 'user' | 'holder' | 'none';
}

export interface SendAlertResult {
  holderId?: string;
  holderName: string;
  email: string;
  status: 'sent' | 'simulated' | 'failed' | 'throttled' | 'skipped_no_email';
  subject?: string;
  alertId?: string;
  reason?: string;
}

/**
 * Resolves contact information (specifically email and name) for an inventory holder.
 * Checks linked users (by holder_id or personal_number), then the inventory_holders record.
 * Crucially, does NOT require the user to have previously logged into the app.
 */
export function resolveHolderContact(holderId: string): ResolvedContact | null {
  if (!holderId) return null;

  // 1. Direct coupling via users.holder_id
  const userByHolder = db.prepare(`
    SELECT id as user_id, email as user_email, name as user_name, personal_number
    FROM users
    WHERE holder_id = ?
    ORDER BY last_login_at DESC, updated_at DESC
    LIMIT 1
  `).get(holderId) as any;

  if (userByHolder && userByHolder.user_email && userByHolder.user_email.trim()) {
    return {
      holderId,
      name: userByHolder.user_name,
      email: userByHolder.user_email.trim().toLowerCase(),
      personalNumber: userByHolder.personal_number,
      source: 'user',
    };
  }

  // 2. Fetch holder record
  const holder = db.prepare(`
    SELECT id, name, email, personal_number
    FROM inventory_holders
    WHERE id = ?
  `).get(holderId) as any;

  if (!holder) return null;

  // 3. Match user by personal_number if available
  if (holder.personal_number && holder.personal_number.trim()) {
    const userByPN = db.prepare(`
      SELECT id as user_id, email as user_email, name as user_name, personal_number
      FROM users
      WHERE personal_number = ?
      ORDER BY last_login_at DESC, updated_at DESC
      LIMIT 1
    `).get(holder.personal_number.trim()) as any;

    if (userByPN && userByPN.user_email && userByPN.user_email.trim()) {
      return {
        holderId,
        name: userByPN.user_name || holder.name,
        email: userByPN.user_email.trim().toLowerCase(),
        personalNumber: holder.personal_number,
        source: 'user',
      };
    }
  }

  // 4. Holder record has direct email configured
  if (holder.email && holder.email.trim()) {
    return {
      holderId,
      name: holder.name,
      email: holder.email.trim().toLowerCase(),
      personalNumber: holder.personal_number,
      source: 'holder',
    };
  }

  // 5. Fallback: match user by name
  const userByName = db.prepare(`
    SELECT id as user_id, email as user_email, name as user_name, personal_number
    FROM users
    WHERE LOWER(name) = LOWER(?)
    ORDER BY last_login_at DESC, updated_at DESC
    LIMIT 1
  `).get(holder.name) as any;

  if (userByName && userByName.user_email && userByName.user_email.trim()) {
    return {
      holderId,
      name: userByName.user_name,
      email: userByName.user_email.trim().toLowerCase(),
      personalNumber: holder.personal_number,
      source: 'user',
    };
  }

  return {
    holderId,
    name: holder.name,
    email: null,
    personalNumber: holder.personal_number,
    source: 'none',
  };
}

/**
 * Resolves contact information for a room's owner (the inventory holder assigned to the room).
 */
export function resolveRoomOwnerContact(roomId: string): {
  roomId: string;
  roomName: string;
  roomCode: string;
  holderId: string;
  holderName: string;
  email: string | null;
  personalNumber?: string | null;
} | null {
  if (!roomId) return null;

  const room = db.prepare(`
    SELECT r.id, r.name, r.code, r.holder_id, h.name as holder_name
    FROM rooms r
    LEFT JOIN inventory_holders h ON r.holder_id = h.id
    WHERE r.id = ?
  `).get(roomId) as any;

  if (!room) return null;

  const contact = resolveHolderContact(room.holder_id);

  return {
    roomId: room.id,
    roomName: room.name,
    roomCode: room.code,
    holderId: room.holder_id,
    holderName: contact?.name || room.holder_name || 'בעל חדר',
    email: contact?.email || null,
    personalNumber: contact?.personalNumber || null,
  };
}

// Backwards-compatible helper
export function getLoggedInHolder(holderId: string) {
  const contact = resolveHolderContact(holderId);
  if (!contact || !contact.email) return null;
  return {
    holderId: contact.holderId,
    holderName: contact.name,
    userEmail: contact.email,
    userName: contact.name,
    userId: contact.holderId,
    lastLoginAt: new Date().toISOString(),
  };
}

/**
 * Checks if an email alert was already sent for this reference key recently (cooldown in minutes).
 */
export function isAlertThrottled(referenceKey: string, cooldownMinutes: number = 30): boolean {
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

/**
 * Checks if email transport is actively configured with Google Cloud / Gmail / SMTP credentials.
 */
export function isEmailConfigured(): boolean {
  const gmailUser = process.env.GMAIL_USER || process.env.GOOGLE_EMAIL || process.env.GOOGLE_MAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.GOOGLE_EMAIL_PASSWORD || process.env.GOOGLE_MAIL_PASSWORD;
  const oauthClientId = process.env.GOOGLE_CLIENT_ID;
  const oauthClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const oauthRefreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  return Boolean(
    (gmailUser && gmailPass) ||
    (gmailUser && oauthClientId && oauthClientSecret && oauthRefreshToken) ||
    (smtpHost && smtpUser && smtpPass) ||
    (smtpUser && smtpPass)
  );
}

/**
 * Creates Nodemailer Transporter supporting Google Cloud Emailing:
 * 1. Google / Gmail service using App Password (GMAIL_USER + GMAIL_APP_PASSWORD)
 * 2. Google OAuth2 (GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN + GMAIL_USER)
 * 3. Google Workspace / standard SMTP relay (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
 * 4. Fallback JSON transport for development simulation when credentials are not configured.
 */
export function getMailTransporter() {
  const gmailUser = process.env.GMAIL_USER || process.env.GOOGLE_EMAIL || process.env.GOOGLE_MAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD || process.env.GOOGLE_EMAIL_PASSWORD || process.env.GOOGLE_MAIL_PASSWORD;

  // 1. Google / Gmail App Password or Service Transport
  if (gmailUser && gmailPass) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });
  }

  // 2. Google OAuth2 Transport
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (gmailUser && clientId && clientSecret && refreshToken) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: gmailUser,
        clientId,
        clientSecret,
        refreshToken,
      } as any,
    });
  }

  // 3. Generic / Custom SMTP (defaults host to smtp.gmail.com if not specified)
  const host = process.env.SMTP_HOST || (process.env.SMTP_USER ? 'smtp.gmail.com' : undefined);
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
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

  // 4. Fallback: JSON transport for simulation / testing when credentials are not yet set
  return nodemailer.createTransport({
    jsonTransport: true,
  });
}

/**
 * Sends an email alert and logs the transaction into the database.
 */
export async function sendEmailAlert(params: {
  recipientEmail: string;
  recipientName: string;
  holderId?: string | null;
  exceptionType: string;
  referenceKey: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
}): Promise<{ success: boolean; alertId: string; status: 'sent' | 'simulated' | 'failed'; error?: string }> {
  const alertId = 'alert-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const configured = isEmailConfigured();
  const defaultSender = process.env.GMAIL_USER || process.env.GOOGLE_EMAIL || process.env.SMTP_USER || 'alerts@shelv.ai';
  const fromAddress = process.env.SMTP_FROM || process.env.EMAIL_FROM || `shelv.ai Inventory Alerts <${defaultSender}>`;

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
    const status = configured ? 'sent' : 'simulated';

    if (!configured) {
      console.log(`[Google Cloud Emailing - Simulated] To: ${params.recipientEmail} (${params.recipientName}) | Subject: "${params.subject}"`);
      console.log(`[Google Cloud Emailing - Info] To enable live emails on Cloud Run, set GMAIL_USER and GMAIL_APP_PASSWORD env vars.`);
    } else {
      console.log(`[Google Cloud Emailing - Sent] To: ${params.recipientEmail} | MessageId: ${info.messageId}`);
    }

    db.prepare(`
      INSERT INTO email_alerts (
        id, recipient_email, recipient_name, holder_id, exception_type, reference_key, subject, body_html, status, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    `).run(
      alertId,
      params.recipientEmail,
      params.recipientName,
      params.holderId || null,
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
      performedBy: 'Google Cloud Emailing',
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
    console.error('[Google Cloud Emailing - Error] Failed to send email to', params.recipientEmail, err);

    db.prepare(`
      INSERT INTO email_alerts (
        id, recipient_email, recipient_name, holder_id, exception_type, reference_key, subject, body_html, status, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'failed', ?)
    `).run(
      alertId,
      params.recipientEmail,
      params.recipientName,
      params.holderId || null,
      params.exceptionType,
      params.referenceKey,
      params.subject,
      params.bodyHtml,
      err.message || String(err)
    );

    return { success: false, alertId, status: 'failed', error: err.message };
  }
}

/**
 * Generates styled HTML email wrapper with shelv.ai branding.
 */
function generateEmailTemplate(title: string, badgeText: string, contentHtml: string): string {
  const appUrl = process.env.APP_URL || 'https://shelv-ai-deploy-699599313459.me-west1.run.app';

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
    .badge-amber { background-color: #d97706; color: #fef3c7; }
    .content { padding: 24px; }
    .card { background-color: #1f2937; border: 1px solid #374151; border-radius: 12px; padding: 16px; margin: 16px 0; }
    .item-prop { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #374151; font-size: 13px; }
    .item-prop:last-child { border-bottom: none; }
    .prop-label { color: #9ca3af; font-weight: 500; }
    .prop-val { color: #f9fafb; font-weight: 600; text-align: left; }
    .prop-val-highlight { color: #f87171; font-weight: 700; text-align: left; }
    .prop-val-amber { color: #fbbf24; font-weight: 700; text-align: left; }
    .btn { display: inline-block; width: 100%; box-sizing: border-box; text-align: center; background-color: #10b981; color: #ffffff; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 14px; margin-top: 20px; }
    .footer { text-align: center; padding: 16px; font-size: 11px; color: #6b7280; border-top: 1px solid #1f2937; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-logo">S</div>
      <h1>shelv.ai - התראת פריט לא במקומו</h1>
      <div><span class="badge">${badgeText}</span></div>
    </div>
    <div class="content">
      ${contentHtml}
      <a href="${appUrl}" class="btn">כניסה למערכת shelv.ai לבירור וטיפול בחריגה</a>
    </div>
    <div class="footer">
      הודעה זו נשלחה באופן אוטומטי ממערכת shelv.ai באמצעות Google Cloud בעקבות סריקת פריט במיקום שאינו משויך אליו.<br>
      אם אינך בעל החדר או המצאי המיועד, נא לפנות למנהל המערכת.
    </div>
  </div>
</body>
</html>
  `.trim();
}

export interface MisplacedItemScanAlertParams {
  serialNumber?: string | null;
  masha: string;
  description?: string;
  scannedRoomId: string;
  scannedRoomName: string;
  scannedHolderId: string;
  scannedHolderName: string;
  officialRoomId?: string | null;
  officialRoomName?: string | null;
  officialHolderId?: string | null;
  officialHolderName?: string | null;
  scannedBy: string;
  scannedAt?: string;
}

/**
 * Main alerting engine: Triggered when an item is scanned and is misplaced
 * (scanned in a room where it shouldn't be).
 * Sends an email notification to the room owner(s) using Google Cloud emailing.
 */
export async function alertOnMisplacedItemScan(
  params: MisplacedItemScanAlertParams
): Promise<SendAlertResult[]> {
  const results: SendAlertResult[] = [];
  const cleanId = String(params.serialNumber || params.masha).trim().toUpperCase();
  const itemIdentifier = params.serialNumber ? `S/N ${params.serialNumber.trim().toUpperCase()}` : `מסח"א ${params.masha}`;
  const timestamp = params.scannedAt ? new Date(params.scannedAt).toLocaleString('he-IL') : new Date().toLocaleString('he-IL');
  const itemDesc = params.description || `מסח"א ${params.masha}`;

  // Resolve Scanned Room Owner
  const scannedRoomOwner = resolveRoomOwnerContact(params.scannedRoomId);
  const scannedOwnerEmail = scannedRoomOwner?.email;
  const scannedOwnerName = scannedRoomOwner?.holderName || params.scannedHolderName || 'בעל החדר';

  // Resolve Official Room Owner (if item officially belongs to a specific room or holder)
  const officialRoomOwner = params.officialRoomId ? resolveRoomOwnerContact(params.officialRoomId) : null;
  const officialHolderContact = params.officialHolderId ? resolveHolderContact(params.officialHolderId) : null;
  const officialOwnerEmail = officialRoomOwner?.email || officialHolderContact?.email || null;
  const officialOwnerName = officialRoomOwner?.holderName || officialHolderContact?.name || params.officialHolderName || null;

  const isSameOwnerMove = Boolean(
    officialHolderContact?.holderId &&
    scannedRoomOwner?.holderId &&
    officialHolderContact.holderId === scannedRoomOwner.holderId
  );

  // Case 1: Internal move between rooms owned by the SAME inventory holder
  if (isSameOwnerMove && scannedOwnerEmail) {
    const refKey = `misplaced_internal:${cleanId}:${params.scannedRoomId}:${scannedOwnerEmail}`;
    if (isAlertThrottled(refKey, 30)) {
      results.push({
        holderId: scannedRoomOwner?.holderId,
        holderName: scannedOwnerName,
        email: scannedOwnerEmail,
        status: 'throttled',
        reason: 'התראה לפריט זה כבר נשלחה ב-30 הדקות האחרונות',
      });
    } else {
      const subject = `[shelv.ai] התראת מצאי: פריט השייך לחדר ${params.officialRoomName || 'אחר'} נסרק ב${params.scannedRoomName}`;
      const content = `
        <p style="font-size: 14px; line-height: 1.6;">שלום <strong>${scannedOwnerName}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6;">
          במהלך סריקת מלאי שבוצעה במערכת, זוהה פריט המשויך אליך בחדר שונה מחדרו הרשמי במצאי:
        </p>
        <div class="card">
          <div class="item-prop"><span class="prop-label">תיאור פריט:</span><span class="prop-val">${itemDesc}</span></div>
          <div class="item-prop"><span class="prop-label">מסח"א:</span><span class="prop-val" style="font-family: monospace;">${params.masha}</span></div>
          ${params.serialNumber ? `<div class="item-prop"><span class="prop-label">מספר סידורי (S/N):</span><span class="prop-val" style="font-family: monospace;">${params.serialNumber.trim().toUpperCase()}</span></div>` : ''}
          <div class="item-prop"><span class="prop-label">חדר רשמי במערכת:</span><span class="prop-val-amber">${params.officialRoomName || 'חדר אחר שבבעלותך'}</span></div>
          <div class="item-prop"><span class="prop-label">נסרק בפועל בחדר:</span><span class="prop-val-highlight">${params.scannedRoomName}</span></div>
          <div class="item-prop"><span class="prop-label">נסרק ע"י:</span><span class="prop-val">${params.scannedBy}</span></div>
          <div class="item-prop"><span class="prop-label">מועד סריקה:</span><span class="prop-val">${timestamp}</span></div>
        </div>
        <p style="font-size: 13px; color: #9ca3af; line-height: 1.5;">
          ניתן לאשר את העברת מיקום הפריט לחדר ${params.scannedRoomName} ישירות במערכת shelv.ai בלחיצת כפתור.
        </p>
      `;
      const html = generateEmailTemplate(subject, 'שינוי מיקום פריט בין חדרים', content);
      const res = await sendEmailAlert({
        recipientEmail: scannedOwnerEmail,
        recipientName: scannedOwnerName,
        holderId: scannedRoomOwner?.holderId,
        exceptionType: 'internal_room_move',
        referenceKey: refKey,
        subject,
        bodyHtml: html,
      });
      results.push({
        holderId: scannedRoomOwner?.holderId,
        holderName: scannedOwnerName,
        email: scannedOwnerEmail,
        status: res.status,
        subject,
        alertId: res.alertId,
      });
    }
    return results;
  }

  // Case 2: Target Scanned Room Owner (the owner of the room where the item shouldn't be)
  if (scannedRoomOwner?.holderId) {
    if (!scannedOwnerEmail) {
      results.push({
        holderId: scannedRoomOwner.holderId,
        holderName: scannedOwnerName,
        email: '',
        status: 'skipped_no_email',
        reason: `לא מוגדרת כתובת אימייל עבור בעל החדר ${params.scannedRoomName}`,
      });
    } else {
      const refKey = `misplaced_scanned:${cleanId}:${params.scannedRoomId}:${scannedOwnerEmail}`;
      if (isAlertThrottled(refKey, 30)) {
        results.push({
          holderId: scannedRoomOwner.holderId,
          holderName: scannedOwnerName,
          email: scannedOwnerEmail,
          status: 'throttled',
          reason: 'התראה לפריט זה כבר נשלחה ב-30 הדקות האחרונות',
        });
      } else {
        const supposedName = params.officialHolderName || officialOwnerName || 'גורם אחר בארגון';
        const subject = `[shelv.ai] התראת מצאי: זוהה פריט לא במקומו בחדר ${params.scannedRoomName}`;
        const content = `
          <p style="font-size: 14px; line-height: 1.6;">שלום <strong>${scannedOwnerName}</strong>,</p>
          <p style="font-size: 14px; line-height: 1.6;">
            במהלך סריקת מלאי בחדרך (<strong>${params.scannedRoomName}</strong>), נסרק פריט שאינו אמור להימצא בחדר זה:
          </p>
          <div class="card">
            <div class="item-prop"><span class="prop-label">תיאור פריט:</span><span class="prop-val">${itemDesc}</span></div>
            <div class="item-prop"><span class="prop-label">מסח"א:</span><span class="prop-val" style="font-family: monospace;">${params.masha}</span></div>
            ${params.serialNumber ? `<div class="item-prop"><span class="prop-label">מספר סידורי (S/N):</span><span class="prop-val" style="font-family: monospace;">${params.serialNumber.trim().toUpperCase()}</span></div>` : ''}
            <div class="item-prop"><span class="prop-label">חדר בו נסרק:</span><span class="prop-val-highlight">${params.scannedRoomName}</span></div>
            <div class="item-prop"><span class="prop-label">שיוך רשמי במקור:</span><span class="prop-val-highlight">${supposedName}${params.officialRoomName ? ` (${params.officialRoomName})` : ''}</span></div>
            <div class="item-prop"><span class="prop-label">נסרק ע"י:</span><span class="prop-val">${params.scannedBy}</span></div>
            <div class="item-prop"><span class="prop-label">מועד סריקה:</span><span class="prop-val">${timestamp}</span></div>
          </div>
          <p style="font-size: 13px; color: #9ca3af; line-height: 1.5;">
            אם הפריט אמור לעבור לחדרך או לחתימתך, ניתן לאשר את העברת המצאי ישירות במערכת shelv.ai.
          </p>
        `;
        const html = generateEmailTemplate(subject, 'ציוד זר זוהה בחדרך', content);
        const res = await sendEmailAlert({
          recipientEmail: scannedOwnerEmail,
          recipientName: scannedOwnerName,
          holderId: scannedRoomOwner.holderId,
          exceptionType: 'unauthorized_room_placement',
          referenceKey: refKey,
          subject,
          bodyHtml: html,
        });
        results.push({
          holderId: scannedRoomOwner.holderId,
          holderName: scannedOwnerName,
          email: scannedOwnerEmail,
          status: res.status,
          subject,
          alertId: res.alertId,
        });
      }
    }
  }

  // Case 3: Target Official Room Owner / Holder (the person who owns the room/inventory the item was taken from)
  const targetOfficialHolderId = officialRoomOwner?.holderId || params.officialHolderId || null;
  if (
    targetOfficialHolderId &&
    targetOfficialHolderId !== scannedRoomOwner?.holderId &&
    officialOwnerEmail &&
    officialOwnerEmail !== scannedOwnerEmail
  ) {
    const refKey = `misplaced_official:${cleanId}:${params.scannedRoomId}:${officialOwnerEmail}`;
    if (isAlertThrottled(refKey, 30)) {
      results.push({
        holderId: targetOfficialHolderId,
        holderName: officialOwnerName || 'בעל המצאי',
        email: officialOwnerEmail,
        status: 'throttled',
        reason: 'התראה לפריט זה כבר נשלחה ב-30 הדקות האחרונות',
      });
    } else {
      const subject = `[shelv.ai] התראת מצאי: פריט המשויך אליך (${itemIdentifier}) נסרק בחדר אחר (${params.scannedRoomName})`;
      const content = `
        <p style="font-size: 14px; line-height: 1.6;">שלום <strong>${officialOwnerName}</strong>,</p>
        <p style="font-size: 14px; line-height: 1.6;">
          במהלך סריקת מלאי, זוהה פריט הרשום על שמך/חדרך בחדר שאינו משויך אליך:
        </p>
        <div class="card">
          <div class="item-prop"><span class="prop-label">תיאור פריט:</span><span class="prop-val">${itemDesc}</span></div>
          <div class="item-prop"><span class="prop-label">מסח"א:</span><span class="prop-val" style="font-family: monospace;">${params.masha}</span></div>
          ${params.serialNumber ? `<div class="item-prop"><span class="prop-label">מספר סידורי (S/N):</span><span class="prop-val" style="font-family: monospace;">${params.serialNumber.trim().toUpperCase()}</span></div>` : ''}
          ${params.officialRoomName ? `<div class="item-prop"><span class="prop-label">חדר מקורי:</span><span class="prop-val">${params.officialRoomName}</span></div>` : ''}
          <div class="item-prop"><span class="prop-label">נמצא בפועל בחדר:</span><span class="prop-val-highlight">${params.scannedRoomName}</span></div>
          <div class="item-prop"><span class="prop-label">בעל החדר בו נמצא:</span><span class="prop-val-highlight">${scannedOwnerName}</span></div>
          <div class="item-prop"><span class="prop-label">נסרק ע"י:</span><span class="prop-val">${params.scannedBy}</span></div>
          <div class="item-prop"><span class="prop-label">מועד סריקה:</span><span class="prop-val">${timestamp}</span></div>
        </div>
        <p style="font-size: 13px; color: #9ca3af; line-height: 1.5;">
          אם הפריט הועבר בהסכמתך, ניתן לאשר את העברת החתימה במערכת shelv.ai. אם לא, נא לפנות לבעל החדר שבו הפריט נמצא.
        </p>
      `;
      const html = generateEmailTemplate(subject, 'ציוד זוהה במיקום זר', content);
      const res = await sendEmailAlert({
        recipientEmail: officialOwnerEmail,
        recipientName: officialOwnerName || 'בעל מצאי רשמי',
        holderId: targetOfficialHolderId,
        exceptionType: 'unauthorized_transfer',
        referenceKey: refKey,
        subject,
        bodyHtml: html,
      });
      results.push({
        holderId: targetOfficialHolderId,
        holderName: officialOwnerName || 'בעל מצאי רשמי',
        email: officialOwnerEmail,
        status: res.status,
        subject,
        alertId: res.alertId,
      });
    }
  }

  return results;
}

// Backwards-compatible alias for existing imports
export const alertOnUnauthorizedScan = alertOnMisplacedItemScan;

/**
 * Alert relevant inventory holders when a sweep session completes with discrepancies.
 * (Uses robust contact resolution; does not block on prior login).
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

  const { detectAnomalies } = await import('./anomalyService.js');
  const anomalies = detectAnomalies();

  const holderDiscrepancies = anomalies.quotaDiscrepancies.filter(q => q.holderId === session.holder_id);
  const roomUnauthorized = anomalies.unauthorizedTransfers.filter(u => u.scannedRoomId === session.room_id);

  if (holderDiscrepancies.length === 0 && roomUnauthorized.length === 0) {
    return results;
  }

  const contact = resolveHolderContact(session.holder_id);
  if (!contact || !contact.email) {
    results.push({
      holderId: session.holder_id,
      holderName: session.holder_name,
      email: '',
      status: 'skipped_no_email',
      reason: 'לא מוגדרת כתובת אימייל עבור בעל המצאי',
    });
    return results;
  }

  const refKey = `sweep_completed:${sessionId}:${session.holder_id}`;
  if (isAlertThrottled(refKey, 60)) {
    results.push({
      holderId: session.holder_id,
      holderName: contact.name,
      email: contact.email,
      status: 'throttled',
      reason: 'התראת סיום סריקה זו כבר נשלחה',
    });
    return results;
  }

  const subject = `[shelv.ai] סיכום סריקת מלאי: אותרו פערי מצאי בחדר ${session.room_name}`;
  let content = `
    <p style="font-size: 14px; line-height: 1.6;">שלום <strong>${contact.name}</strong>,</p>
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
    recipientEmail: contact.email,
    recipientName: contact.name,
    holderId: session.holder_id,
    exceptionType: 'sweep_discrepancy',
    referenceKey: refKey,
    subject,
    bodyHtml: html,
  });

  results.push({
    holderId: session.holder_id,
    holderName: contact.name,
    email: contact.email,
    status: res.status,
    subject,
    alertId: res.alertId,
  });

  return results;
}

/**
 * Alert all relevant room owners / inventory holders for pending anomalies.
 */
export async function alertAllPendingAnomalies(): Promise<{
  totalEvaluated: number;
  sentCount: number;
  simulatedCount: number;
  skippedNoEmailCount: number;
  skippedNotLoggedInCount: number;
  throttledCount: number;
  results: SendAlertResult[];
}> {
  const { detectAnomalies } = await import('./anomalyService.js');
  const anomalies = detectAnomalies();
  const allResults: SendAlertResult[] = [];

  for (const transfer of anomalies.unauthorizedTransfers) {
    const scanAlerts = await alertOnMisplacedItemScan({
      serialNumber: transfer.serialNumber,
      masha: transfer.masha,
      description: transfer.description,
      scannedRoomId: transfer.scannedRoomId,
      scannedRoomName: transfer.scannedRoomName,
      scannedHolderId: transfer.scannedHolderId,
      scannedHolderName: transfer.scannedHolderName,
      officialRoomId: transfer.officialRoomId || null,
      officialRoomName: transfer.officialRoomName || null,
      officialHolderId: transfer.officialHolderId || transfer.supposedHolderId,
      officialHolderName: transfer.officialHolderName || transfer.supposedHolderName,
      scannedBy: transfer.scannedBy,
      scannedAt: transfer.scannedAt,
    });
    allResults.push(...scanAlerts);
  }

  const sentCount = allResults.filter(r => r.status === 'sent').length;
  const simulatedCount = allResults.filter(r => r.status === 'simulated').length;
  const skippedNoEmailCount = allResults.filter(r => r.status === 'skipped_no_email').length;
  const throttledCount = allResults.filter(r => r.status === 'throttled').length;

  return {
    totalEvaluated: allResults.length,
    sentCount,
    simulatedCount,
    skippedNoEmailCount,
    skippedNotLoggedInCount: skippedNoEmailCount,
    throttledCount,
    results: allResults,
  };
}

/**
 * Fetch email alert history for auditing.
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
