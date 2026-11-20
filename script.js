document.addEventListener('DOMContentLoaded', () => {
  const turnstileTokens = { quick: null, vip: null };
  const turnstileWidgets = { quick: null, vip: null };
  const turnstileSiteKey = '0x4AAAAAAGJvAUaNzUQkrpcH';

  function renderTurnstileWidget(formName, containerId) {
    if (!window.turnstile) return;

    turnstileWidgets[formName] = window.turnstile.render(`#${containerId}`, {
      sitekey: turnstileSiteKey,
      callback: token => { turnstileTokens[formName] = token; },
      'expired-callback': () => { turnstileTokens[formName] = null; },
      'error-callback': () => { turnstileTokens[formName] = null; }
    });
  }

  renderTurnstileWidget('quick', 'quick-turnstile');
  renderTurnstileWidget('vip', 'vip-turnstile');

  function resetTurnstileWidget(formName) {
    turnstileTokens[formName] = null;
    if (turnstileWidgets[formName] !== null && window.turnstile) {
      window.turnstile.reset(turnstileWidgets[formName]);
    }
  }

  // Mobile Nav Toggle
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('#primary-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      toggle.querySelector('.toggle-icon').textContent = open ? '✕' : '+';
      nav.classList.toggle('open', open);
    });
    nav.addEventListener('click', (e) => {
      if (e.target.closest('a')) {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.querySelector('.toggle-icon').textContent = '+';
        nav.classList.remove('open');
      }
    });
  }

  // Hero Quick Capture
  const quickForm = document.querySelector('#hero-quick-form');
  const quickInput = document.querySelector('#quick-email');
  const quickStatus = document.querySelector('#quick-status');

  if (quickForm) {
    const quickButton = quickForm.querySelector('button[type="submit"]');
    let quickSubmitting = false;

    quickForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (quickSubmitting) return;

      const val = quickInput.value.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!val || !emailRegex.test(val)) {
        quickStatus.textContent = 'Please enter a valid email address.';
        quickStatus.classList.add('quick-error');
        quickStatus.hidden = false;
        quickInput.focus();
        return;
      }

      const turnstileToken = turnstileTokens.quick;
      if (!turnstileToken) {
        quickStatus.textContent = 'Please complete the security check before submitting.';
        quickStatus.classList.add('quick-error');
        quickStatus.hidden = false;
        return;
      }

      quickSubmitting = true;
      quickButton.disabled = true;
      quickStatus.classList.remove('quick-error');
      quickStatus.textContent = 'Sending your request...';
      quickStatus.hidden = false;

      try {
        await postInquiry({
          form: 'quick',
          email: val,
          website: quickForm.elements.website.value,
          turnstileToken
        });
        quickStatus.textContent = 'Thanks! Your request has been sent. We’ll be in touch.';
      } catch {
        quickStatus.textContent = 'We couldn’t send your request right now. Please try again; your email is still here.';
        quickStatus.classList.add('quick-error');
      } finally {
        resetTurnstileWidget('quick');
        quickSubmitting = false;
        quickButton.disabled = false;
      }
    });
  }

  // Decoder Interactive Experience
  const decoderCards = document.querySelectorAll('.decoder-card');
  const joyToast = document.querySelector('#joy-toast');
  const toastMsg = document.querySelector('#toast-msg');

  decoderCards.forEach(card => {
    card.addEventListener('click', () => {
      const isActive = card.classList.contains('active');

      decoderCards.forEach(c => {
        c.classList.remove('active');
        c.classList.remove('shimmer');
        c.setAttribute('aria-expanded', 'false');
        c.querySelector('.decode-pill').textContent = 'Decode ✦';
      });

      if (!isActive) {
        card.classList.add('active');
        card.classList.add('shimmer');
        card.setAttribute('aria-expanded', 'true');
        card.querySelector('.decode-pill').textContent = 'Decoded ✓';

        triggerSlickBurst(card);

        if (joyToast && toastMsg) {
          joyToast.hidden = false;
          toastMsg.innerHTML = `<strong>${card.dataset.english}</strong>: ${card.dataset.joy}`;
        }
      } else {
        if (joyToast) joyToast.hidden = true;
      }
    });
  });

  function triggerSlickBurst(target) {
    const symbols = ['✦', '✨', '☕', '🍵', '🎌'];
    const rect = target.getBoundingClientRect();

    for (let i = 0; i < 7; i++) {
      const spark = document.createElement('span');
      spark.textContent = symbols[Math.floor(Math.random() * symbols.length)];
      spark.style.position = 'fixed';
      spark.style.left = `${rect.right - 60 + Math.random() * 40}px`;
      spark.style.top = `${rect.top + 20}px`;
      spark.style.fontSize = `${14 + Math.random() * 10}px`;
      spark.style.color = '#BE0015';
      spark.style.pointerEvents = 'none';
      spark.style.zIndex = '9999';
      spark.style.transition = 'transform 0.75s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.75s ease';
      document.body.appendChild(spark);

      requestAnimationFrame(() => {
        const dx = (Math.random() - 0.5) * 120;
        const dy = -(30 + Math.random() * 60);
        spark.style.transform = `translate(${dx}px, ${dy}px) scale(1.2)`;
        spark.style.opacity = '0';
      });

      setTimeout(() => spark.remove(), 800);
    }
  }

  // CRM Form Handler
  const form = document.querySelector('#crm-form');
  const successBox = document.querySelector('#crm-success');
  const formStatus = document.querySelector('#crm-status');

  if (form) {
    const submitButton = form.querySelector('button[type="submit"]');
    let formSubmitting = false;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (formSubmitting) return;

      let hasError = false;
      const nameInput = document.querySelector('#crm-first-name');
      const emailInput = document.querySelector('#crm-email');
      const interestSelect = document.querySelector('#crm-interest');

      const nameError = document.querySelector('#name-error');
      const emailError = document.querySelector('#email-error');

      [nameError, emailError].forEach(el => el.textContent = '');
      formStatus.hidden = true;

      if (!nameInput.value.trim()) {
        nameError.textContent = 'Please enter your first name.';
        hasError = true;
      }
      const emailVal = emailInput.value.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailVal || !emailRegex.test(emailVal)) {
        emailError.textContent = 'Please enter a valid email address.';
        hasError = true;
      }

      if (hasError) return;

      const turnstileToken = turnstileTokens.vip;
      if (!turnstileToken) {
        formStatus.textContent = 'Please complete the security check before submitting.';
        formStatus.classList.add('form-status-error');
        formStatus.hidden = false;
        return;
      }

      formSubmitting = true;
      submitButton.disabled = true;
      formStatus.textContent = 'Sending your request...';
      formStatus.classList.remove('form-status-error');
      formStatus.hidden = false;

      try {
        await postInquiry({
          form: 'vip',
          firstName: nameInput.value.trim(),
          email: emailVal,
          interest: interestSelect.value,
          website: form.elements.website.value,
          turnstileToken
        });
        formStatus.hidden = true;
        successBox.querySelector('h4').textContent = 'You’re on the insider list!';
        successBox.querySelector('#success-message').textContent = 'Thank you! Your request has been sent. We’ll be in touch with tasting updates.';
        successBox.hidden = false;
        successBox.focus();
      } catch {
        formStatus.textContent = 'We couldn’t send your request right now. Please try again; your details are still here.';
        formStatus.classList.add('form-status-error');
        formStatus.hidden = false;
      } finally {
        resetTurnstileWidget('vip');
        formSubmitting = false;
        submitButton.disabled = false;
      }
    });
  }

  async function postInquiry(inquiry) {
    const response = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inquiry)
    });

    if (!response.ok) {
      throw new Error('Inquiry delivery failed.');
    }
  }
});
