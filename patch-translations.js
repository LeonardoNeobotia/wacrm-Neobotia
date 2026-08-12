const fs = require('fs');
const es = JSON.parse(fs.readFileSync('messages/es.json', 'utf8'));

// Fix AI Agents embeddingsHint
if (es.Settings && es.Settings.aiConfig) {
  es.Settings.aiConfig.embeddingsHint = "Clave de OpenAI usada solo para procesar tu base de conocimiento (text-embedding-3-small){sameKeyText}. Déjalo en blanco para usar búsqueda por palabras clave en su lugar. Bórralo para desactivar la búsqueda semántica.";
  es.Settings.aiConfig.sameKeyText = " — puede ser la misma clave de arriba";
  es.Settings.aiConfig.promptPlaceholder = "Ej: Eres el soporte técnico de Acme Corp...";
  es.Settings.aiConfig.maxAutoRepliesDesc = "Cuántas veces el bot intentará responder antes de transferir a un agente (evita que el bot quede en bucle).";
  es.Settings.aiConfig.handoffTo = "Transferir a";
  es.Settings.aiConfig.handoffToDesc = "A quién transferir cuando el bot detecta que el cliente quiere hablar con un humano o falla.";
  es.Settings.aiConfig.handoffQueue = "Bandeja compartida (sin asignar)";
  es.Settings.aiConfig.remove = "Eliminar agente IA";
}

// Fix Automations list strings
if (es.Automations && es.Automations.list) {
  es.Automations.list.emptyTitle = "Aún no hay automatizaciones";
  es.Automations.list.emptyDesc = "Crea flujos de trabajo que reaccionen a eventos automáticamente.";
  es.Automations.list.runs = "{count} ejecución";
  es.Automations.list.runsPlural = "{count} ejecuciones";
  es.Automations.list.lastRun = "hace {time}";
  es.Automations.list.deleteTitle = "Eliminar Automatización";
  es.Automations.list.deleteDesc = "¿Eliminar '{name}'? Esto no se puede deshacer.";
  
  es.Automations.list.toasts = {
    activated: "Automatización activada",
    paused: "Automatización pausada",
    duplicated: "Automatización duplicada",
    deleted: "Automatización eliminada",
    updateError: "Error al actualizar",
    duplicateError: "Error al duplicar",
    deleteError: "Error al eliminar"
  };
}

fs.writeFileSync('messages/es.json', JSON.stringify(es, null, 2), 'utf8');
console.log('Parcheadas claves en es.json');
