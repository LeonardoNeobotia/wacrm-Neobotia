const fs = require('fs');
const path = './messages/es.json';
const es = JSON.parse(fs.readFileSync(path, 'utf8'));

if (es.Settings) {
  if (!es.Settings.apiKeys) es.Settings.apiKeys = {};
  
  Object.assign(es.Settings.apiKeys, {
    "title": "Claves API",
    "description": "Las claves autentican la API REST pública (<apiCode>/api/v1</apiCode>) para que puedas construir tus propias automatizaciones. Envíalas como <headerCode>Authorization: Bearer <key></headerCode>.",
    "newApiKey": "Nueva clave API",
    "noApiKeys": "Aún no hay claves API.",
    "createOneHint": "Haz clic en <bold>Nueva clave API</bold> para crear una.",
    "askAdminHint": "Pide a un administrador que cree una.",
    "revoked": "Revocada",
    "expired": "Expirada",
    "noScopes": "Sin scopes",
    "created": "Creada el {date}",
    "lastUsed": "último uso {date}",
    "neverUsed": "nunca usada",
    "expires": "expira el {date}",
    "revoke": "Revocar",
    "revokeSuccess": "Revocada \"{name}\"",
    "revokeFailed": "Error al revocar clave",
    "loadFailed": "Error al cargar las claves API",
    "createError": "Error al crear clave",
    "nameRequired": "Asigna un nombre a la clave",
    "nameLabel": "Nombre",
    "namePlaceholder": "ej. Automatización Zapier",
    "scopesLabel": "Scopes",
    "scopesHint": "Una clave sin scopes aún puede llamar a <code>GET /api/v1/me</code> para verificar que funciona.",
    "cancel": "Cancelar",
    "creating": "Creando…",
    "createKey": "Crear clave",
    "copyTitle": "Copia tu clave API",
    "copyDesc": "Esta es la única vez que se muestra la clave completa. Guárdala en un lugar seguro — si la pierdes, revócala y crea una nueva.",
    "apiKeyLabel": "Clave API",
    "copy": "Copiar",
    "copySuccess": "Clave API copiada",
    "copyFailed": "Error al copiar — selecciona y copia manualmente",
    "newKeyTitle": "Nueva clave API",
    "newKeyDesc": "Nómbrala según la integración que la usará, y otórgale solo los scopes que necesite.",
    "done": "Listo",
    "networkError": "No se pudo contactar al servidor",
    "emptyTitle": "Sin claves API",
    "emptyDesc": "Crea una clave API"
  });
}

fs.writeFileSync(path, JSON.stringify(es, null, 2), 'utf8');
console.log('API Keys settings patched in es.json');
