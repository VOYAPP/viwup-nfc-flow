// 1. Inicializar Supabase
const supabaseUrl = 'https://syoypjljkwmwlrpuwxwh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b3lwamxqa3dtd2xycHV3eHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MDA1OTgsImV4cCI6MjEwMzA3NjU5OH0.BvGcxpDWYn1uOSScG2GHLEOAcTZWW336FRE0JsWwsRc';
const clienteSupabase = supabase.createClient(supabaseUrl, supabaseKey);

// 2. Obtener Token de la URL
const urlParams = new URLSearchParams(window.location.search);
const tokenAcceso = urlParams.get('token');
let ambassadorActual = null;

// 3. Autenticar y Cargar Datos
async function iniciarPanel() {
    if (!tokenAcceso) {
        document.body.innerHTML = '<h1>Acceso Denegado: Falta token de acceso.</h1>';
        return;
    }

    // Buscar al vendedor
    const { data: ambassador, error } = await clienteSupabase
        .from('ambassadors')
        .select('*')
        .eq('token_acceso', tokenAcceso)
        .single();
        
    if (error || !ambassador) {
        document.body.innerHTML = '<h1>Acceso Denegado: Token inválido.</h1>';
        return;
    }
    
    ambassadorActual = ambassador;
    document.getElementById('nombre-vendedor').textContent = ambassador.nombre;
    
    // Cargar la lista de locales
    cargarLocales();
}

// 4. Leer Locales y Calcular Ganancias
async function cargarLocales() {
    const { data: locales, error } = await clienteSupabase
        .from('locales')
        .select('*')
        .eq('ambassador_id', ambassadorActual.id);
        
    if (error) return console.error("Error cargando locales:", error);

    let activos = 0;
    let htmlTabla = '';

    locales.forEach(local => {
        if(local.estatus_comercial === 'activo') activos++;
        
        // 1. Limpiar el teléfono para el link de WhatsApp (quitar espacios o caracteres raros)
        const numeroLimpio = local.telefono_admin.replace(/\D/g, '');
        const btnWhatsApp = `<a href="https://wa.me/${numeroLimpio}" target="_blank" style="margin-left: 10px; text-decoration: none;">💬 WA</a>`;
        
        // 2. Lógica del botón de Upgrade
        let botonAccion = '';
        if (local.estatus_comercial === 'demo') {
            if (local.solicitud_upgrade) {
                botonAccion = `<span style="color: orange;">⏳ Upgrade Solicitado</span>`;
            } else {
                botonAccion = `<button onclick="solicitarUpgrade('${local.id}')">Solicitar Upgrade</button>`;
            }
        } else {
            botonAccion = `<span style="color: green;">Activo</span>`;
        }

        htmlTabla += `
            <tr>
                <td>${local.nombre} ${btnWhatsApp}</td>
                <td>${local.estatus_comercial.toUpperCase()}</td>
                <td>${botonAccion}</td>
            </tr>
        `;
    });

    document.getElementById('tabla-locales').innerHTML = htmlTabla;
    document.getElementById('locales-activos').textContent = activos;
    document.getElementById('mrr-total').textContent = `$${(activos * 10000).toLocaleString('es-CL')} CLP`; 
}

// 5. Registrar Nueva Demo
async function registrarNuevaDemo(event) {
    event.preventDefault();
    
    // Capturar inputs básicos
    const nombreLocal = document.getElementById('input-nombre-local').value.trim();
    const adminTelefono = document.getElementById('input-telefono').value.trim();
    const slugLocal = document.getElementById('input-slug').value.trim().toLowerCase();
    const googleMapsUrl = document.getElementById('input-google-maps').value.trim();
    const logoUrl = document.getElementById('input-logo').value.trim() || null;
    const bgUrl = document.getElementById('input-bg').value.trim() || null;
    
    // Capturar todos los garzones ingresados
    const inputsGarzones = document.querySelectorAll('.input-garzon');
    const listaGarzones = Array.from(inputsGarzones).map(input => input.value.trim()).filter(val => val !== "");

    try {
        // 1. Insertar el local y pedirle a Supabase que nos devuelva el ID creado (.select())
        const { data: localCreado, error: errorLocal } = await clienteSupabase
            .from('locales')
            .insert([{
                nombre: nombreLocal,
                telefono_admin: adminTelefono,
                slug: slugLocal,
                google_maps_url: googleMapsUrl,
                logo_url: logoUrl,
                bg_imagen_url: bgUrl,
                estado_activo: false,
                estatus_comercial: 'demo',
                ambassador_id: ambassadorActual.id
            }])
            .select();

        if (errorLocal) throw errorLocal;
        
        const nuevoLocalId = localCreado[0].id;

        // 2. Insertar los garzones asociados a ese nuevo local
        if (listaGarzones.length > 0) {
            const garzonesAInsertar = listaGarzones.map(nombre => ({
                local_id: nuevoLocalId,
                nombre: nombre
            }));
            
            const { error: errorGarzones } = await clienteSupabase
                .from('garzones')
                .insert(garzonesAInsertar);
                
            if (errorGarzones) console.error("Error insertando garzones:", errorGarzones);
        }

        alert('¡Demo y garzones creados con éxito!');
        document.getElementById('form-demo').reset();
        toggleFormularioDemo(); // Ocultar el formulario de nuevo
        cargarLocales();

    } catch (err) {
        alert("Hubo un error al registrar el local. Verifica que el enlace (slug) no exista ya.");
        console.error(err);
    }
}

// 6. Botón: De Demo a Cliente de Pago
async function transformarACliente(localId) {
    if (!confirm("¿Confirmas que este local pagó y ahora es un cliente activo?")) return;

    try {
        const { error } = await clienteSupabase
            .from('locales')
            .update({ 
                estado_activo: true, 
                estatus_comercial: 'activo' 
            })
            .eq('id', localId);

        if (error) throw error;

        alert('¡Local convertido a cliente! Ahora generará comisión.');
        cargarLocales();

    } catch (err) {
        alert("Error al actualizar el estado.");
    }
}

// --- NUEVAS FUNCIONES PARA LA INTERFAZ ---

function toggleFormularioDemo() {
    const form = document.getElementById('seccion-demo');
    const btn = document.getElementById('btn-toggle-demo');
    if (form.style.display === 'none') {
        form.style.display = 'block';
        btn.textContent = 'Ocultar Formulario';
    } else {
        form.style.display = 'none';
        btn.textContent = '+ Ingresar Demo';
    }
}

let contadorGarzones = 1;
function agregarInputGarzon() {
    contadorGarzones++;
    const contenedor = document.getElementById('contenedor-garzones');
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input-garzon';
    input.placeholder = `Nombre del Garzón ${contadorGarzones}`;
    input.required = true;
    input.style.display = 'block';
    input.style.marginBottom = '5px';
    contenedor.appendChild(input);
}

// --- NUEVA FUNCIÓN PARA SOLICITAR UPGRADE ---
async function solicitarUpgrade(localId) {
    if (!confirm("¿Confirmas que este local ya pagó y deseas solicitar su activación oficial?")) return;

    try {
        // En lugar de activarlo, cambiamos la bandera 'solicitud_upgrade' a true
        const { error } = await clienteSupabase
            .from('locales')
            .update({ solicitud_upgrade: true })
            .eq('id', localId);

        if (error) throw error;

        alert('Solicitud enviada al administrador. El local se activará pronto.');
        cargarLocales(); // Refrescará la tabla y mostrará "⏳ Upgrade Solicitado"

    } catch (err) {
        alert("Error al enviar la solicitud.");
        console.error(err);
    }
}

// Iniciar sistema al cargar la página
window.onload = iniciarPanel;
