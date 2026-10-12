// 1. Inicializar Supabase
const supabaseUrl = 'https://syoypjljkwmwlrpuwxwh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b3lwamxqa3dtd2xycHV3eHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MDA1OTgsImV4cCI6MjEwMzA3NjU5OH0.BvGcxpDWYn1uOSScG2GHLEOAcTZWW336FRE0JsWwsRc';
const clienteSupabase = supabase.createClient(supabaseUrl, supabaseKey);

let ambassadorActual = null;

// 2. Comprobar sesión al cargar la página
window.onload = () => {
    const tokenGuardado = localStorage.getItem('viwup_ambassador_session');
    if (tokenGuardado) {
        validarToken(tokenGuardado);
    }
};

let emailTemporal = "";

// 3. PASO 1: Verificar el Correo
async function verificarEmail(event) {
    event.preventDefault();
    const emailInput = document.getElementById('login-email').value.trim().toLowerCase();
    const btn = event.target.querySelector('button');
    btn.textContent = 'Buscando...';
    btn.disabled = true;

    try {
        const { data: ambassador, error } = await clienteSupabase
            .from('ambassadors')
            .select('*')
            .eq('email', emailInput)
            .single();

        if (error || !ambassador) {
            alert('Este correo no está registrado. Contacta a soporte.');
            btn.textContent = 'Continuar';
            btn.disabled = false;
            return;
        }

        emailTemporal = emailInput;
        ambassadorActual = ambassador;
        
        // Ocultar vista de correo
        document.getElementById('step-email').classList.add('hidden');

        // LÓGICA DE DECISIÓN:
        if (!ambassador.pin) {
            // Es NUEVO: No tiene PIN
            document.getElementById('login-title').textContent = 'Crear PIN';
            document.getElementById('login-subtitle').textContent = 'Configura tu acceso de seguridad';
            document.getElementById('step-create-pin').classList.remove('hidden');
            document.getElementById('new-pin').focus();
        } else {
            // YA EXISTE: Tiene PIN
            document.getElementById('login-title').textContent = 'Ingresar PIN';
            document.getElementById('login-subtitle').textContent = 'Bienvenido de vuelta';
            document.getElementById('display-email-login').textContent = emailTemporal;
            document.getElementById('step-enter-pin').classList.remove('hidden');
            document.getElementById('login-pin').focus();
        }

    } catch (err) {
        alert('Error de conexión.');
    } finally {
        btn.textContent = 'Continuar';
        btn.disabled = false;
    }
}

// 4. PASO 2A: Validar PIN existente
async function iniciarSesion(event) {
    event.preventDefault();
    const pinIngresado = document.getElementById('login-pin').value;
    const btn = event.target.querySelector('button');
    
    btn.textContent = 'Verificando...';
    btn.disabled = true;

    // Chequeamos contra la BD para mayor seguridad
    const { data: ambassadorValido } = await clienteSupabase
        .from('ambassadors')
        .select('*')
        .eq('email', emailTemporal)
        .eq('pin', pinIngresado)
        .single();

    if (ambassadorValido) {
        localStorage.setItem('viwup_ambassador_session', ambassadorValido.token_acceso);
        ingresarAlPanel(ambassadorValido);
    } else {
        alert('PIN incorrecto. Intenta nuevamente.');
        btn.textContent = 'Entrar al Panel';
        btn.disabled = false;
    }
}

// --- FUNCIONES PARA RECUPERAR PIN ---

function mostrarRecuperarPin() {
    document.getElementById('step-enter-pin').classList.add('hidden');
    document.getElementById('login-title').textContent = 'Recuperar PIN';
    document.getElementById('login-subtitle').textContent = 'Te ayudaremos a entrar de nuevo';
    document.getElementById('recover-email-display').textContent = emailTemporal;
    document.getElementById('step-recover-pin').classList.remove('hidden');
}

function volverAlLogin() {
    document.getElementById('step-recover-pin').classList.add('hidden');
    document.getElementById('login-title').textContent = 'Ingresar PIN';
    document.getElementById('login-subtitle').textContent = 'Bienvenido de vuelta';
    document.getElementById('step-enter-pin').classList.remove('hidden');
}

async function enviarCorreoRecuperacion() {
    const btn = document.querySelector('#step-recover-pin button');
    const textoOriginal = btn.textContent;
    btn.textContent = 'Enviando correo...';
    btn.disabled = true;

    try {
        // Enviar la alerta silenciosa a Make
        const makeWebhookUrl = 'https://hook.us2.make.com/9ggnync534fjio9bc09f99ujao3a3h5d'; 

        await fetch(makeWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailTemporal })
        });

        alert('¡Código enviado! Revisa tu bandeja de entrada o la carpeta de SPAM. A continuación, te pediremos ese código para crear tu nuevo PIN.');
        volverAlLogin();
        
    } catch (err) {
        alert('Hubo un error al intentar enviar el correo. Verifica tu conexión.');
    } finally {
        btn.textContent = textoOriginal;
        btn.disabled = false;
    }
}

// 5. PASO 2B: Crear y Guardar el nuevo PIN
async function crearNuevoPin(event) {
    event.preventDefault();
    const pin1 = document.getElementById('new-pin').value;
    const pin2 = document.getElementById('confirm-pin').value;
    const btn = event.target.querySelector('button');

    if (pin1 !== pin2) {
        alert('Los códigos no coinciden. Intenta de nuevo.');
        return;
    }

    btn.textContent = 'Guardando...';
    btn.disabled = true;

    try {
        // Guarda el nuevo PIN en Supabase
        const { error } = await clienteSupabase
            .from('ambassadors')
            .update({ pin: pin1 })
            .eq('email', emailTemporal);

        if (error) throw error;

        // Actualizamos localmente y entramos
        ambassadorActual.pin = pin1;
        localStorage.setItem('viwup_ambassador_session', ambassadorActual.token_acceso);
        ingresarAlPanel(ambassadorActual);

    } catch (err) {
        alert('Hubo un problema guardando tu PIN. Verifica tu conexión.');
        btn.textContent = 'Guardar PIN y Entrar';
        btn.disabled = false;
    }
}

// Función auxiliar para volver atrás
function volverAlCorreo() {
    document.getElementById('step-enter-pin').classList.add('hidden');
    document.getElementById('step-create-pin').classList.add('hidden');
    document.getElementById('step-email').classList.remove('hidden');
    
    document.getElementById('login-title').textContent = 'Portal Ambassador';
    document.getElementById('login-subtitle').textContent = 'Ingresa tu correo para continuar';
    
    document.getElementById('login-pin').value = '';
    document.getElementById('new-pin').value = '';
    document.getElementById('confirm-pin').value = '';
}

// 6. Validar Sesión Guardada (Auto-Login)
async function validarToken(token) {
    const { data: ambassador, error } = await clienteSupabase
        .from('ambassadors')
        .select('*')
        .eq('token_acceso', token)
        .single();
        
    if (ambassador) {
        ingresarAlPanel(ambassador);
    } else {
        localStorage.removeItem('viwup_ambassador_session'); // Token inválido o borrado
    }
}

// 7. Función que muestra el Dashboard
function ingresarAlPanel(ambassador) {
    ambassadorActual = ambassador;
    
    // Cambiar las vistas
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display = 'block';
    
    // Actualizar UI con datos del usuario
    document.getElementById('nombre-vendedor').textContent = ambassador.nombre;
    document.getElementById('inicial-vendedor').textContent = ambassador.nombre.charAt(0).toUpperCase();

    // Cargar sus ventas
    cargarLocales();
}

// 8. Cerrar Sesión
function cerrarSesion() {
    localStorage.removeItem('viwup_ambassador_session');
    location.reload(); // Recarga la página y vuelve a mostrar el login
}

// 9. Leer Locales y Calcular Ganancias y Comisiones
async function cargarLocales() {
    const { data: locales, error } = await clienteSupabase
        .from('locales')
        .select('*')
        .eq('ambassador_id', ambassadorActual.id);
        
    if (error) return console.error("Error cargando locales:", error);

    let activosCount = 0;
    let bonosTotal = 0;
    let recurrenteTotal = 0;
    let htmlTabla = '';
    const hoy = new Date();

    const VALOR_BASE_SUSCRIPCION = 29900;
    const BONO_ACTIVACION = 10000;

    // Contar cuántos locales están Activos comercialmente para definir la escala (25%, 30%, 35%)
    const localesActivosList = locales.filter(l => l.estatus_comercial && l.estatus_comercial.toLowerCase() === 'activo');
    activosCount = localesActivosList.length;

    // Definir porcentaje de comisión según el volumen de activos
    let porcentajeComision = 0.25; // 1 a 5 locales
    if (activosCount >= 6 && activosCount <= 10) porcentajeComision = 0.30; // 6 a 10 locales
    if (activosCount > 10) porcentajeComision = 0.35; // 10+ locales
    let porcTexto = `${Math.round(porcentajeComision * 100)}%`;

    locales.forEach(local => {
        const estatus = local.estatus_comercial ? local.estatus_comercial.toLowerCase() : 'demo';
        const esActivo = estatus === 'activo';
        
        if (esActivo) {
            // Validar si tiene fecha_contratacion para el bono de activación (primeros 30 días)
            if (local.fecha_contratacion) {
                const fechaContratacion = new Date(local.fecha_contratacion);
                const diasDiff = (hoy - fechaContratacion) / (1000 * 60 * 60 * 24);
                
                // Si lleva 30 días o menos desde su contratación/activación, aplica el bono de $10.000
                if (diasDiff <= 30) {
                    bonosTotal += BONO_ACTIVACION; 
                } else {
                    // Si ya pasaron más de 30 días, pasa a comisión recurrente escalonada
                    recurrenteTotal += (VALOR_BASE_SUSCRIPCION * porcentajeComision); 
                }
            } else {
                // Si está activo pero no tiene fecha registrada, por seguridad va a recurrente
                recurrenteTotal += (VALOR_BASE_SUSCRIPCION * porcentajeComision);
            }
        }
        
        // Botón WhatsApp
        const numeroLimpio = local.telefono_admin ? local.telefono_admin.replace(/\D/g, '') : '';
        const btnWhatsApp = numeroLimpio ? `<a href="https://wa.me/${numeroLimpio}" target="_blank" class="inline-flex items-center justify-center bg-[#25D366] hover:bg-[#1DA851] text-white p-1.5 rounded-md transition-colors ml-3" title="Chat Admin">
            <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
        </a>` : '';
        
        let estadoBadge = '';
        let botonAccion = '';

        if (estatus === 'demo') {
            estadoBadge = `<span class="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#F1F5F9] text-[#64748B]">DEMO</span>`;
            if (local.solicitud_upgrade) {
                botonAccion = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#FFF7ED] text-[#EA580C]"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Upgrade Solicitado</span>`;
            } else {
                botonAccion = `<button onclick="solicitarUpgrade('${local.id}')" class="px-3 py-1.5 bg-white border border-slate-200 text-[#0F172A] text-[12px] font-semibold rounded-lg hover:bg-slate-50 transition-colors shadow-sm">Solicitar Upgrade</button>`;
            }
        } else if (estatus === 'activo') {
            estadoBadge = `<span class="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#ECFDF5] text-[#10B981]">ACTIVO</span>`;
            botonAccion = `<span class="text-[12px] font-bold text-[#10B981]">Generando Comisión</span>`;
        } else {
            estadoBadge = `<span class="px-2.5 py-1 rounded-md text-[11px] font-bold bg-red-50 text-red-600">BAJA</span>`;
            botonAccion = `<span class="text-[12px] font-bold text-slate-400">Inactivo</span>`;
        }

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

    // Calcular el total bruto del periodo (Bonos + Comisiones Recurrentes)
    let totalBrutoPeriodo = bonosTotal + recurrenteTotal;
    const modalidad = ambassadorActual.modalidad_pago || 'mensual';

    if (modalidad === 'bisemanal') {
        totalBrutoPeriodo = totalBrutoPeriodo / 2;
    }

    // Actualizar las tarjetas visuales en el DOM
    document.getElementById('tabla-locales').innerHTML = htmlTabla;
    document.getElementById('locales-activos').textContent = activosCount;
    document.getElementById('amb-porcentaje-comision').textContent = `Comisión actual: ${porcTexto}`;
    document.getElementById('amb-total-bonos').innerHTML = `$${bonosTotal.toLocaleString('es-CL')} <span class="text-lg text-slate-400 font-medium">CLP</span>`;
    document.getElementById('mrr-total').innerHTML = `$${Math.round(totalBrutoPeriodo).toLocaleString('es-CL')} <span class="text-lg text-slate-400 font-medium">CLP</span>`; 

    cargarHistorialPagosAmbassador();
}

// 10. Registrar Nueva Demo
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

// 11. Botón: De Demo a Cliente de Pago
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
window.iniciarPanel = function() {
      // Código de inicialización de tu panel o lógica necesaria
      console.log("Panel iniciado correctamente");
}

// Función para poblar la tabla inferior de historial de pagos
function cargarHistorialPagosAmbassador() {
    const tbody = document.getElementById('tabla-historial-pagos');
    if (!tbody) return;

    // Aquí puedes conectar posteriormente con una tabla 'pagos_embajadores' si deseas persistencia.
    // Por ahora mostramos una estructura limpia de ejemplo basada en su modalidad:
    const modalidadTexto = (ambassadorActual.modalidad_pago || 'mensual').toUpperCase();

    tbody.innerHTML = `
        <tr>
            <td class="px-6 py-4 font-medium text-[#0F172A]">Ciclo Actual (Corte 28)</td>
            <td class="px-6 py-4"><span class="px-2 py-1 bg-blue-50 text-blue-700 rounded text-[10px] font-bold">${modalidadTexto}</span></td>
            <td class="px-6 py-4 text-slate-600">Calculado en base a cartera activa</td>
            <td class="px-6 py-4 font-bold text-[#0F172A]">En proceso</td>
            <td class="px-6 py-4 text-right">
                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-600">Pendiente de Corte</span>
            </td>
        </tr>
    `;
}
