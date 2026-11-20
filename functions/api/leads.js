const RECIPIENT = 'Book@littleredcoffeeco.ca';
const SENDER = 'book@littleredcoffeeco.ca';
const HOSTS = new Set(['littleredcoffeeco.ca', 'www.littleredcoffeeco.ca']);
export function validateLead(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v) || typeof v.website !== 'string' || v.website.trim()) return { error: 'Please submit the form again.' };
  const email = typeof v.email === 'string' ? v.email.trim() : '';
  if (email.length > 254 || !/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$/i.test(email)) return { error: 'Enter a valid email address.' };
  if (!['updates','quote','both'].includes(v.intent)) return { error: 'Choose updates, a catering quote, or both.' };
  const f = { email, intent: v.intent };
  for (const [key, max] of Object.entries({firstName:60,comments:1500,phone:40,eventType:80,eventDate:10,eventLocation:200})) {
    const raw = v[key] ?? '';
    if (typeof raw !== 'string' || raw.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(raw) || (key !== 'comments' && /[\r\n\t]/.test(raw))) return { error: 'Please correct or shorten your name, comments, or event details.' };
    f[key] = raw.trim();
  }
  if (!f.firstName) return { error: 'Please enter your first name.' };
  if (f.eventDate) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(f.eventDate) ? new Date(f.eventDate+'T00:00:00Z') : new Date(NaN);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== f.eventDate) return { error: 'Enter a valid event date or leave it blank.' };
  }
  const guests = v.guestCount ?? '';
  if (!['string','number'].includes(typeof guests)) return { error: 'Enter a whole-number guest estimate or leave it blank.' };
  f.guestCount = String(guests).trim();
  if (f.guestCount && (!/^\d{1,6}$/.test(f.guestCount) || Number(f.guestCount)<1 || Number(f.guestCount)>100000)) return { error: 'Enter a whole-number guest estimate between 1 and 100000, or leave it blank.' };
  if (typeof v.updatesConsent !== 'boolean' || (v.intent !== 'quote' && !v.updatesConsent)) return { error: 'Give permission for build updates, or select catering quote only.' };
  f.updatesConsent = v.updatesConsent;
  f.consentRecordedAt = v.updatesConsent ? new Date().toISOString() : '';
  return { fields: f };
}
export function createLeadMessage(f) {
  const purpose = f.intent === 'updates' ? 'Build updates' : f.intent === 'both' ? 'Catering quote and build updates' : 'Catering quote';
  const lines = [`Enquiry purpose: ${purpose}`,`First name: ${f.firstName}`,`Email: ${f.email}`,`Phone: ${f.phone || 'Not provided'}`,`Event type: ${f.eventType || 'Not yet known'}`,`Preferred date: ${f.eventDate || 'Not yet known'}`,`Venue / location: ${f.eventLocation || 'Not yet known'}`,`Estimated guests: ${f.guestCount || 'Not yet known'}`,`Build updates permission: ${f.updatesConsent ? 'Yes - explicit opt-in' : 'No'}`,`Permission recorded at: ${f.consentRecordedAt || 'Not applicable'}`,'Source: Website enquiry form','','Comments / catering requirements:',f.comments || 'None provided','','Pre-launch enquiry only. Pricing, availability, and bookings require follow-up.'];
  const body = base64(lines.join('\r\n')).match(/.{1,76}/g)?.join('\r\n') || '';
  return [`From: Little Red Coffee Co. <${SENDER}>`,`To: ${RECIPIENT}`,`Reply-To: ${f.email}`,`Subject: Website inquiry: ${purpose}`,'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',body].join('\r\n');
}
export async function onRequestPost({request,env}) {
  if (request.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase() !== 'application/json') return reply({error:'Please submit the form again.'},415);
  let value;
  try {
    const reader = request.body?.getReader();
    if (!reader) return reply({error:'Please submit the form again.'},400);
    const chunks=[]; let size=0;
    while (true) { const p=await reader.read(); if(p.done)break; size+=p.value.byteLength; if(size>16384){await reader.cancel();return reply({error:'Your request is too large.'},413);} chunks.push(p.value); }
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  } catch {return reply({error:'Please submit the form again.'},400);}
  const checked=validateLead(value);if(checked.error)return reply({error:checked.error},400);
  const token=typeof value.turnstileToken==='string'?value.turnstileToken.trim():'';
  if(!token||token.length>2048)return reply({error:'Please complete the security check again.'},400);
  if(typeof env.TURNSTILE_SECRET_KEY!=='string'||!env.TURNSTILE_SECRET_KEY.trim())return reply({error:'Security verification is temporarily unavailable.'},503);
  try {
    const check=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret:env.TURNSTILE_SECRET_KEY,response:token})});
    if(!check.ok)return reply({error:'Security verification is temporarily unavailable.'},503);
    const verified=await check.json();if(verified?.success!==true||!HOSTS.has(verified.hostname))return reply({error:'Please complete the security check again.'},400);
    if(!env.GOOGLE_CLIENT_ID||!env.GOOGLE_CLIENT_SECRET||!env.GOOGLE_REFRESH_TOKEN)return reply({error:'Email delivery is temporarily unavailable.'},503);
    const auth=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:env.GOOGLE_CLIENT_ID,client_secret:env.GOOGLE_CLIENT_SECRET,refresh_token:env.GOOGLE_REFRESH_TOKEN,grant_type:'refresh_token',scope:'https://www.googleapis.com/auth/gmail.send'})});
    if(!auth.ok)return unavailable();const credentials=await auth.json();if(typeof credentials?.access_token!=='string'||!credentials.access_token)return unavailable();
    const raw=base64(createLeadMessage(checked.fields)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    const sent=await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send',{method:'POST',headers:{Authorization:`Bearer ${credentials.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({raw})});
    return sent.ok?reply({ok:true},200):unavailable();
  }catch{return unavailable();}
}
function base64(text){return btoa(Array.from(new TextEncoder().encode(text),b=>String.fromCharCode(b)).join(''));}
function unavailable(){return reply({error:'We could not send your enquiry. Please try again shortly.'},502);}
function reply(body,status){return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});}
