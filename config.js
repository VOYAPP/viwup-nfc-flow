// ╔═══════════════════════════════════════════════════════════════╗
// ║  config.js — ÚNICO ARCHIVO QUE CAMBIA POR LOCAL (cliente)   ║
// ╚═══════════════════════════════════════════════════════════════╝
const CONFIG = {
  // Identidad del local
  idLocal: 'REST_VIWUP_01',
  localName: 'Restaurante Demo',

  // Webhook Make → Google Sheets
  webhookUrl: 'https://hook.us2.make.com/2f2amy2uq88ptk4fksltadyxn485xeov',

  // White-label: color primario
  primaryColor: '#1B7A6E',

  // Logo del local (null = fallback inicial con letra)
  logoUrl: null,

  // Garzones del local
  garzones: ['Andrés', 'Camila', 'Diego', 'Valentina'],

  // Motivos de queja SOS (multi-select)
  motivos: ['Servicio', 'Cocina', 'Barra'],

  // Google Maps review link
  googleMapsUrl: 'https://search.google.com',
};
