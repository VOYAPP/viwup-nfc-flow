// 1. Inicializar Supabase (Reemplaza con tus claves)
const supabaseUrl = 'https://syoypjljkwmwlrpuwxwh.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5b3lwamxqa3dtd2xycHV3eHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1MDA1OTgsImV4cCI6MjEwMzA3NjU5OH0.BvGcxpDWYn1uOSScG2GHLEOAcTZWW336FRE0JsWwsRc';
const clienteSupabase = supabase.createClient(supabaseUrl, supabaseKey);

// Variables globales para el buscador y filtros rápidos
let todosLosLocales = [];
let diccionarioAmbassadors = {};

window.onload = () => {
    cargarDatosAdmin();
};

// --- MENÚ LATERAL ---
function cambiarSeccion(seccion) {
    document.getElementById('vista-locales').classList.add('hidden');
    document.getElementById('vista-ambassadors').classList.add('hidden');
    
    document.getElementById('btn-tab-locales').className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white font-medium transition-colors";
    document.getElementById('btn-tab-ambassadors').className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white font-medium transition-colors";

    document.getElementById(`vista-${seccion}`).classList.remove('hidden');
    document.getElementById(`btn-tab-${seccion}`).className = "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-[#3B82F6] text-white font-semibold transition-colors";
}

// --- MOTOR PRINCIPAL DE DATOS ---
async function cargarDatosAdmin() {
    try {
        // 1. Traer lista de Ambassadors (Para cruzar IDs con Nombres)
        const { data: ambassadors } = await clienteSupabase.from('ambassadors').select('id, nombre, telefono, email');
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
    document.getElementById('admin-mrr').innerHTML = `$${(activos * 10000).toLocaleString('es-CL')} <span class="text-sm text-slate-400 font-medium">CLP</span>`;
    document.getElementById('admin-upgrades-pendientes').textContent = upgradesPendientes;
    document.getElementById('admin-mrr-potencial').textContent = `+$${(upgradesPendientes * 10000).toLocaleString('es-CL')} CLP en espera`;
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
        const btnWaVendedor = vendedor.telefono ? `<a href="https
