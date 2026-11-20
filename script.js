document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('#primary-nav');
  function closeNav() { if (!toggle || !nav) return; toggle.setAttribute('aria-expanded', 'false'); nav.classList.remove('open'); toggle.querySelector('.toggle-icon').textContent = '+'; }
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open)); nav.classList.toggle('open', open); toggle.querySelector('.toggle-icon').textContent = open ? '×' : '+';
  });
  nav?.addEventListener('click', e => { if (e.target.closest('a')) closeNav(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav?.classList.contains('open')) { closeNav(); toggle.focus(); } });
  const cards = document.querySelectorAll('.decoder-card');
  cards.forEach(card => card.addEventListener('click', () => {
    const open = card.getAttribute('aria-expanded') !== 'true';
    cards.forEach(c => { c.classList.remove('active'); c.setAttribute('aria-expanded', 'false'); c.querySelector('.decode-pill').textContent = 'Decode ✦'; document.getElementById(c.getAttribute('aria-controls')).hidden = true; });
    if (open) { card.classList.add('active'); card.setAttribute('aria-expanded', 'true'); card.querySelector('.decode-pill').textContent = 'Decoded ✓'; document.getElementById(card.getAttribute('aria-controls')).hidden = false; }
  }));
  const form = document.getElementById('enquiry-form');
  if (!form) return;
  const intent = form.elements.intent;
  const events = document.getElementById('event-details');
  const consent = document.getElementById('updates-consent');
  const button = form.querySelector('[type=submit]');
  const status = document.getElementById('enquiry-status');
  let token = null, widget = null, submitting = false;
  const report = (text, error = false) => { status.textContent = text; status.classList.toggle('form-status-error', error); };
  function mode() { const quote = intent.value !== 'updates'; events.hidden = !quote; events.disabled = !quote; consent.required = intent.value !== 'quote'; button.textContent = quote ? 'Send catering enquiry' : 'Sign up for updates'; }
  intent.addEventListener('change', mode); mode();
  document.querySelectorAll('.enquiry-link').forEach(link => link.addEventListener('click', () => { if (!submitting && ['updates','quote','both'].includes(link.dataset.intent)) { intent.value = link.dataset.intent; mode(); } }));
  function initSecurity() {
    try {
      widget = window.turnstile.render('#enquiry-turnstile', { sitekey: '0x4AAAAAAGJvAUaNzUQkrpcH', size: 'flexible', callback: value => { token = value; button.disabled = submitting; if (!submitting) report('Security check complete. Your request is ready to send.'); }, 'expired-callback': () => { token = null; button.disabled = true; report('Security check expired. Please complete it again.'); }, 'error-callback': () => { token = null; button.disabled = true; report('Security check could not load. Please reload or email Book@littleredcoffeeco.ca.', true); } });
    } catch { report('Security check could not load. Please reload or email Book@littleredcoffeeco.ca.', true); }
  }
  if (window.turnstile) initSecurity();
  else { const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; script.onload = initSecurity; script.onerror = () => report('Security check could not load. Please email Book@littleredcoffeeco.ca.', true); document.head.append(script); }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (submitting || !form.reportValidity()) return;
    if (!token) { report('Please complete the security check.', true); return; }
    const data = new FormData(form);
    const payload = Object.fromEntries(['intent','firstName','email','phone','eventType','eventDate','eventLocation','guestCount','comments','website'].map(key => [key, String(data.get(key) || '').trim()]));
    payload.updatesConsent = consent.checked;
    payload.turnstileToken = token;
    submitting = true; button.disabled = true; form.setAttribute('aria-busy','true'); report('Sending your request…');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const result = await fetch('/api/leads', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload), signal:controller.signal });
      const body = await result.json();
      if (!result.ok || body.ok !== true) throw new Error(body.error || 'Your request could not be sent.');
      report(payload.intent === 'updates' ? 'Thank you! Your update signup has been sent to Little Red.' : 'Thank you! Your catering enquiry has been sent. We will reply by email. This is not a confirmed booking.');
      status.focus();
    } catch (error) { report(error.name === 'AbortError' ? 'Delivery could not be confirmed. Please email Book@littleredcoffeeco.ca before retrying to avoid a duplicate.' : `${error.message} Your details are still here. Please try again or email Book@littleredcoffeeco.ca.`, true); status.focus(); }
    finally { clearTimeout(timer); submitting = false; token = null; form.removeAttribute('aria-busy'); button.disabled = true; if (widget !== null && window.turnstile) window.turnstile.reset(widget); }
  });
});
