(function () {
  'use strict';

  const state = { garzon: null, rating: 0 };

  const screens = {
    inicio: document.getElementById('screen-inicio'),
    sos: document.getElementById('screen-sos'),
    seo: document.getElementById('screen-seo'),
    exito: document.getElementById('screen-exito'),
  };

  const chipsContainer = document.getElementById('chips-container');
  const stars = document.querySelectorAll('.star');
  const inputComentario = document.getElementById('input-comentario');
  const ctaSos = document.getElementById('cta-sos');
  const ctaSeo = document.getElementById('cta-seo');
  const errorSos = document.getElementById('error-sos');
  const errorSeo = document.getElementById('error-seo');
  const logoPlaceholder = document.getElementById('logo-placeholder');

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

  function submitSos() {
    var comentario = inputComentario.value.trim();
    if (!comentario) return;
    setLoading(ctaSos, true);
    errorSos.classList.add('hidden');

    var payload = {
      type: 'comentario_privado',
      garzon: state.garzon,
      rating: state.rating,
      comentario: comentario,
      timestamp: new Date().toISOString()
    };

    if (CONFIG.webhookUrl) {
      fetch(CONFIG.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function(r) {
        if (!r.ok) throw new Error('fail');
        setConfirmed(ctaSos, '✓ Enviado');
        setTimeout(function() { navigateTo('exito'); }, 1000);
      }).catch(function() {
        setLoading(ctaSos, false);
        errorSos.classList.remove('hidden');
      });
    } else {
      setTimeout(function() {
        setConfirmed(ctaSos, '✓ Enviado');
        setTimeout(function() { navigateTo('exito'); }, 1000);
      }, 800);
    }
  }

  function submitSeo() {
    setLoading(ctaSeo, true);
    errorSeo.classList.add('hidden');
    setTimeout(function() {
      setConfirmed(ctaSeo, '✓ Publicado');
      setTimeout(function() {
        window.open(CONFIG.googleMapsUrl, '_blank');
        navigateTo('exito');
      }, 800);
    }, 500);
  }

  init();
})();
