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
        
        // 1. Botón WhatsApp Estilizado (Icono verde)
        const numeroLimpio = local.telefono_admin.replace(/\D/g, '');
        const btnWhatsApp = `<a href="https://wa.me/${numeroLimpio}" target="_blank" class="inline-flex items-center justify-center bg-[#25D366] hover:bg-[#1DA851] text-white p-1.5 rounded-md transition-colors ml-3" title="Chat Admin">
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
        </a>`;
        
        // 2. Lógica visual de Estados y Botones
        let estadoBadge = '';
        let botonAccion = '';

        if (local.estatus_comercial === 'demo') {
            estadoBadge = `<span class="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#F1F5F9] text-[#64748B]">DEMO</span>`;
            if (local.solicitud_upgrade) {
                botonAccion = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#FFF7ED] text-[#EA580C]"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Upgrade Solicitado</span>`;
            } else {
                botonAccion = `<button onclick="solicitarUpgrade('${local.id}')" class="px-3 py-1.5 bg-white border border-slate-200 text-[#0F172A] text-[12px] font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-sm">Solicitar Upgrade</button>`;
            }
        } else {
            estadoBadge = `<span class="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#ECFDF5] text-[#10B981]">ACTIVO</span>`;
            botonAccion = `<span class="text-[12px] font-bold text-[#10B981]">Generando Comisión</span>`;
        }

        // 3. Fila de la tabla con Tailwind
        htmlTabla += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-4">
                    <div class="flex items-center">
                        <span class="text-[14px] text-[#0F172A] font-semibold">${local.nombre}</span>
                        ${btnWhatsApp}
                    </div>
                </td>
                <td class="px-6 py-4">${estadoBadge}</td>
                <td class="px-6 py-4 text-right">${botonAccion}</td>
            </tr>
        `;
    });

    // Actualizar DOM
    document.getElementById('tabla-locales').innerHTML = htmlTabla;
    document.getElementById('locales-activos').textContent = activos;
    document.getElementById('mrr-total').innerHTML = `$${(activos * 10000).toLocaleString('es-CL')} <span class="text-lg text-slate-400 font-medium">CLP</span>`; 
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
                estado_activo: true,
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
    // Clases CSS de Tailwind para que coincida con el input original
    input.className = 'input-garzon appearance-none bg-[#F8FAFC] border border-slate-200 text-[#0F172A] text-[13px] font-medium rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-[#3B82F6] outline-none transition-all';
    input.placeholder = `Nombre del Garzón ${contadorGarzones}`;
    input.required = true;
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
