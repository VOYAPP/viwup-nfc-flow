// 1. Inicializar Supabase (Reemplaza con tus claves)
const supabaseUrl = 'https://syoypjljkwmwlrpuwxwh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b3lwamxqa3dtd2xycHV3eHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MDA1OTgsImV4cCI6MjEwMzA3NjU5OH0.BvGcxpDWYn1uOSScG2GHLEOAcTZWW336FRE0JsWwsRc';
const clienteSupabase = supabase.createClient(supabaseUrl, supabaseKey);

// Al cargar la página
window.onload = () => {
    cargarDatosAdmin();
};

// 2. Control del Menú Lateral (Pestañas)
function cambiarSeccion(seccion) {
    // Ocultar todas las vistas
    document.getElementById('vista-locales').classList.add('hidden');
    document.getElementById('vista-ambassadors').classList.add('hidden');
    
    // Quitar estilos activos de los botones del menú
    const btnLocales = document.getElementById('btn-tab-locales');
    const btnAmbassadors = document.getElementById('btn-tab-ambassadors');
    
    btnLocales.className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white font-medium transition-colors";
    btnAmbassadors.className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white font-medium transition-colors";

    // Activar la vista y el botón seleccionado
    document.getElementById(`vista-${seccion}`).classList.remove('hidden');
    document.getElementById(`btn-tab-${seccion}`).className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#3B82F6] text-white font-semibold transition-colors";
}

// 3. Motor Principal: Cargar Locales y Solicitudes
async function cargarDatosAdmin() {
    try {
        // Obtenemos todos los locales sin filtro (Vista Administrador)
        const { data: locales, error } = await clienteSupabase
            .from('locales')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        let activos = 0;
        let upgradesPendientes = [];
        let htmlTabla = '';

        locales.forEach(local => {
            // Contadores para KPIs
            if (local.estatus_comercial === 'activo') activos++;
            if (local.solicitud_upgrade === true) upgradesPendientes.push(local);

            // Estilos de la tabla general
            let estadoUI = '';
            if (local.estatus_comercial === 'activo') {
                estadoUI = `<span class="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#ECFDF5] text-[#10B981]">ACTIVO</span>`;
            } else if (local.solicitud_upgrade) {
                estadoUI = `<span class="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#FFF7ED] text-[#EA580C]">UPGRADE PENDIENTE</span>`;
            } else {
                estadoUI = `<span class="px-2.5 py-1 rounded-md text-[11px] font-bold bg-[#F1F5F9] text-[#64748B]">DEMO</span>`;
            }

            // Enlace de Google Maps
            const btnMaps = local.google_maps_url ? `<a href="${local.google_maps_url}" target="_blank" class="text-blue-500 hover:underline text-[11px] font-medium ml-2">Ver Maps ↗</a>` : '';

            htmlTabla += `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="px-6 py-4">
                        <p class="text-[14px] font-semibold text-[#0F172A]">${local.nombre}</p>
                        ${btnMaps}
                    </td>
                    <td class="px-6 py-4 text-[13px] text-slate-500">ID: ${local.ambassador_id ? local.ambassador_id.substring(0,8) : 'Admin'}...</td>
                    <td class="px-6 py-4 text-right">${estadoUI}</td>
                </tr>
            `;
        });

        // Actualizar KPIs Globales
        document.getElementById('admin-locales-activos').textContent = activos;
        document.getElementById('admin-mrr').innerHTML = `$${(activos * 10000).toLocaleString('es-CL')} <span class="text-sm text-slate-400 font-medium">CLP</span>`;
        document.getElementById('admin-upgrades-pendientes').textContent = upgradesPendientes.length;

        // Inyectar Tabla General
        document.getElementById('admin-tabla-locales').innerHTML = htmlTabla || '<tr><td colspan="3" class="text-center py-6 text-slate-500">No hay locales registrados.</td></tr>';

        // Procesar Bandeja de Solicitudes (Tarjetas de Acción)
        renderizarUpgrades(upgradesPendientes);

    } catch (err) {
        console.error("Error cargando panel admin:", err);
        alert("Error cargando la base de datos.");
    }
}

// 4. Renderizar las tarjetas amarillas de Upgrade
function renderizarUpgrades(listaUpgrades) {
    const contenedor = document.getElementById('contenedor-upgrades');
    
    if (listaUpgrades.length === 0) {
        contenedor.innerHTML = `
            <div class="bg-[#F8FAFC] border border-slate-200 rounded-xl p-4 text-center">
                <p class="text-sm text-slate-500 font-medium">Todo al día. No hay solicitudes pendientes de cobro.</p>
            </div>`;
        return;
    }

    let htmlUpgrades = '';
    listaUpgrades.forEach(local => {
        htmlUpgrades += `
            <div class="flex items-center justify-between bg-[#FFF7ED] border border-[#FFEDD5] rounded-xl p-4">
                <div>
                    <h3 class="text-[15px] font-bold text-[#C2410C]">${local.nombre}</h3>
                    <p class="text-[12px] text-orange-700/70 mt-0.5">Vendedor ID: ${local.ambassador_id ? local.ambassador_id.substring(0,8) : 'N/A'}</p>
                </div>
                <div class="flex items-center gap-3">
                    <a href="https://wa.me/${local.telefono_admin.replace(/\D/g, '')}" target="_blank" class="px-3 py-1.5 bg-white border border-[#FFEDD5] text-orange-600 text-xs font-bold rounded-lg hover:bg-orange-50 transition-colors">Hablar al Local</a>
                    <button onclick="aprobarUpgrade('${local.id}')" class="px-4 py-1.5 bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-bold rounded-lg shadow-sm transition-colors">Aprobar y Activar</button>
                </div>
            </div>
        `;
    });

    contenedor.innerHTML = htmlUpgrades;
}

// 5. Función para Aprobar la solicitud de Upgrade
async function aprobarUpgrade(localId) {
    if (!confirm("¿Confirmas que recibiste el pago y deseas convertir este local en CLIENTE ACTIVO oficial?")) return;

    try {
        // Se actualiza el local: Pasa a activo, el flag de upgrade baja a false.
        const { error } = await clienteSupabase
            .from('locales')
            .update({ 
                estatus_comercial: 'activo',
                solicitud_upgrade: false
            })
            .eq('id', localId);

        if (error) throw error;

        // Refrescamos todo el panel
        cargarDatosAdmin();
        alert("¡Local activado exitosamente! El MRR ha sido actualizado.");

    } catch (err) {
        console.error("Error al aprobar:", err);
        alert("No se pudo procesar la activación.");
    }
}
