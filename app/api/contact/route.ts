import { NextRequest, NextResponse } from 'next/server';
import * as postmark from 'postmark';

interface ContactFormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  /** Honeypot – must be empty; bots fill it automatically */
  website?: string;
}

// ---------------------------------------------------------------------------
// HTML entity escaping – prevents XSS in email HTML body
// ---------------------------------------------------------------------------
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------------------------------------------------------------------------
// In-memory rate limiting (best-effort; resets on cold start)
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 3; // max submissions per IP per window
const MESSAGE_MAX_LENGTH = 5000;
const NAME_MAX_LENGTH = 200;

const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  // Prune expired entries to prevent unbounded memory growth
  for (const [key, val] of rateLimitMap) {
    if (now - val.windowStart > RATE_LIMIT_WINDOW_MS) rateLimitMap.delete(key);
  }
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count += 1;
  return false;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      'unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.' },
        { status: 429 }
      );
    }

    const body: ContactFormData = await request.json();

    // Honeypot check – silently succeed so bots think the form worked
    if (body.website) {
      return NextResponse.json(
        { success: true, message: 'Message received successfully' },
        { status: 200 }
      );
    }

    if (!body.name || !body.email || !body.subject || !body.message) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Length validation – prevent oversized payloads
    if (body.name.length > NAME_MAX_LENGTH || body.message.length > MESSAGE_MAX_LENGTH) {
      return NextResponse.json(
        { error: 'Input too long. Please shorten your message.' },
        { status: 400 }
      );
    }

    const toEmail = process.env.CONTACT_TO_EMAIL;
    const fromEmail = process.env.CONTACT_FROM_EMAIL;
    const serverToken = process.env.POSTMARK_SERVER_TOKEN;

    if (serverToken && toEmail && fromEmail) {
      const client = new postmark.ServerClient(serverToken);
      await client.sendEmail({
        From: fromEmail,
        To: toEmail,
        ReplyTo: body.email,
        Subject: `[Chlo Contact] ${body.subject} – ${body.name}`,
        TextBody: [
          `Name:    ${body.name}`,
          `Email:   ${body.email}`,
          `Subject: ${body.subject}`,
          '',
          body.message,
        ].join('\n'),
        HtmlBody: `
          <p><strong>Name:</strong> ${escapeHtml(body.name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(body.email)}</p>
          <p><strong>Subject:</strong> ${escapeHtml(body.subject)}</p>
          <hr />
          <p>${escapeHtml(body.message).replace(/\n/g, '<br />')}</p>
        `,
        MessageStream: 'outbound',
      });
    } else {
      // Fallback: log to server console when Postmark is not configured
      console.log('📧 New Chlo contact form submission (email not sent – Postmark not configured):', {
        name: body.name,
        email: body.email,
        subject: body.subject,
        message: body.message,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json(
      { success: true, message: 'Message received successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again later.' },
      { status: 500 }
    );
  }
}
