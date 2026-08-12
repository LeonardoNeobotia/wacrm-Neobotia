const fs = require('fs');
const es = JSON.parse(fs.readFileSync('messages/es.json', 'utf8'));

// ============================================================
// Flows.list - claves faltantes
// ============================================================
if (es.Flows && es.Flows.list) {
  const fl = es.Flows.list;
  fl.description = "Crea conversaciones de WhatsApp con ramificaciones y botones. Útil para menús, FAQs y triaje antes de que un agente intervenga.";
  fl.newFlow = "Nuevo flujo";
  fl.statusDraft = "Borrador";
  fl.statusActive = "Activo";
  fl.statusArchived = "Archivado";
  fl.loadError = "No se pudieron cargar los flujos.";
  fl.createError = "No se pudo crear el flujo.";
  fl.cloneError = "Error al clonar";
  fl.deleteConfirm = "¿Eliminar \"{name}\"? Las ejecuciones activas terminarán de inmediato.";
  fl.deleteSuccess = "Flujo eliminado.";
  fl.deleteError = "No se pudo eliminar el flujo.";
  fl.emptyTitle = "Aún no hay flujos";
  fl.emptyDesc = "Crea tu primera conversación — un menú de bienvenida, consulta de pedidos, un bot de FAQ. Los clientes tocan botones; el bot los dirige a la respuesta correcta (o al agente correcto).";
  fl.createFirst = "Crear tu primer flujo";
  fl.createTitle = "Crear un nuevo flujo";
  fl.createDesc = "Comienza desde una plantilla o construye desde cero.";
  fl.startTemplate = "Comenzar desde una plantilla";
  fl.nodeCount = "{count} {count, plural, =1 {nodo} other {nodos}}";
  fl.startBlank = "O comenzar en blanco";
  fl.placeholderName = "ej. Menú de bienvenida";
  fl.runCount = "{count} {count, plural, =1 {ejecución} other {ejecuciones}}";
  fl.triggerKeywordNone = "Disparado por palabra clave (ninguna configurada)";
  fl.triggerKeyword = "Disparado por: {keywords}";
  fl.triggerFirstInbound = "Disparado por el primer mensaje entrante de un contacto";
  fl.triggerManual = "Disparo manual";
}

// ============================================================
// Flows.list.templates - tarjetas del modal "Create a new flow"
// ============================================================
if (es.Flows && es.Flows.list) {
  es.Flows.list.templates = {
    welcome_menu: {
      name: "Menú de bienvenida",
      description: "Saluda a clientes que escriben una palabra clave y los dirige al agente correcto según sean nuevos o existentes.",
      nodeCount: "4 nodos"
    },
    faq_bot: {
      name: "Bot de FAQ",
      description: "Responde preguntas frecuentes automáticamente. El cliente elige un tema de una lista; el bot responde y finaliza.",
      nodeCount: "7 nodos"
    },
    lead_capture: {
      name: "Captura de leads",
      description: "Saluda a nuevos contactos, captura nombre + email + empresa, luego transfiere a ventas con las respuestas en la nota.",
      nodeCount: "6 nodos"
    }
  };
}

// ============================================================
// AIAgents page keys
// ============================================================
if (!es.AIAgents) es.AIAgents = {};
es.AIAgents.title = "Agentes IA";
es.AIAgents.description = "Tu agente IA con tu propia clave — configúralo y luego pruébalo en el área de pruebas antes de que responda a clientes en la bandeja.";
es.AIAgents.tabPlayground = "Área de pruebas";
es.AIAgents.tabSetup = "Configuración";
es.AIAgents.tabUsage = "Uso";

// ============================================================
// Automations.list - claves faltantes del builder
// ============================================================
if (es.Automations && es.Automations.list) {
  const al = es.Automations.list;
  al.templatesTitle = "Plantillas de inicio rápido";
  al.create = "Crear Automatización";
  al.noAutomations = "Aún no hay automatizaciones";
  al.noAutomationsHint = "Crea tu primera automatización para empezar.";
  al.runCount = "{count} {count, plural, =1 {ejecución} other {ejecuciones}}";
  al.newMessage = "Nuevo Mensaje";
  al.toggleActive = "Activar/Desactivar";
  
  // Plantillas traducidas para las tarjetas de inicio rápido
  al.templateCards = {
    welcome_message: {
      name: "Mensaje de Bienvenida",
      description: "Respuesta automática a nuevos contactos con un saludo."
    },
    out_of_office: {
      name: "Fuera de Oficina",
      description: "Respuesta automática fuera del horario para que nadie quede esperando."
    },
    lead_qualifier: {
      name: "Calificador de Leads",
      description: "Hace preguntas de calificación para filtrar leads entrantes."
    },
    follow_up_reminder: {
      name: "Recordatorio de Seguimiento",
      description: "Envía un recordatorio si un contacto no ha respondido en 24 horas."
    }
  };
}

// ============================================================
// AiPlayground - componente que muestra textos en ingles
// ============================================================
if (!es.AIPlayground) es.AIPlayground = {};
es.AIPlayground.title = "Área de pruebas";
es.AIPlayground.subtitle = "Prueba respuestas como si fueras un cliente";
es.AIPlayground.emptyTitle = "Envía un mensaje para ver cómo respondería tu agente.";
es.AIPlayground.emptyDesc = "Utiliza tu base de conocimiento y se comporta exactamente como el bot de respuesta automática — incluyendo la transferencia.";
es.AIPlayground.notSetupLink = "¿Aún no configurado? Ir a Configuración";
es.AIPlayground.inputPlaceholder = "Escribe un mensaje de cliente...";
es.AIPlayground.reset = "Reiniciar";

fs.writeFileSync('messages/es.json', JSON.stringify(es, null, 2), 'utf8');
console.log('Claves de Flows, Automations y AI Agents actualizadas en es.json');
