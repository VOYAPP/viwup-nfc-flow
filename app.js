// ╔═══════════════════════════════════════════════════════════════╗
// ║  app.js — Flujo Proactivo NFC (SPA)                        ║
// ║  4 pantallas: 01-Inicio → 02-SOS (★1-3) → 04-Éxito        ║
// ║               01-Inicio → 03-SEO (★4-5) → Google Maps     ║
// ║               Al volver de Google Maps → 04-Éxito           ║
// ╚═══════════════════════════════════════════════════════════════╝

let selectedGarzon = null;
let selectedRating = 0;
let selectedMotivos = [];
let waitingForGoogleMaps = false;

document.addEventListener('DOMContentLoaded', () => {
  applyWhiteLabel();
  renderChipsGarzon();
  renderStars();
  renderChipsMotivo();

  // Al volver de Google Maps → mostrar Éxito
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && waitingForGoogleMaps) {
      waitingForGoogleMaps = false;
      showScreen('exito');
    }
  });
});

function applyWhiteLabel() {
  document.documentElement.style.setProperty('--color-primary', CONFIG.primaryColor);
  const logos = [
    { container: 'logo-inicio', fallback: 'logo-fallback-inicio' },
    { container: 'logo-sos', fallback: 'logo-fallback-sos' },
    { container: 'logo-seo', fallback: 'logo-fallback-seo' },
  ];
  logos.forEach(({ container, fallback }) => {
    const el = document.getElementById(container);
    const fb = document.getElementById(fallback);
    if (!el) return;
    if (CONFIG.logoUrl) {
      const img = document.createElement('img');
      img.src = CONFIG.logoUrl;
      img.alt = CONFIG.localName;
      el.innerHTML = '';
      el.appendChild(img);
    } else if (fb) {
      fb.textContent = CONFIG.localName.charAt(0).toUpperCase();
    }
  });
}

function renderChipsGarzon() {
  const container = document.getElementById('chips-garzon');
  container.innerHTML = '';
  CONFIG.garzones.forEach(name => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = name;
    chip.onclick = () => {
      selectedGarzon = name;
      container.querySelectorAll('.chip').forEach(c =>
        c.classList.toggle('selected', c.textContent === name)
      );
    };
    container.appendChild(chip);
  });
}

function renderChipsGarzonSOS() {
  const container = document.getElementById('chips-garzon-sos');
  container.innerHTML = '';
  CONFIG.garzones.forEach(name => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    if (name === selectedGarzon) chip.classList.add('selected');
    chip.textContent = name;
    chip.onclick = () => {
      selectedGarzon = name;
      container.querySelectorAll('.chip').forEach(c =>
        c.classList.toggle('selected', c.textContent === name)
      );
    };
    container.appendChild(chip);
  });
}

function renderStars() {
  const container = document.getElementById('stars-container');
  container.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('div');
    star.className = 'star';
    star.innerHTML = `<svg viewBox="0 0 44 44"><path d="M22 6l4.9 9.9 10.9 1.6-7.9 7.7 1.9 10.8L22 31l-9.8 5 1.9-10.8-7.9-7.7 10.9-1.6z"/></svg>`;
    star.onclick = () => selectRating(i);
    container.appendChild(star);
  }
}

function renderStarsSOS() {
  const container = document.getElementById('stars-sos');
  container.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('div');
    star.className = 'star' + (i <= selectedRating ? ' active' : '');
    star.innerHTML = `<svg viewBox="0 0 44 44"><path d="M22 6l4.9 9.9 10.9 1.6-7.9 7.7 1.9 10.8L22 31l-9.8 5 1.9-10.8-7.9-7.7 10.9-1.6z"/></svg>`;
    container.appendChild(star);
  }
}

function selectRating(rating) {
  selectedRating = rating;
  document.querySelectorAll('#stars-container .star').forEach((star, i) => {
    star.classList.toggle('active', i < rating);
  });
  const caption = document.getElementById('rating-caption');
  if (rating <= 3) {
    caption.textContent = 'Cuéntanos qué pasó';
    setTimeout(() => {
      renderChipsGarzonSOS();
      renderStarsSOS();
      showScreen('sos');
    }, 400);
  } else {
    caption.textContent = rating === 5 ? '¡Excelente!' : '¡Muy bien!';
    setTimeout(() => showScreen('seo'), 400);
  }
}

function renderChipsMotivo() {
  const container = document.getElementById('chips-motivo');
  container.innerHTML = '';
  CONFIG.motivos.forEach(motivo => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = motivo;
    chip.onclick = () => {
      const idx = selectedMotivos.indexOf(motivo);
      if (idx >= 0) {
        selectedMotivos.splice(idx, 1);
        chip.classList.remove('selected');
      } else {
        selectedMotivos.push(motivo);
        chip.classList.add('selected');
      }
    };
    container.appendChild(chip);
  });
}

async function handleSOSSubmit() {
  const btn = document.getElementById('btn-sos');
  const errorEl = document.getElementById('sos-error');
  const comentario = document.getElementById('input-sos').value.trim();

  btn.textContent = 'Enviando...';
  btn.classList.add('loading');
  btn.disabled = true;
  errorEl.style.display = 'none';

  const payload = {
    fecha: new Date().toISOString(),
    idLocal: CONFIG.idLocal,
    local: CONFIG.localName,
    garzon: selectedGarzon || 'No seleccionado',
    rating: selectedRating,
    tipo: 'SOS',
    motivos: selectedMotivos.join(', ') || 'No especificado',
    comentario: comentario || 'Sin comentario',
    estado: 'comentario_privado_enviado'
  };

  const success = await sendToWebhook(payload);

  if (success) {
    btn.textContent = '✓ Enviado';
    btn.classList.remove('loading');
    btn.classList.add('success');
    setTimeout(() => showScreen('exito'), 1500);
  } else {
    btn.textContent = 'Enviar comentario privado';
    btn.classList.remove('loading');
    btn.disabled = false;
    errorEl.style.display = 'block';
  }
}

async function handleSEORedirect() {
  const payload = {
    fecha: new Date().toISOString(),
    idLocal: CONFIG.idLocal,
    local: CONFIG.localName,
    garzon: selectedGarzon || 'No seleccionado',
    rating: selectedRating,
    tipo: 'SEO',
    motivos: '',
    comentario: '',
    estado: 'redirigido_google_maps'
  };

  await sendToWebhook(payload);

  if (CONFIG.googleMapsUrl && !CONFIG.googleMapsUrl.includes('TU_PLACE_ID')) {
    waitingForGoogleMaps = true;
    window.open(CONFIG.googleMapsUrl, '_blank');
  } else {
    showScreen('exito');
  }
}

async function sendToWebhook(payload) {
  console.log('📦 Payload:', JSON.stringify(payload, null, 2));
  if (!CONFIG.webhookUrl || CONFIG.webhookUrl.includes('TU_WEBHOOK_AQUI')) {
    console.log('⚠️ Webhook no configurado — datos solo en consola');
    return true;
  }
  try {
    const response = await fetch(CONFIG.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      console.log('✅ Webhook enviado correctamente');
      return true;
    } else {
      console.error('❌ Webhook error:', response.status, response.statusText);
      return false;
    }
  } catch (err) {
    console.error('❌ Error de red:', err.message);
    return false;
  }
}

function showScreen(screenName) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(`screen-${screenName}`);
  if (target) target.classList.add('active');
}
