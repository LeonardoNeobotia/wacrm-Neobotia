const fs = require('fs');
const esPath = 'messages/es.json';
const es = JSON.parse(fs.readFileSync(esPath, 'utf8'));

// 1. Deshacer el Spanglish excepto "Dashboard"
function revertSpanglish(obj) {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      let text = obj[key];
      text = text.replace(/\bInbox\b/g, 'Bandeja de entrada');
      text = text.replace(/\bPipelines\b/g, 'Embudos');
      text = text.replace(/\bBroadcasts\b/g, 'Difusiones');
      text = text.replace(/\bFlows\b/g, 'Flujos');
      text = text.replace(/\bAI Agents\b/g, 'Agentes IA');
      text = text.replace(/\bSettings\b/g, 'Configuración');
      
      // Corregir IA abstracta (un error previo)
      text = text.replace(/\bIA abstracta\b/g, 'Reanudar IA');
      
      obj[key] = text;
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      revertSpanglish(obj[key]);
    }
  }
}

revertSpanglish(es);

// 2. Restaurar variables e interpolaciones perdidas ({mode}, {theme}, {preview}, {searchType})
if (es.Settings && es.Settings.overview) {
  es.Settings.overview.appearance = "Modo {mode} · Acento {theme}";
}

if (es.Settings && es.Settings.templates) {
  es.Settings.templates.toastSyncFailed = "Error al sincronizar: {preview}";
}

if (es.Settings && es.Settings.whatsapp) {
  es.Settings.whatsapp.description = "Conecta tu API de WhatsApp Business de Meta. Credenciales, webhooks y pasos de configuración viven aquí.";
}

if (es.Settings && es.Settings.aiKnowledge) {
  es.Settings.aiKnowledge.description = "Agrega preguntas frecuentes (FAQ), políticas o detalles de productos. El asistente recupera los fragmentos relevantes al redactar y responder automáticamente, por lo que puede responder en lugar de transferir a un agente.{searchType}";
}

if (es.Contacts && es.Contacts.customFields) {
  es.Contacts.customFields.desc = "Defina campos de contacto adicionales (por ejemplo, código ZIP, fuente principal). Aparecen en cada contacto y en la acción de automatización 'Actualizar campo de contacto'.";
}

fs.writeFileSync(esPath, JSON.stringify(es, null, 2), 'utf8');
console.log('Spanglish revertido (excepto Dashboard) y variables restauradas con éxito.');
