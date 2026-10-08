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
        
    if (error) {
        console.error("Error cargando locales:", error);
        return;
    }

    let activos = 0;
    let htmlTabla = '';

    locales.forEach(local => {
        // Calcular si está pagando o es demo
        if(local.estatus_comercial === 'activo') activos++;
        
        let botonAccion = local.estatus_comercial === 'demo' 
            ? `<button onclick="transformarACliente('${local.id}')">Convertir a Cliente</button>` 
            : `<span style="color: green;">Activo (Generando Comisión)</span>`;

        htmlTabla += `
            <tr>
                <td>${local.nombre}</td>
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
    
    const nombreLocal = document.getElementById('input-nombre-local').value.trim();
    const adminTelefono = document.getElementById('input-telefono').value.trim();
    const slugLocal = document.getElementById('input-slug').value.trim().toLowerCase();
    
    try {
        const { error } = await clienteSupabase
            .from('locales')
            .insert([{
                nombre: nombreLocal,
                telefono_admin: adminTelefono,
                slug: slugLocal,
                estado_activo: false,
                estatus_comercial: 'demo',
                ambassador_id: ambassadorActual.id
            }]);

        if (error) throw error;

        alert('¡Demo creada con éxito!');
        document.getElementById('form-demo').reset();
        cargarLocales(); // Refrescar la tabla

    } catch (err) {
        alert("Hubo un error al registrar el local. Verifica que el enlace (slug) no exista ya.");
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

// Iniciar sistema al cargar la página
window.onload = iniciarPanel;
