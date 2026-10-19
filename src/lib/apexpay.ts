import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import {
  APEXPAY_GATEWAY_URL,
  APEXPAY_WEBHOOK_SECRET,
  TSUKURI_UPI_DETAILS,
  buildApexCheckoutUrl,
  buildUpiDeepLink,
} from './apexpayClient.ts';

export {
  APEXPAY_GATEWAY_URL,
  APEXPAY_WEBHOOK_SECRET,
  TSUKURI_UPI_DETAILS,
  buildApexCheckoutUrl,
  buildUpiDeepLink,
};

const LOGS_FILE = path.join(process.cwd(), 'data', 'apexpay_webhook_logs.json');

export interface ApexPayWebhookLog {
  id: string;
  receivedAt: string;
  orderId?: string;
  paymentId?: string;
  utr?: string;
  amount?: number;
  status?: string;
  signatureVerified: boolean;
  rawPayload: any;
  error?: string;
}

export function loadApexWebhookLogs(): ApexPayWebhookLog[] {
  try {
    if (!fs.existsSync(LOGS_FILE)) return [];
    const data = fs.readFileSync(LOGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveApexWebhookLog(log: Omit<ApexPayWebhookLog, 'id' | 'receivedAt'>): ApexPayWebhookLog {
  const current = loadApexWebhookLogs();
  const newLog: ApexPayWebhookLog = {
    ...log,
    id: `apex-wh-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    receivedAt: new Date().toISOString(),
  };
  current.unshift(newLog);
  if (current.length > 200) current.length = 200;

  try {
    fs.mkdirSync(path.dirname(LOGS_FILE), { recursive: true });
    fs.writeFileSync(LOGS_FILE, JSON.stringify(current, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save ApexPay webhook log:', err);
  }
  return newLog;
}



/**
 * Verifies incoming webhook signatures using HMAC-SHA256
 * Secret: whsec_98f12a88e91d84b238ef
 */
export function verifyApexPaySignature(
  rawBody: string | Buffer,
  receivedSignature?: string | string[]
): { valid: boolean; computedSignature: string } {
  const secret = process.env.APEXPAY_WEBHOOK_SECRET || APEXPAY_WEBHOOK_SECRET;
  const bodyString = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(bodyString);
  const computedSignature = hmac.digest('hex');

  if (!receivedSignature) {
    return { valid: false, computedSignature };
  }

  const cleanSig = String(receivedSignature).replace(/^sha256=/, '').trim();

  try {
    const sigBuf = Buffer.from(cleanSig, 'hex');
    const compBuf = Buffer.from(computedSignature, 'hex');
    if (sigBuf.length === compBuf.length && crypto.timingSafeEqual(sigBuf, compBuf)) {
      return { valid: true, computedSignature };
    }
  } catch {
    // String fallback if buffer conversion fails
  }

  const stringMatch = cleanSig.toLowerCase() === computedSignature.toLowerCase();
  return { valid: stringMatch, computedSignature };
}

