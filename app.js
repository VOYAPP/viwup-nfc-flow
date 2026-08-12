/* ============================================
   app.js — SPA Logic for ViwUp NFC Flow
   ============================================ */

var selectedGarzon = null;
var selectedRating = 0;
var selectedMotivos = [];
var waitingForGoogleMaps = false;

/* Star SVG — proper 5-point star path that renders in all browsers */
var STAR_SVG = '<svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">' +
  '<polygon class="star-icon" points="14,3 17.5,10.5 25.5,11.5 19.75,16.75 21,24.5 14,20.75 7,24.5 8.25,16.75 2.5,11.5 10.5,10.5" />' +
  '</svg>';

document.addEventListener('DOMContentLoaded', function() {
  applyWhiteLabel();
  renderChipsGarzon('chips-garzon-inicio');
  renderStars('stars-inicio');
});

function applyWhiteLabel() {
  document.documentElement.style.setProperty('--color-primary', CONFIG.primaryColor);
  var screens = ['inicio', 'sos'];
  for (var i = 0; i < screens.length; i++) {
    var screen = screens[i];
    var logoEl = document.getElementById('logo-' + screen);
    var initialEl = document.getElementById('logo-initial-' + screen);
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

function renderChipsGarzon(containerId) {
  var container = document.getElementById(containerId);
  container.innerHTML = '';
  for (var i = 0; i < CONFIG.garzones.length; i++) {
    var name = CONFIG.garzones[i];
    var chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = name;
    chip.setAttribute('data-name', name);
    chip.addEventListener('click', function() {
      selectGarzon(this.getAttribute('data-name'));
    });
    container.appendChild(chip);
  }
}

function selectGarzon(name) {
  selectedGarzon = name;
  updateChipSelection('chips-garzon-inicio', name);
}

function updateChipSelection(containerId, selectedName) {
  var container = document.getElementById(containerId);
  if (!container) return;
  var chips = container.children;
  for (var i = 0; i < chips.length; i++) {
    if (chips[i].textContent === selectedName) {
      chips[i].classList.add('selected');
    } else {
      chips[i].classList.remove('selected');
    }
  }
}

function renderStars(containerId) {
  var container = document.getElementById(containerId);
  container.innerHTML = '';
  for (var i = 1; i <= 5; i++) {
    var star = document.createElement('button');
    star.className = 'star';
    star.innerHTML = STAR_SVG;
    star.setAttribute('data-rating', i);
    star.addEventListener('click', function() {
      selectRating(parseInt(this.getAttribute('data-rating')));
    });
    container.appendChild(star);
  }
}

function renderStarsSOS() {
  var container = document.getElementById('stars-sos');
  container.innerHTML = '';
  for (var i = 1; i <= 5; i++) {
    var star = document.createElement('button');
    star.className = 'star';
    if (i <= selectedRating) star.classList.add('active');
    star.innerHTML = STAR_SVG;
    star.setAttribute('data-rating', i);
    star.addEventListener('click', function() {
      selectRating(parseInt(this.getAttribute('data-rating')));
    });
    container.appendChild(star);
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

function renderChipsMotivo() {
  var container = document.getElementById('chips-motivo');
  container.innerHTML = '';
  selectedMotivos = [];
  for (var i = 0; i < CONFIG.motivos.length; i++) {
    var motivo = CONFIG.motivos[i];
    var chip = document.createElement('button');
    chip.className = 'chip';
    chip.textContent = motivo;
    chip.setAttribute('data-motivo', motivo);
    chip.addEventListener('click', function() {
      toggleMotivo(this.getAttribute('data-motivo'), this);
    });
    container.appendChild(chip);
  }
}

function toggleMotivo(motivo, chipEl) {
  var idx = selectedMotivos.indexOf(motivo);
  if (idx === -1) {
    selectedMotivos.push(motivo);
    chipEl.classList.add('selected');
  } else {
    selectedMotivos.splice(idx, 1);
    chipEl.classList.remove('selected');
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

  var payload = {
    fecha: new Date().toISOString(),
    idLocal: CONFIG.idLocal,
    local: CONFIG.localName,
    garzon: selectedGarzon || '',
    rating: selectedRating,
    tipo: 'SOS',
    motivos: selectedMotivos.join(', '),
    comentario: comentario,
    estado: 'enviado'
  };

  sendToWebhook(payload).then(function() {
    ctaBtn.textContent = '✓ Enviado';
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
  var payload = {
    fecha: new Date().toISOString(),
    idLocal: CONFIG.idLocal,
    local: CONFIG.localName,
    garzon: selectedGarzon || '',
    rating: selectedRating,
    tipo: 'SEO',
    motivos: '',
    comentario: '',
    estado: 'redirigido_google'
  };

  sendToWebhook(payload).catch(function() {});
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
  var screens = document.querySelectorAll('.screen');
  for (var i = 0; i < screens.length; i++) {
    screens[i].classList.remove('active');
  }
  document.getElementById(screenId).classList.add('active');
  window.scrollTo(0, 0);
}

function sendToWebhook(payload) {
  return fetch(CONFIG.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(function(response) {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response;
  });
}
