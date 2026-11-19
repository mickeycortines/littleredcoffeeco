document.addEventListener('DOMContentLoaded', () => {
  const inquiryEmail = 'Booking@littleredcoffeeco.ca';

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
    quickForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = quickInput.value.trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!val || !emailRegex.test(val)) {
        alert('Please enter a valid email address.');
        return;
      }
      saveLead({ email: val, source: 'Hero_Quick_Capture' });
      openInquiryEmail('Website inquiry: Secret invite request', `Email: ${val}\nRequest: Secret pop-up drops and invites`);
      quickStatus.textContent = `Your email app should open a message to ${inquiryEmail}. Send it to complete your request.`;
      quickStatus.hidden = false;
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

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      let hasError = false;
      const nameInput = document.querySelector('#crm-first-name');
      const emailInput = document.querySelector('#crm-email');
      const interestSelect = document.querySelector('#crm-interest');

      const nameError = document.querySelector('#name-error');
      const emailError = document.querySelector('#email-error');

      [nameError, emailError].forEach(el => el.textContent = '');

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

      saveLead({
        firstName: nameInput.value.trim(),
        email: emailVal,
        interest: interestSelect.value,
        source: 'Main_VIP_Form'
      });

      openInquiryEmail(
        'Website inquiry: VIP access',
        `First name: ${nameInput.value.trim()}\nEmail: ${emailVal}\nInterest: ${interestSelect.value}`
      );
      successBox.querySelector('h4').textContent = 'Complete your request';
      successBox.querySelector('#success-message').textContent = `Your email app should open a message to ${inquiryEmail}. Send it to complete your request.`;
      successBox.hidden = false;
      successBox.focus();
    });
  }

  function openInquiryEmail(subject, body) {
    window.location.href = `mailto:${inquiryEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function saveLead(leadData) {
    try {
      const list = JSON.parse(localStorage.getItem('little_red_crm_leads') || '[]');
      list.push({ ...leadData, date: new Date().toISOString(), city: 'Calgary' });
      localStorage.setItem('little_red_crm_leads', JSON.stringify(list));
    } catch (e) {
      console.warn('Storage unavailable', e);
    }
  }
});
