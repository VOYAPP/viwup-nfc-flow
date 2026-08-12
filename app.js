/* ============================================
   app.js — SPA Logic for ViwUp NFC Flow
   ============================================ */

/* ---------- State ---------- */
let selectedGarzon = null;
let selectedRating = 0;
let selectedMotivos = [];
let waitingForGoogleMaps = false;

/* ---------- SVG Template ----------
   Figma: STAR 28×28 inside 44×44 container */
const STAR_SVG = `<svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
  <path class="star-icon" d="M14 2.5L17.09 9.02L24.18 10.02L19.09 14.85L20.18 21.88L14 18.62L7.82 21.88L8.91 14.85L3.82 10.02L10.91 9.02L14 2.5Z"/>
</svg>`;

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  applyWhiteLabel();
  renderChipsGarzon('chips-garzon-inicio');
  renderStars('stars-inicio');
});

/* ---------- White-Label ---------- */
function applyWhiteLabel() {
  document.documentElement.style.setProperty('--color-primary', CONFIG.primaryColor);

  ['inicio', 'sos'].forEach(screen => {
    const logoEl = document.getElementById(`logo-${screen}`);
    const initialEl = document.getElementById(`logo-initial-${screen}`);
    if (CONFIG.logoUrl) {
      const img = document.createElement('img');
      img.src = CONFIG.logoUrl;
      img.alt = CONFIG.localName;
      logoEl.innerHTML = '';
      logoEl.appendChild(img);
    } else {
      initialEl.textContent = CONFIG.localName.charAt(0).toUpperCase();
    }
  });
}

/* ---------- Chips Garzón (single-select) ---------- */
function renderChipsGarzon(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  CONFIG.garzones.forEach(name => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = name;
    chip.addEventListener('click', () => selectGarzon(name));
    container.appendChild(chip);
  });
}

function selectGarzon(name) {
  selectedGarzon = name;
  updateChipSelection('chips-garzon-inicio', name);
}

function updateChipSelection(containerId, selectedName) {
  const container = document.getElementById(containerId);
  if (!container) return;
  Array.from(container.children).forEach(chip => {
    chip.classList.toggle('selected', chip.textContent === selectedName);
  });
}

/* ---------- Stars ---------- */
function renderStars(containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('button');
    star.className = 'star';
    star.innerHTML = STAR_SVG;
    star.addEventListener('click', () => selectRating(i));
    container.appendChild(star);
  }
}

function renderStarsSOS() {
  const container = document.getElementById('stars-sos');
  container.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('button');
    star.className = 'star';
    if (i <= selectedRating) star.classList.add('active');
    star.innerHTML = STAR_SVG;
    star.addEventListener('click', () => selectRating(i));
    container.appendChild(star);
  }
}

/* ---------- Rating Selection ---------- */
function selectRating(rating) {
  selectedRating = rating;

  if (rating <= 3) {
    // ★1-3 → SOS
    showScreen('screen-sos');
    renderChipsGarzon('chips-garzon-sos');
    if (selectedGarzon) updateChipSelection('chips-garzon-sos', selectedGarzon);
    renderStarsSOS();
    renderChipsMotivo();
  } else {
    // ★4-5 → SEO
    showScreen('screen-seo');
  }
}

/* ---------- Chips Motivo (multi-select) ---------- */
function renderChipsMotivo() {
  const container = document.getElementById('chips-motivo');
  container.innerHTML = '';
  selectedMotivos = [];
  CONFIG.motivos.forEach(motivo => {
    const chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = motivo;
    chip.addEventListener('click', () => toggleMotivo(motivo, chip));
    container.appendChild(chip);
  });
}

function toggleMotivo(motivo, chipEl) {
  const idx = selectedMotivos.indexOf(motivo);
  if (idx === -1) {
    selectedMotivos.push(motivo);
    chipEl.classList.add('selected');
  } else {
    selectedMotivos.splice(idx, 1);
    chipEl.classList.remove('selected');
  }
}

/* ---------- SOS Submit ---------- */
async function handleSOSSubmit() {
  const ctaBtn = document.getElementById('cta-sos');
  const errorEl = document.getElementById('error-sos');
  const comentario = document.getElementById('input-comentario').value.trim();

  // Loading state
  ctaBtn.textContent = 'Enviando...';
  ctaBtn.classList.add('loading');
  ctaBtn.disabled = true;
  errorEl.classList.remove('visible');

  const payload = {
    fecha: new Date().toISOString(),
    idLocal: CONFIG.idLocal,
    local: CONFIG.localName,
    garzon: selectedGarzon || '',
    rating: selectedRating,
    tipo: 'SOS',
    motivos: selectedMotivos.join(', '),
    comentario: comentario,
    estado: 'enviado',
  };

  try {
    await sendToWebhook(payload);
    // Confirmado
    ctaBtn.textContent = '✓ Enviado';
    ctaBtn.classList.remove('loading');
    ctaBtn.classList.add('confirmed');
    setTimeout(() => showScreen('screen-exito'), 1500);
  } catch (err) {
    // Error
    ctaBtn.textContent = 'Enviar comentario privado';
    ctaBtn.classList.remove('loading');
    ctaBtn.disabled = false;
    errorEl.classList.add('visible');
  }
}

/* ---------- SEO Redirect ---------- */
async function handleSEORedirect() {
  const payload = {
    fecha: new Date().toISOString(),
    idLocal: CONFIG.idLocal,
    local: CONFIG.localName,
    garzon: selectedGarzon || '',
    rating: selectedRating,
    tipo: 'SEO',
    motivos: '',
    comentario: '',
    estado: 'redirigido_google',
  };

  try {
    await sendToWebhook(payload);
  } catch (err) {
    // Continue anyway
  }

  waitingForGoogleMaps = true;
  window.open(CONFIG.googleMapsUrl, '_blank');
}

/* ---------- Detect return from Google Maps ---------- */
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && waitingForGoogleMaps) {
    waitingForGoogleMaps = false;
    showScreen('screen-exito');
  }
});

/* ---------- Screen Navigation ---------- */
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
  window.scrollTo(0, 0);
}

/* ---------- Webhook ---------- */
async function sendToWebhook(payload) {
  const response = await fetch(CONFIG.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}
