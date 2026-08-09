(function () {
  'use strict';

  var state = { garzon: null, rating: 0 };

  var screens = {
    inicio: document.getElementById('screen-inicio'),
    sos: document.getElementById('screen-sos'),
    seo: document.getElementById('screen-seo'),
    exito: document.getElementById('screen-exito'),
  };

  var chipsContainer = document.getElementById('chips-container');
  var stars = document.querySelectorAll('.star');
  var inputComentario = document.getElementById('input-comentario');
  var ctaSos = document.getElementById('cta-sos');
  var ctaSeo = document.getElementById('cta-seo');
  var errorSos = document.getElementById('error-sos');
  var errorSeo = document.getElementById('error-seo');
  var logoPlaceholder = document.getElementById('logo-placeholder');

  // =============================================
  // INIT
  // =============================================
  function init() {
    document.documentElement.style.setProperty('--color-primary', CONFIG.primaryColor);
    if (CONFIG.logoUrl) {
      logoPlaceholder.innerHTML = '<img src="' + CONFIG.logoUrl + '" alt="' + CONFIG.localName + '" class="logo-placeholder__img">';
    } else {
      logoPlaceholder.querySelector('.logo-placeholder__letter').textContent = CONFIG.localName.charAt(0).toUpperCase();
    }
    renderChips();
    bindEvents();
  }

  function renderChips() {
    chipsContainer.innerHTML = CONFIG.garzones
      .map(function(n) { return '<button class="chip" data-garzon="' + n + '">' + n + '</button>'; })
      .join('');
  }

  function navigateTo(name) {
    Object.values(screens).forEach(function(s) { s.classList.remove('active'); });
    screens[name].classList.add('active');
  }

  // =============================================
  // EVENTS
  // =============================================
  function bindEvents() {
    chipsContainer.addEventListener('click', function(e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      chipsContainer.querySelectorAll('.chip').forEach(function(c) { c.classList.remove('selected'); });
      chip.classList.add('selected');
      state.garzon = chip.dataset.garzon;
    });

    stars.forEach(function(star) {
      star.addEventListener('click', function() {
        state.rating = parseInt(this.dataset.value);
        stars.forEach(function(s) {
          s.classList.toggle('active', parseInt(s.dataset.value) <= state.rating);
        });
        setTimeout(function() {
          navigateTo(state.rating <= 3 ? 'sos' : 'seo');
        }, 300);
      });
    });

    inputComentario.addEventListener('input', function() {
      ctaSos.disabled = this.value.trim().length === 0;
    });

    ctaSos.addEventListener('click', function() { submitSos(); });
    ctaSeo.addEventListener('click', function() { submitSeo(); });
  }

  // =============================================
  // ENVIAR A MAKE WEBHOOK
  // =============================================
  function sendToWebhook(payload) {
    if (!CONFIG.webhookUrl || CONFIG.webhookUrl.includes('TU_WEBHOOK_AQUI')) {
      console.log('[TESTEO] Payload que se enviaría a Make:', JSON.stringify(payload, null, 2));
      return Promise.resolve({ ok: true });
    }

    return fetch(CONFIG.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  /**
   * Construye el payload estándar para Make → Google Sheets
   * 
   * Columnas esperadas en la Base Maestra:
   * | fecha | idLocal | local | garzon | rating | tipo | comentario | estado |
   */
  function buildPayload(tipo, extra) {
    var base = {
      fecha: new Date().toISOString(),
      idLocal: CONFIG.idLocal,
      local: CONFIG.localName,
      garzon: state.garzon || 'No seleccionado',
      rating: state.rating,
      tipo: tipo,          // "SOS" o "SEO"
      comentario: '',      // Solo SOS llena esto
      estado: 'enviado',
    };

    // Merge extra fields
    if (extra) {
      Object.keys(extra).forEach(function(key) { base[key] = extra[key]; });
    }

    return base;
  }

  // =============================================
  // FLUJO SOS (1-3 estrellas) → Comentario privado
  // =============================================
  function submitSos() {
    var comentario = inputComentario.value.trim();
    if (!comentario) return;

    setLoading(ctaSos, true);
    errorSos.classList.add('hidden');

    var payload = buildPayload('SOS', {
      comentario: comentario,
      estado: 'comentario_privado_enviado',
    });

    sendToWebhook(payload).then(function(r) {
      if (r && !r.ok && r.status) throw new Error('HTTP ' + r.status);
      setConfirmed(ctaSos, '✓ Enviado');
      setTimeout(function() { navigateTo('exito'); }, 1000);
    }).catch(function() {
      setLoading(ctaSos, false);
      errorSos.classList.remove('hidden');
    });
  }

  // =============================================
  // FLUJO SEO (4-5 estrellas) → Redirige a Google Maps
  // =============================================
  function submitSeo() {
    setLoading(ctaSeo, true);
    errorSeo.classList.add('hidden');

    var payload = buildPayload('SEO', {
      estado: 'redirigido_google_maps',
    });

    sendToWebhook(payload).then(function(r) {
      if (r && !r.ok && r.status) throw new Error('HTTP ' + r.status);
      setConfirmed(ctaSeo, '✓ Publicado');
      setTimeout(function() {
        window.open(CONFIG.googleMapsUrl, '_blank');
        navigateTo('exito');
      }, 800);
    }).catch(function() {
      setLoading(ctaSeo, false);
      errorSeo.classList.remove('hidden');
    });
  }

  // =============================================
  // BUTTON STATES
  // =============================================
  function setLoading(btn, on) {
    var label = btn.querySelector('.btn-primary__label');
    var loading = btn.querySelector('.btn-primary__loading');
    if (on) {
      btn.classList.add('loading'); btn.disabled = true;
      label.classList.add('hidden'); loading.classList.remove('hidden');
    } else {
      btn.classList.remove('loading'); btn.disabled = false;
      label.classList.remove('hidden'); loading.classList.add('hidden');
    }
  }

  function setConfirmed(btn, text) {
    btn.classList.remove('loading');
    var label = btn.querySelector('.btn-primary__label');
    var loading = btn.querySelector('.btn-primary__loading');
    label.textContent = text;
    label.classList.remove('hidden');
    loading.classList.add('hidden');
  }

  init();
})();
