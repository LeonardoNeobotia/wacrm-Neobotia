const fs = require('fs');
const esPath = 'messages/es.json';
const es = JSON.parse(fs.readFileSync(esPath, 'utf8'));

if (!es.AIAgents) es.AIAgents = {};
es.AIAgents.usage = {
  title: "Uso de tokens",
  description: "Tokens consumidos en tu clave por los borradores y el bot de respuestas automáticas. Solo conteo — no se almacena contenido de mensajes aquí.",
  timeWindow: "Últimos {days} días",
  noUsageTitle: "Aún no hay uso de IA en los últimos {days} días.",
  noUsageDesc: "Esto se llenará a medida que el asistente genere borradores y responda automáticamente.",
  totalTokens: "Total de tokens",
  llmCalls: "Llamadas al LLM",
  autoReply: "Autorespuesta",
  drafts: "Borradores",
  tokensPerDay: "Tokens por día",
  byModel: "Por modelo",
  call: "llamada",
  calls: "llamadas",
  truncated: "Mostrando ventana parcial — el uso es lo suficientemente alto como para resumir solo los registros más recientes."
};

fs.writeFileSync(esPath, JSON.stringify(es, null, 2), 'utf8');
console.log('es.json patched with AIAgents.usage translations');
