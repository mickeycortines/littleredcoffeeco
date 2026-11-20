const RECIPIENT = 'Book@littleredcoffeeco.ca';
const SENDER = 'book@littleredcoffeeco.ca';
const GMAIL_SEND_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const MAX_BODY_BYTES = 4096;
const MAX_NAME_LENGTH = 60;
const MAX_EMAIL_LENGTH = 254;
const INTERESTS = new Set([
  'Both',
  'Matcha Focus',
  'Espresso Focus',
  'Private Event',
  'Truck Restoration'
]);

export async function onRequestPost({ request, env }) {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
  if (contentType !== 'application/json') {
    return jsonResponse({ error: 'Please submit the form again.' }, 415);
  }

  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: 'Your request is too large.' }, 413);
  }

  let body;
  try {
    body = await readRequestBody(request);
  } catch {
    return jsonResponse({ error: 'Please submit the form again.' }, 400);
  }

  if (body.tooLarge) {
    return jsonResponse({ error: 'Your request is too large.' }, 413);
  }

  let inquiry;
  try {
    inquiry = JSON.parse(body.text);
  } catch {
    return jsonResponse({ error: 'Please submit the form again.' }, 400);
  }

  const validation = validateInquiry(inquiry);
  if (validation.error) {
    return jsonResponse({ error: validation.error }, 400);
  }
  if (validation.honeypot) {
    return jsonResponse({ error: 'Unable to process this request. Please try again.' }, 400);
  }

  const { email, form, firstName, interest } = validation;
  const message = createMessage({ email, form, firstName, interest });

  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REFRESH_TOKEN) {
    return jsonResponse({ error: 'Email delivery is temporarily unavailable. Please try again later.' }, 503);
  }

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: env.GOOGLE_REFRESH_TOKEN,
        grant_type: 'refresh_token',
        scope: GMAIL_SEND_SCOPE
      })
    });

    if (!tokenResponse.ok) {
      return deliveryUnavailable();
    }

    const tokenData = await tokenResponse.json();
    if (typeof tokenData.access_token !== 'string' || !tokenData.access_token) {
      return deliveryUnavailable();
    }

    const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: encodeBase64Url(message) })
    });

    if (!gmailResponse.ok) {
      return deliveryUnavailable();
    }

    return jsonResponse({ ok: true }, 200);
  } catch {
    return deliveryUnavailable();
  }
}

async function readRequestBody(request) {
  if (!request.body) {
    return { text: '', tooLarge: false };
  }

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.byteLength;
    if (totalBytes > MAX_BODY_BYTES) {
      await reader.cancel();
      return { text: '', tooLarge: true };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return {
    text: new TextDecoder('utf-8', { fatal: true }).decode(bytes),
    tooLarge: false
  };
}

function validateInquiry(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'Please submit the form again.' };
  }

  if (typeof value.website !== 'string') {
    return { error: 'Please submit the form again.' };
  }
  if (value.website.trim()) {
    return { honeypot: true };
  }

  const email = typeof value.email === 'string' ? value.email.trim() : '';
  const emailPattern = /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i;
  if (email.length > MAX_EMAIL_LENGTH || !emailPattern.test(email)) {
    return { error: 'Enter a valid email address and try again.' };
  }

  if (value.form === 'quick') {
    return { email, form: 'quick' };
  }

  if (value.form !== 'vip') {
    return { error: 'Please submit the form again.' };
  }

  const firstName = typeof value.firstName === 'string' ? value.firstName.trim() : '';
  if (!firstName || firstName.length > MAX_NAME_LENGTH || /[\u0000-\u001f\u007f]/.test(firstName)) {
    return { error: 'Enter a first name of 60 characters or fewer and try again.' };
  }
  if (typeof value.interest !== 'string' || !INTERESTS.has(value.interest)) {
    return { error: 'Choose one of the listed interests and try again.' };
  }

  return { email, firstName, form: 'vip', interest: value.interest };
}

function createMessage({ email, form, firstName, interest }) {
  const isVip = form === 'vip';
  const subject = isVip
    ? 'Website inquiry: VIP access'
    : 'Website inquiry: Secret invite request';
  const body = isVip
    ? [
        'Website inquiry: VIP access',
        `First name: ${firstName}`,
        `Email: ${email}`,
        `Interest: ${interest}`
      ].join('\r\n')
    : [
        'Website inquiry: Secret invite request',
        `Email: ${email}`,
        'Request: Secret pop-up drops and invites'
      ].join('\r\n');
  const encodedBody = wrapBase64(encodeBase64(body));

  return [
    `From: Little Red Coffee Co. <${SENDER}>`,
    `To: ${RECIPIENT}`,
    `Reply-To: ${email}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    encodedBody
  ].join('\r\n');
}

function encodeBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function encodeBase64Url(value) {
  return encodeBase64(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function wrapBase64(value) {
  return value.match(/.{1,76}/g)?.join('\r\n') ?? '';
}

function deliveryUnavailable() {
  return jsonResponse({ error: 'Email delivery failed. Please try again shortly.' }, 502);
}

function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}
