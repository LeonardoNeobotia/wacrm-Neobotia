const fs = require('fs');

function replaceTerms(obj) {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Reemplazos específicos
      let text = obj[key];
      text = text.replace(/\bPanel de Control\b/g, 'Dashboard');
      text = text.replace(/\bPanel\b/g, 'Dashboard');
      text = text.replace(/\bBandeja de entrada\b/gi, 'Inbox');
      text = text.replace(/\bBandeja de Entrada\b/gi, 'Inbox');
      text = text.replace(/\bPipelines de Ventas\b/gi, 'Pipelines');
      text = text.replace(/\bEmbudos\b/gi, 'Pipelines');
      text = text.replace(/\bDifusiones\b/gi, 'Broadcasts');
      text = text.replace(/\bFlujos\b/gi, 'Flows');
      text = text.replace(/\bAgentes IA\b/gi, 'AI Agents');
      text = text.replace(/\bConfiguración\b/gi, 'Settings');
      
      obj[key] = text;
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      replaceTerms(obj[key]);
    }
  }
}

try {
  const es = JSON.parse(fs.readFileSync('messages/es.json', 'utf8'));
  
  // Aplicar reemplazo global de términos clave Spanglish
  replaceTerms(es);

  // Restaurar textos perdidos específicos mencionados por el usuario
  if (es.Settings && es.Settings.aiConfig) {
    es.Settings.aiConfig.encryptionNotice = "Tu clave se cifra en reposo (AES-256-GCM) y nunca se vuelve a mostrar después de guardarse.";
  }

  fs.writeFileSync('messages/es.json', JSON.stringify(es, null, 2), 'utf8');
  console.log('Spanglish terms applied to es.json');
} catch (e) {
  console.error(e);
}
