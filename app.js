// 1. Leer la URL (ej: viwup.cl/resto/lucianosbbq)
var pathArray = window.location.pathname.split('/');
// Extraer la última parte de la URL (ej: "lucianosbbq")
var urlId = pathArray[pathArray.length - 1]; 

// 2. Buscar ese ID en nuestra base de datos (config.js)
var CONFIG = CLIENTES[urlId];

// 3. Sistema de seguridad por si escriben mal la URL
if (!CONFIG) {
  // Si no existe, cargamos la demo por defecto o mostramos error
  CONFIG = CLIENTES["demo"]; 
}

// --- NUEVO BLOQUE: Inyección de fondo dinámico y tema oscuro ---
if (CONFIG.bgUrl) {
  document.body.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.75)), url('${CONFIG.bgUrl}')`;
  document.body.style.backgroundSize = 'cover';
  document.body.style.backgroundPosition = 'center';
  document.body.style.backgroundAttachment = 'fixed';
}

if (CONFIG.theme === 'dark') {
  document.body.classList.add('dark-theme');
}
// ---------------------------------------------------------------

var selectedGarzon = null;
var selectedRating = 0;
var selectedMotivos = [];
var waitingForGoogleMaps = false;

document.addEventListener('DOMContentLoaded', function() {
  applyWhiteLabel();
  renderChipsGarzon('chips-garzon-inicio');
});

function applyWhiteLabel() {
  document.documentElement.style.setProperty('--color-primary', CONFIG.primaryColor);
  var screens = ['inicio', 'sos'];
  for (var i = 0; i < screens.length; i++) {
    var logoEl = document.getElementById('logo-' + screens[i]);
    var initialEl = document.getElementById('logo-initial-' + screens[i]);
    if (CONFIG.logoUrl) {
      var img = document.createElement('img');
      img.src = CONFIG.logoUrl;
      img.alt = CONFIG.localName;
      logoEl.innerHTML = '';
      logoEl.appendChild(img);
    } else {
      initialEl.textContent = CONFIG.localName.charAt(0).toUpperCase();
    }
  }
}

function createChip(text, onClick) {
  var btn = document.createElement('button');
  btn.className = 'chip';
  btn.textContent = text;
  btn.onclick = onClick;
  return btn;
}

function renderChipsGarzon(containerId) {
  var container = document.getElementById(containerId);
  container.innerHTML = '';
  for (var i = 0; i < CONFIG.garzones.length; i++) {
    (function(name) {
      container.appendChild(createChip(name, function() { selectGarzon(name); }));
    })(CONFIG.garzones[i]);
  }
}

function selectGarzon(name) {
  selectedGarzon = name;
  updateChipSelection('chips-garzon-inicio', name);
}

function updateChipSelection(containerId, name) {
  var container = document.getElementById(containerId);
  if (!container) return;
  for (var i = 0; i < container.children.length; i++) {
    var c = container.children[i];
    if (c.textContent === name) { c.classList.add('selected'); }
    else { c.classList.remove('selected'); }
  }
}

function selectRating(rating) {
  selectedRating = rating;
  if (rating <= 3) {
    showScreen('screen-sos');
    renderChipsGarzon('chips-garzon-sos');
    if (selectedGarzon) updateChipSelection('chips-garzon-sos', selectedGarzon);
    renderStarsSOS();
    renderChipsMotivo();
  } else {
    showScreen('screen-seo');
  }
}

function renderStarsSOS() {
  var container = document.getElementById('stars-sos');
  container.innerHTML = '';
  for (var i = 1; i <= 5; i++) {
    (function(r) {
      var btn = document.createElement('button');
      btn.className = 'star';
      if (r <= selectedRating) btn.classList.add('active');
      btn.innerHTML = '<svg viewBox="0 0 28 28"><polygon class="star-icon" points="14,3 17.5,10.5 25.5,11.5 19.75,16.75 21,24.5 14,20.75 7,24.5 8.25,16.75 2.5,11.5 10.5,10.5"/></svg>';
      btn.onclick = function() { selectRating(r); };
      container.appendChild(btn);
    })(i);
  }
}

function renderChipsMotivo() {
  var container = document.getElementById('chips-motivo');
  container.innerHTML = '';
  selectedMotivos = [];
  for (var i = 0; i < CONFIG.motivos.length; i++) {
    (function(motivo) {
      var chip = createChip(motivo, function() {
        var idx = selectedMotivos.indexOf(motivo);
        if (idx === -1) {
          selectedMotivos.push(motivo);
          this.classList.add('selected');
        } else {
          selectedMotivos.splice(idx, 1);
          this.classList.remove('selected');
        }
      });
      container.appendChild(chip);
    })(CONFIG.motivos[i]);
  }
}

function handleSOSSubmit() {
  var ctaBtn = document.getElementById('cta-sos');
  var errorEl = document.getElementById('error-sos');
  var comentario = document.getElementById('input-comentario').value.trim();

  ctaBtn.textContent = 'Enviando...';
  ctaBtn.classList.add('loading');
  ctaBtn.disabled = true;
  errorEl.classList.remove('visible');

  sendToWebhook({
    fecha: new Date().toISOString(),
    idLocal: CONFIG.idLocal,
    local: CONFIG.localName,
    garzon: selectedGarzon || '',
    rating: selectedRating,
    tipo: 'SOS',
    motivos: selectedMotivos.join(', '),
    comentario: comentario,
    estado: 'enviado',
    correoDestino: CONFIG.correoAlerta
  }).then(function() {
    ctaBtn.textContent = '\u2713 Enviado';
    ctaBtn.classList.remove('loading');
    ctaBtn.classList.add('confirmed');
    setTimeout(function() { showScreen('screen-exito'); }, 1500);
  }).catch(function() {
    ctaBtn.textContent = 'Enviar comentario privado';
    ctaBtn.classList.remove('loading');
    ctaBtn.disabled = false;
    errorEl.classList.add('visible');
  });
}

function handleSEORedirect() {
  sendToWebhook({
    fecha: new Date().toISOString(),
    idLocal: CONFIG.idLocal,
    local: CONFIG.localName,
    garzon: selectedGarzon || '',
    rating: selectedRating,
    tipo: 'SEO',
    motivos: '',
    comentario: '',
    estado: 'redirigido_google'
  }).catch(function() {});
  waitingForGoogleMaps = true;
  window.open(CONFIG.googleMapsUrl, '_blank');
}

document.addEventListener('visibilitychange', function() {
  if (!document.hidden && waitingForGoogleMaps) {
    waitingForGoogleMaps = false;
    showScreen('screen-exito');
  }
});

function showScreen(screenId) {
  var all = document.querySelectorAll('.screen');
  for (var i = 0; i < all.length; i++) all[i].classList.remove('active');
  document.getElementById(screenId).classList.add('active');
  window.scrollTo(0, 0);
}

function sendToWebhook(payload) {
  return fetch(CONFIG.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(function(r) {
    if (!r.ok) throw new Error(r.status);
    return r;
  });
}
