const fs = require('fs');
const esPath = 'messages/es.json';
const es = JSON.parse(fs.readFileSync(esPath, 'utf8'));

// 1. Fix "otro" to "other" in Dashboard
if (es.Dashboard && es.Dashboard.page) {
  es.Dashboard.page.openDeals = "{count} {count, plural, =1 {negociación abierta} other {negociaciones abiertas}}";
}

// 2. Add follow_up_reminder template card
if (es.Automations && es.Automations.list && es.Automations.list.templateCards) {
  es.Automations.list.templateCards.follow_up_reminder = {
    name: "Recordatorio de Seguimiento",
    description: "Programa un mensaje automático si el cliente no responde."
  };
}

// 3. Add never translation
if (es.Automations && es.Automations.list) {
  es.Automations.list.never = "nunca";
}

// 4. Add audience types for Broadcasts
if (es.Broadcasts && es.Broadcasts.wizard && es.Broadcasts.wizard.scheduleSend) {
  es.Broadcasts.wizard.scheduleSend.audienceAll = "Todos los Contactos";
  es.Broadcasts.wizard.scheduleSend.audienceTags = "Por Etiquetas";
  es.Broadcasts.wizard.scheduleSend.audienceCsv = "Importación CSV";
}

fs.writeFileSync(esPath, JSON.stringify(es, null, 2), 'utf8');
console.log('es.json parcheado con correcciones.');
