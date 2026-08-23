// ==========================================
// 1. CONEXIÓN A SUPABASE
// ==========================================
// ¡IMPORTANTE! Reemplaza esto con los datos de tu panel (Project Settings -> API)
const supabaseUrl = 'TU_URL_DE_SUPABASE';
const supabaseKey = 'TU_CLAVE_ANONIMA_PUBLICA';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// El webhook maestro de Make para TODAS las alertas de todos los locales
const MASTER_WEBHOOK_URL = 'https://hook.us2.make.com/2f2amy2uq88ptk4fksltadyxn485xeov';

// ==========================================
// 2. VARIABLES GLOBALES
// ==========================================
let localActual = null;
let garzonesActuales = [];
var selectedGarzon = null;
var selectedRating = 0;
var selectedMotivos = [];
var waitingForGoogleMaps = false;

// Motivos por defecto (Luego puedes agregarlos a Supabase si quieres personalizarlos por local)
const motivosDefault = ['Servicio', 'Cocina', 'Barra'];

// ==========================================
// 3. INICIALIZACIÓN DINÁMICA
// ==========================================
document.addEventListener('DOMContentLoaded', async function() {
    // 1. Leer la URL (ej: viwup.cl/resto/lucianosbbq -> "lucianosbbq")
    var pathArray = window.location.pathname.split('/');
    var urlId = pathArray[pathArray.length - 1]; 
    if (!urlId || urlId === 'app.html') urlId = 'demo'; // Fallback de seguridad

    try {
        // 2. Buscar el local en la base de datos
        const { data: localData, error: localError } = await supabase
            .from('locales')
            .select('*')
            .eq('slug', urlId)
            .single();

        if (localError || !localData) {
            document.body.innerHTML = "<h1 class='heading-lg' style='margin-top:50px;'>Local no encontrado en el sistema</h1>";
            return;
        }
        localActual = localData;

        // 3. Buscar los garzones activos de este local
        const { data: garzonesData, error: garzonesError } = await supabase
            .from('garzones')
            .select('*')
            .eq('local_id', localActual.id)
            .eq('estado_activo', true);

        if (!garzonesError && garzonesData) {
            garzonesActuales = garzonesData;
        }

        // 4. Aplicar diseño y dibujar los botones
        applyWhiteLabel();
        renderChipsGarzon('chips-garzon-inicio');

    } catch (error) {
        console.error("Error conectando con Supabase:", error);
    }
});

// ==========================================
// 4. FUNCIONES DE UI Y DISEÑO
// ==========================================
function applyWhiteLabel() {
    // A. Colores
    if (localActual.color_primario) {
        document.documentElement.style.setProperty('--color-primary', localActual.color_primario);
    }

    // B. Fondo Dinámico
    if (localActual.bg_imagen_url) {
        document.body.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.75)), url('${localActual.bg_imagen_url}')`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundAttachment = 'fixed';
    }

    // C. Tema Oscuro
    if (localActual.tema_visual === 'dark') {
        document.body.classList.add('dark-theme');
    }

    // D. Inyectar los Logos
    var screens = ['inicio', 'sos'];
    for (var i = 0; i < screens.length; i++) {
        var logoEl = document.getElementById('logo-' + screens[i]);
        var initialEl = document.getElementById('logo-initial-' + screens[i]);
        if (localActual.logo_url) {
            var img = document.createElement('img');
            img.src = localActual.logo_url;
            img.alt = localActual.nombre;
            logoEl.innerHTML = '';
            logoEl.appendChild(img);
        } else {
            initialEl.textContent = localActual.nombre.charAt(0).toUpperCase();
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
    if (!container) return;
    container.innerHTML = '';
    // Ahora leemos la base de datos, no el config estático
    for (var i = 0; i < garzonesActuales.length; i++) {
        (function(garzon) {
            container.appendChild(createChip(garzon.nombre, function() { selectGarzon(garzon.nombre); }));
        })(garzonesActuales[i]);
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
    for (var i = 0; i < motivosDefault.length; i++) {
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
        })(motivosDefault[i]);
    }
}

// ==========================================
// 5. ENVÍO DE DATOS Y REDIRECCIÓN
// ==========================================
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
        idLocal: localActual.id, // ID extraído de Supabase
        local: localActual.nombre, // Nombre extraído de Supabase
        garzon: selectedGarzon || '',
        rating: selectedRating,
        tipo: 'SOS',
        motivos: selectedMotivos.join(', '),
        comentario: comentario,
        estado: 'enviado',
        telefonoAdministrador: localActual.telefono_admin // Telefono extraído de Supabase
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
        idLocal: localActual.id,
        local: localActual.nombre,
        garzon: selectedGarzon || '',
        rating: selectedRating,
        tipo: 'SEO',
        motivos: '',
        comentario: '',
        estado: 'redirigido_google'
    }).catch(function() {});
    waitingForGoogleMaps = true;
    
    // Asumimos que tienes 'google_maps_url' en la base de datos. Si está vacía, manda a la raíz de Google Maps.
    var mapaUrl = localActual.google_maps_url || 'https://www.google.com/maps'; 
    window.open(mapaUrl, '_blank');
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
    return fetch(MASTER_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).then(function(r) {
        if (!r.ok) throw new Error(r.status);
        return r;
    });
}
