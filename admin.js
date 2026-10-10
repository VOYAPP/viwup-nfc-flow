// 1. Inicializar Supabase (Reemplaza con tus claves)
const supabaseUrl = 'https://syoypjljkwmwlrpuwxwh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b3lwamxqa3dtd2xycHV3eHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MDA1OTgsImV4cCI6MjEwMzA3NjU5OH0.BvGcxpDWYn1uOSScG2GHLEOAcTZWW336FRE0JsWwsRc';
const clienteSupabase = supabase.createClient(supabaseUrl, supabaseKey);

// Variables globales para el buscador y filtros rápidos
let todosLosLocales = [];
let diccionarioAmbassadors = {};

// --- 🔒 SISTEMA DE LOGIN SEGURO CON SUPABASE AUTH ---

window.onload = () => {
    verificarSesionActiva();
};

async function verificarSesionActiva() {
    const { data: { session } } = await clienteSupabase.auth.getSession();
    if (session) {
        document.getElementById('pantalla-login').classList.add('hidden');
        cargarDatosAdmin();
    } else {
        document.getElementById('pantalla-login').classList.remove('hidden');
    }
}

async function iniciarSesionAdmin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorMsg = document.getElementById('login-error');

    const { data, error } = await clienteSupabase.auth.signInWithPassword({
        email: email,
        password: password,
    });

    if (error) {
        errorMsg.textContent = "⚠️ Credenciales incorrectas o acceso no autorizado";
        errorMsg.classList.remove('hidden');
        document.getElementById('login-password').value = '';
    } else {
        errorMsg.classList.add('hidden');
        document.getElementById('pantalla-login').classList.add('hidden');
        cargarDatosAdmin();
    }
}

async function cerrarSesionAdmin() {
    await clienteSupabase.auth.signOut();
    location.reload();
}

// --- MENÚ LATERAL ---
function cambiarSeccion(seccion) {
    document.getElementById('vista-locales').classList.add('hidden');
    document.getElementById('vista-ambassadors').classList.add('hidden');
    document.getElementById('vista-historial').classList.add('hidden');
    
    document.getElementById('btn-tab-locales').className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white font-medium transition-colors";
    document.getElementById('btn-tab-ambassadors').className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white font-medium transition-colors mt-2";
    document.getElementById('btn-tab-historial').className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white font-medium transition-colors mt-2";

    document.getElementById(`vista-${seccion}`).classList.remove('hidden');
    document.getElementById(`btn-tab-${seccion}`).className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#3B82F6] text-white font-semibold transition-colors mt-2";
}

// --- MOTOR PRINCIPAL DE DATOS ---
async function cargarDatosAdmin() {
    try {
        // 1. Traer lista de Ambassadors (Para cruzar IDs con Nombres)
        const { data: ambassadors } = await clienteSupabase.from('ambassadors').select('id, nombre, telefono, email, frecuencia_pago');
        if (ambassadors) {
            ambassadors.forEach(amb => diccionarioAmbassadors[amb.id] = amb);
        }

        // 2. Traer todos los Locales
        const { data: locales, error } = await clienteSupabase
            .from('locales')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        todosLosLocales = locales;
        
        // 3. Procesar datos (KPIs y Bandejas)
        actualizarKPIs(locales);
        renderizarUpgrades(locales.filter(l => l.solicitud_upgrade === true));
        filtrarLocales(); // Dibuja la tabla aplicando filtros actuales

        renderizarAmbassadors();
        renderizarHistorial();

    } catch (err) {
        console.error("Error cargando datos:", err);
        alert("Error cargando la base de datos.");
    }
}

// --- UTILIDADES ---
function calcularAntiguedad(fechaString) {
    const fecha = new Date(fechaString);
    const hoy = new Date();
    const diffTime = Math.abs(hoy - fecha);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 1 ? 'Hace 1 día' : `Hace ${diffDays} días`;
}

// --- ACTUALIZACIÓN DE INTERFAZ ---
function actualizarKPIs(locales) {
    let activos = 0;
    let upgradesPendientes = 0;

    locales.forEach(local => {
        if (local.estatus_comercial === 'activo') activos++;
        if (local.solicitud_upgrade === true) upgradesPendientes++;
    });

    document.getElementById('admin-locales-activos').textContent = activos;
    document.getElementById('admin-mrr').innerHTML = `$${(activos * 20000).toLocaleString('es-CL')} <span class="text-sm text-slate-400 font-medium">CLP</span>`;
    document.getElementById('admin-upgrades-pendientes').textContent = upgradesPendientes;
    document.getElementById('admin-mrr-potencial').textContent = `+$${(upgradesPendientes * 20000).toLocaleString('es-CL')} CLP en espera`;
}

// --- BANDEJA DE UPGRADES (Tarjetas) ---
function renderizarUpgrades(listaUpgrades) {
    const contenedor = document.getElementById('contenedor-upgrades');
    if (listaUpgrades.length === 0) {
        contenedor.innerHTML = `<div class="bg-[#F8FAFC] border border-slate-200 rounded-xl p-4 text-center"><p class="text-sm text-slate-500 font-medium">Todo al día. No hay solicitudes pendientes.</p></div>`;
        return;
    }

    let html = '';
    listaUpgrades.forEach(local => {
        const vendedor = diccionarioAmbassadors[local.ambassador_id] || { nombre: 'Admin', telefono: '' };
        
        // Botón de WhatsApp interno para hablar con el Vendedor
        const btnWaVendedor = vendedor.telefono ? `<a href="https://wa.me/${vendedor.telefono.replace(/\D/g, '')}" target="_blank" class="text-[12px] text-blue-600 hover:underline flex items-center gap-1 mt-1"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.06-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg> Vendedor: ${vendedor.nombre}</a>` : `<p class="text-[12px] text-orange-700/70 mt-1">Vendedor: ${vendedor.nombre}</p>`;

        html += `
            <div class="flex flex-col md:flex-row md:items-center justify-between bg-[#FFF7ED] border border-[#FFEDD5] rounded-xl p-4 gap-4">
                <div>
                    <h3 class="text-[15px] font-bold text-[#C2410C]">${local.nombre}</h3>
                    ${btnWaVendedor}
                </div>
                <div class="flex flex-wrap items-center gap-2">
                    <button onclick="rechazarUpgrade('${local.id}')" class="px-3 py-1.5 bg-white border border-red-200 text-red-600 text-xs font-bold rounded-lg hover:bg-red-50 transition-colors">Rechazar / Error</button>
                    <a href="https://wa.me/${local.telefono_admin.replace(/\D/g, '')}" target="_blank" class="px-3 py-1.5 bg-white border border-[#FFEDD5] text-orange-600 text-xs font-bold rounded-lg hover:bg-orange-50 transition-colors">Contactar Local</a>
                    <button onclick="aprobarUpgrade('${local.id}')" class="px-4 py-1.5 bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold rounded-lg shadow-sm transition-colors">Aprobar y Activar</button>
                </div>
            </div>`;
    });
    contenedor.innerHTML = html;
}

// --- BUSCADOR Y FILTROS EN LA TABLA ---
function filtrarLocales() {
    const texto = document.getElementById('buscador-locales').value.toLowerCase();
    const filtroEstado = document.getElementById('filtro-estado').value;

    const localesFiltrados = todosLosLocales.filter(local => {
        const vendedor = diccionarioAmbassadors[local.ambassador_id] || { nombre: 'Admin' };
        
        // Coincidencia de texto (busca en nombre del local o del vendedor)
        const coincideTexto = local.nombre.toLowerCase().includes(texto) || vendedor.nombre.toLowerCase().includes(texto);
        
        // Coincidencia de estado
        let coincideEstado = true;
        if (filtroEstado === 'activo') coincideEstado = (local.estatus_comercial === 'activo');
        if (filtroEstado === 'upgrade') coincideEstado = (local.solicitud_upgrade === true);
        if (filtroEstado === 'demo') coincideEstado = (local.estatus_comercial !== 'activo' && !local.solicitud_upgrade);

        return coincideTexto && coincideEstado;
    });

    renderizarTabla(localesFiltrados);
}

function renderizarTabla(lista) {
    const tbody = document.getElementById('admin-tabla-locales');
    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-sm text-slate-500">No se encontraron locales.</td></tr>`;
        return;
    }

    let html = '';
    lista.forEach(local => {
        const vendedor = diccionarioAmbassadors[local.ambassador_id] || { nombre: 'Registro Directo / Admin' };
        const fechaFormat = new Date(local.created_at).toLocaleDateString('es-CL');
        const antiguedad = calcularAntiguedad(local.created_at);

        // Estilos de Estado y Alertas
        let estadoUI = '';
        let alertaEstancado = '';
        
        if (local.estatus_comercial === 'activo') {
            estadoUI = `<span class="px-2.5 py-1 rounded-md text-[10px] font-bold bg-[#ECFDF5] text-[#10B981]">ACTIVO</span>`;
        } else if (local.estatus_comercial === 'baja') {
            estadoUI = `<span class="px-2.5 py-1 rounded-md text-[10px] font-bold bg-red-50 text-red-600">DADO DE BAJA</span>`;
        } else if (local.solicitud_upgrade) {
            estadoUI = `<span class="px-2.5 py-1 rounded-md text-[10px] font-bold bg-[#FFF7ED] text-[#EA580C]">UPGRADE PENDIENTE</span>`;
        } else {
            estadoUI = `<span class="px-2.5 py-1 rounded-md text-[10px] font-bold bg-[#F1F5F9] text-[#64748B]">DEMO</span>`;
        }
        
        const btnMaps = local.google_maps_url ? `<a href="${local.google_maps_url}" target="_blank" class="text-blue-500 hover:underline text-[11px] font-medium block mt-1">Ver en Maps ↗</a>` : '';

        html += `
            <tr class="hover:bg-slate-50 transition-colors group">
                <td class="px-6 py-4">
                    <p class="text-[14px] font-bold text-[#0F172A]">${local.nombre}</p>
                    <p class="text-[11px] text-slate-400">Creado: ${fechaFormat}</p>
                    ${btnMaps}
                </td>
                <td class="px-6 py-4">
                    <p class="text-[13px] font-medium text-slate-700">${vendedor.nombre}</p>
                </td>
                <td class="px-6 py-4">
                    ${estadoUI}
                    <p class="text-[11px] text-slate-500 mt-1">${antiguedad}</p>
                    ${alertaEstancado}
                </td>
                <td class="px-6 py-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="abrirEdicionLocal('${local.id}')" class="text-slate-400 hover:text-blue-500 p-2 rounded-lg hover:bg-blue-50 transition-colors" title="Editar Local">✏️
                    </button>
                    <button onclick="darDeBajaLocal('${local.id}')" class="text-slate-400 hover:text-orange-500 p-2 rounded-lg hover:bg-orange-50 transition-colors" title="Dar de Baja">📉
                    </button>
                    <button onclick="eliminarLocal('${local.id}')" class="text-slate-400 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors" title="Eliminar Local">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// --- ACCIONES DE BASE DE DATOS Y TRAZABILIDAD ---

async function registrarAuditoria(localId, accion, detalle) {
    try {
        await clienteSupabase.from('logs_locales').insert([{ local_id: localId, accion: accion, detalle: detalle }]);
    } catch (err) { console.error("Error guardando log", err); }
}

async function aprobarUpgrade(localId) {
    if (!confirm("¿Confirmas que el pago es válido y activarás este local?")) return;
    try {
        await clienteSupabase.from('locales').update({ estatus_comercial: 'activo', solicitud_upgrade: false }).eq('id', localId);
        await registrarAuditoria(localId, 'ACTIVACIÓN', 'El local pasó a estado ACTIVO tras validar el pago.');
        cargarDatosAdmin(); 
    } catch (err) { alert("Error al aprobar."); }
}

async function rechazarUpgrade(localId) {
    if (!confirm("¿Deseas rechazar este Upgrade y devolverlo al estado DEMO?")) return;
    try {
        await clienteSupabase.from('locales').update({ solicitud_upgrade: false }).eq('id', localId);
        await registrarAuditoria(localId, 'RECHAZO UPGRADE', 'Se rechazó la solicitud de upgrade por falta de pago o error.');
        cargarDatosAdmin(); 
    } catch (err) { alert("Error al rechazar."); }
}

async function darDeBajaLocal(localId) {
    if (!confirm("¿Seguro que deseas dar de baja este local? Dejará de sumar comisiones para su vendedor.")) return;
    try {
        await clienteSupabase.from('locales').update({ estatus_comercial: 'baja' }).eq('id', localId);
        await registrarAuditoria(localId, 'BAJA', 'El local fue dado de baja (morosidad o cierre).');
        cargarDatosAdmin();
    } catch (err) { alert("Error al dar de baja."); }
}

async function eliminarLocal(localId) {
    const pass = prompt("Acción destructiva. Escribe 'ELIMINAR' para borrar este local definitivamente:");
    if (pass !== 'ELIMINAR') return;
    try {
        await clienteSupabase.from('locales').delete().eq('id', localId);
        // Al eliminar, Supabase borra sus logs automáticamente por el ON DELETE CASCADE
        cargarDatosAdmin();
    } catch (err) { alert("Error al eliminar."); }
}

// --- EXPORTAR A EXCEL (CSV) ---
function exportarCSV() {
    if(todosLosLocales.length === 0) return alert("No hay datos para exportar");
    
    let csvContent = "data:text/csv;charset=utf-8,Nombre Local,Estado,Fecha Creacion,Vendedor,Telefono Vendedor\n";
    
    todosLosLocales.forEach(local => {
        const v = diccionarioAmbassadors[local.ambassador_id] || { nombre: 'Admin', telefono: '' };
        const row = `"${local.nombre}","${local.estatus_comercial}","${local.created_at}","${v.nombre}","${v.telefono}"`;
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `ViwUp_Locales_${new Date().toLocaleDateString('es-CL')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

}
    
// ==========================================
//        FASE 2: GESTIÓN DE AMBASSADORS
// ==========================================

// 1. Renderizar el Ranking y Comisiones
function renderizarAmbassadors() {
    const tbody = document.getElementById('admin-tabla-ambassadors');
    
    // Convertir el diccionario en un array para poder ordenarlo
    let listaVendedores = Object.values(diccionarioAmbassadors);
    
    // Excluir si existe un registro base de "Admin" (si corresponde)
    listaVendedores = listaVendedores.filter(v => v.nombre.toLowerCase() !== 'admin');

    // Mapear contadores a cada vendedor
    listaVendedores = listaVendedores.map(vendedor => {
        let activos = 0;
        let demos = 0;

        todosLosLocales.forEach(local => {
            if (local.ambassador_id === vendedor.id) {
                if (local.estatus_comercial === 'activo') activos++;
                else demos++;
            }
        });

        // Comisión (Asumimos $10.000 CLP por local activo, ajustable)
        const comision = activos * 10000;

        return { ...vendedor, activos, demos, comision };
    });

    // Ordenar de mayor a menor ventas (Ranking)
    listaVendedores.sort((a, b) => b.activos - a.activos);

    if (listaVendedores.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-sm text-slate-500">No hay vendedores registrados en el equipo.</td></tr>`;
        return;
    }

    let html = '';
    listaVendedores.forEach((vendedor, index) => {
        // Medallas para el Top 3
        let medalla = '';
        if (index === 0) medalla = '🥇';
        else if (index === 1) medalla = '🥈';
        else if (index === 2) medalla = '🥉';
        else medalla = `<span class="text-slate-400 font-bold ml-1">#${index + 1}</span>`;

        const btnWa = vendedor.telefono ? `<a href="https://wa.me/${vendedor.telefono.replace(/\D/g, '')}" target="_blank" class="text-[11px] text-blue-600 hover:underline flex items-center gap-1 mt-1">WhatsApp ↗</a>` : '';
        
        html += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-4">
                    <button onclick="abrirEdicionVendedor('${v.id}')" class="text-slate-400 hover:text-blue-500 p-1.5 rounded-lg hover:bg-blue-50 transition-colors" title="Editar Vendedor">✏️
                    </button>
                    <p class="text-[14px] font-bold text-[#0F172A] flex items-center gap-2">${medalla} ${vendedor.nombre}</p>
                    <p class="text-[11px] text-slate-400">${vendedor.email}</p>
                    ${btnWa}
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#ECFDF5] text-[#10B981] font-bold text-sm border border-[#A7F3D0]">${vendedor.activos}</span>
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold text-sm border border-slate-200">${vendedor.demos}</span>
                </td>
                <td class="px-6 py-4 text-right">
                    <p class="text-[15px] font-extrabold text-[#0F172A]">$${vendedor.comision.toLocaleString('es-CL')}</p>
                    <p class="text-[10px] text-slate-400 uppercase tracking-wide mt-0.5">CLP</p>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}



// 2. Crear (Invitar) un nuevo Ambassador a la base de datos
async function invitarAmbassador(event) {
    event.preventDefault();
    
    const btn = document.getElementById('btn-invitar');
    const txtOriginal = btn.innerHTML;
    
    const nombre = document.getElementById('inv-nombre').value;
    const email = document.getElementById('inv-email').value;
    const telefono = document.getElementById('inv-telefono').value;
    
    // Generamos un PIN temporal de 4 dígitos para que pueda entrar la primera vez
    const pinTemporal = Math.floor(1000 + Math.random() * 9000).toString();

    btn.innerHTML = 'Creando Vendedor...';
    btn.disabled = true;

    try {
        const { error } = await clienteSupabase
            .from('ambassadors')
            .insert([{ 
                nombre: nombre, 
                email: email, 
                telefono: telefono,
                pin: pinTemporal // Se guarda el PIN generado
            }]);

        if (error) throw error;

        // Opcional: Aquí podrías llamar al Webhook de Make que arme el correo de bienvenida.
        alert(`¡Vendedor creado con éxito!\n\nSu PIN de acceso temporal es: ${pinTemporal}\n\nPídele que ingrese y recupere su contraseña si desea cambiarlo.`);
        
        // Limpiar formulario y recargar datos
        document.getElementById('form-invitar').reset();
        cargarDatosAdmin(); // Vuelve a consultar la BD para mostrarlo en la tabla

    } catch (err) {
        console.error("Error al crear:", err);
        alert("Hubo un error al registrar al vendedor. Asegúrate de que el correo no esté duplicado.");
    } finally {
        btn.innerHTML = txtOriginal;
        btn.disabled = false;
    }

}

// ==========================================
//        FASE 3: AUDITORÍA E HISTORIAL
// ==========================================

function renderizarHistorial() {
    const tbody = document.getElementById('admin-tabla-historial');
    // Filtramos solo los locales que están activos (activaciones pasadas/aprobadas)
    const localesActivos = todosLosLocales.filter(l => l.estatus_comercial === 'activo');

    if (localesActivos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-sm text-slate-500">No hay historial de activaciones aún.</td></tr>`;
        return;
    }

    let html = '';
    localesActivos.forEach(local => {
        const vendedor = diccionarioAmbassadors[local.ambassador_id] || { nombre: 'Registro Directo / Admin' };
        const fechaFormat = new Date(local.created_at).toLocaleDateString('es-CL');

        html += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-4">
                    <p class="text-[14px] font-bold text-[#0F172A]">${local.nombre}</p>
                    <p class="text-[11px] text-slate-400">Desde: ${fechaFormat}</p>
                </td>
                <td class="px-6 py-4">
                    <p class="text-[13px] font-medium text-slate-700">${vendedor.nombre}</p>
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-[#ECFDF5] text-[#10B981]">
                        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path></svg>
                        Pago Validado
                    </span>
                </td>
                <td class="px-6 py-4 text-right">
                    <p class="text-[14px] font-extrabold text-[#10B981]">+$10.000</p>
                    <p class="text-[10px] text-slate-400 uppercase tracking-wide">CLP / Mes</p>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

function exportarHistorialCSV() {
    const localesActivos = todosLosLocales.filter(l => l.estatus_comercial === 'activo');
    if(localesActivos.length === 0) return alert("No hay pagos registrados para exportar.");
    
    let csvContent = "data:text/csv;charset=utf-8,Fecha,Local,Vendedor Responsable,Estado,Ingreso Mensual (CLP)\n";
    
    localesActivos.forEach(local => {
        const v = diccionarioAmbassadors[local.ambassador_id] || { nombre: 'Admin' };
        const fecha = new Date(local.created_at).toLocaleDateString('es-CL');
        const row = `"${fecha}","${local.nombre}","${v.nombre}","Pago Validado","10000"`;
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Auditoria_Pagos_ViwUp_${new Date().toLocaleDateString('es-CL')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- FUNCIONES DE PAGOS A VENDEDORES ---

// Variable global para buscar los pagos al abrir el recibo
let todosLosPagos = [];

async function cargarHistorialPagos() {
    try {
        const { data: pagos, error } = await clienteSupabase
            .from('pagos_ambassadors')
            .select('*')
            .order('mes', { ascending: false });

        if (error) throw error;
        todosLosPagos = pagos; // Guardamos en memoria
        renderizarTablaPagos(pagos);
    } catch (err) {
        console.error("Error cargando pagos:", err);
    }
}

function renderizarTablaPagos(pagos) {
    const tbody = document.getElementById('admin-tabla-pagos');
    if (!pagos || pagos.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-sm text-slate-500">No hay pagos registrados.</td></tr>`;
        return;
    }

    let html = '';
    pagos.forEach(pago => {
        const vendedor = diccionarioAmbassadors[pago.ambassador_id] || { nombre: 'Desconocido' };
        html += `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-4 font-bold text-slate-700">${pago.mes}</td>
                <td class="px-6 py-4 text-[13px] font-medium">${vendedor.nombre}</td>
                <td class="px-6 py-4 text-right font-extrabold text-[#10B981]">$${pago.monto.toLocaleString('es-CL')} CLP</td>
                <td class="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                    <a href="${pago.comprobante_url}" target="_blank" class="inline-flex items-center gap-1 px-2 py-1.5 rounded text-[11px] font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors" title="Ver Link Original">Drive ↗</a>
                    <button onclick="abrirLiquidacion('${pago.id}')" class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-800 text-white hover:bg-slate-700 transition-colors shadow-sm">
                        Generar Liquidación
                    </button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

// Lógica del Modal del Recibo
function abrirLiquidacion(idPago) {
    const pago = todosLosPagos.find(p => p.id === idPago);
    if (!pago) return;

    const vendedor = diccionarioAmbassadors[pago.ambassador_id] || { nombre: 'Desconocido' };
    const fechaFormat = new Date(pago.created_at).toLocaleDateString('es-CL');

    // Llenamos los datos en el HTML
    document.getElementById('liq-id').textContent = pago.id.split('-')[0].toUpperCase(); // Código corto
    document.getElementById('liq-nombre').textContent = vendedor.nombre;
    document.getElementById('liq-mes').textContent = pago.mes;
    document.getElementById('liq-fecha').textContent = fechaFormat;
    document.getElementById('liq-monto').textContent = `$${pago.monto.toLocaleString('es-CL')}`;

    // Mostramos el modal
    document.getElementById('modal-liquidacion').classList.remove('hidden');
}

function cerrarLiquidacion() {
    document.getElementById('modal-liquidacion').classList.add('hidden');
}

function imprimirLiquidacion() {
    window.print();
}

async function registrarPago(event) {
    event.preventDefault();
    const btn = document.getElementById('btn-guardar-pago');
    btn.disabled = true;
    btn.innerHTML = 'Subiendo comprobante...';

    const pAmbassador = document.getElementById('pago-ambassador').value;
    const pMes = document.getElementById('pago-mes').value;
    const pMonto = document.getElementById('pago-monto').value;
    const archivoInput = document.getElementById('pago-archivo');
    const archivo = archivoInput.files[0];

    if (!archivo) {
        alert("Por favor selecciona un archivo de comprobante.");
        btn.disabled = false;
        btn.innerHTML = 'Guardar Pago';
        return;
    }

    try {
        // 1. Crear un nombre único para el archivo basado en la fecha
        const ext = archivo.name.split('.').pop();
        const nombreArchivo = `${pAmbassador}_${pMes}_${Date.now()}.${ext}`;

        // 2. Subir el archivo al bucket "comprobantes"
        const { data: uploadData, error: uploadError } = await clienteSupabase
            .storage
            .from('comprobantes')
            .upload(nombreArchivo, archivo, { cacheControl: '3600', upsert: true });

        if (uploadError) throw uploadError;

        // 3. Obtener la URL pública del archivo subido
        const { data: publicUrlData } = clienteSupabase
            .storage
            .from('comprobantes')
            .getPublicUrl(nombreArchivo);

        const comprobanteUrl = publicUrlData.publicUrl;

        // 4. Guardar el registro en la base de datos
        const { error: dbError } = await clienteSupabase
            .from('pagos_ambassadors')
            .insert([{
                ambassador_id: pAmbassador,
                mes: pMes,
                monto: pMonto,
                comprobante_url: comprobanteUrl
            }]);

        if (dbError) throw dbError;

        alert("¡Pago y comprobante guardados exitosamente!");
        document.getElementById('form-pago').reset();
        cargarHistorialPagos(); // Recargar la tabla
    } catch (err) {
        console.error("Error al registrar pago:", err);
        alert("Hubo un error al subir el comprobante o guardar el pago. Revisa la consola.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Guardar Pago';
    }
}

// AUTO-CALCULAR MONTO DE PAGO
document.getElementById('pago-ambassador').addEventListener('change', (e) => {
    const ambassadorId = e.target.value;
    if (!ambassadorId) {
        document.getElementById('pago-monto').value = '';
        return;
    }
    
    // Contar cuántos locales activos tiene ese vendedor
    let activos = 0;
    todosLosLocales.forEach(local => {
        if (local.ambassador_id === ambassadorId && local.estatus_comercial === 'activo') {
            activos++;
        }
    });
    
    // Sugerir monto ($10.000 por local activo)
    document.getElementById('pago-monto').value = activos * 10000;
});
