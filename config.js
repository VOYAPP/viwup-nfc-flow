/**
 * WHITE-LABEL CONFIG — ViwUp Flujo Proactivo NFC
 * 
 * webhookUrl: pegar aquí la URL del Custom Webhook de Make
 * idLocal: identificador único del restaurante en la Base Maestra
 */
const CONFIG = {
  // === IDENTIFICACIÓN DEL LOCAL ===
  idLocal: 'REST_VIWUP_01',
  localName: 'Restaurante Demo',
  
  // === MAKE WEBHOOK (pegar URL del escenario) ===
  webhookUrl: 'https://hook.us1.make.com/TU_WEBHOOK_AQUI',
  
  // === WHITE-LABEL VISUAL ===
  primaryColor: '#1B7A6E',
  logoUrl: null,
  
  // === DATOS DEL LOCAL ===
  garzones: ['Andrés', 'Camila', 'Diego', 'Valentina'],
  googleMapsUrl: 'https://maps.google.com',
};
