const fs = require('fs');
const path = './messages/es.json';
const es = JSON.parse(fs.readFileSync(path, 'utf8'));

if (es.Settings) {
  // Fix navigation groups that were overwritten
  es.Settings.groups = {
    account: 'Cuenta',
    workspace: 'Espacio de trabajo'
  };

  // Translate navigation sections
  es.Settings.sections = {
    overview: 'Resumen',
    profile: 'Tu perfil',
    security: 'Inicio de sesión y seguridad',
    appearance: 'Apariencia',
    whatsapp: 'WhatsApp',
    templates: 'Plantillas',
    'quick-replies': 'Quick replies',
    fields: 'Campos y etiquetas',
    deals: 'Negociaciones y moneda',
    members: 'Miembros del equipo',
    api: 'Claves API'
  };
}

fs.writeFileSync(path, JSON.stringify(es, null, 2), 'utf8');
console.log('Fixed navigation strings in es.json');
