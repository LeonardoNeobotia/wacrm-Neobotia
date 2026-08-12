const fs = require('fs');
const en = JSON.parse(fs.readFileSync('messages/en.json', 'utf8'));
const es = JSON.parse(fs.readFileSync('messages/es.json', 'utf8'));

let discrepancies = [];

function extractTechnicalTokens(text) {
  if (typeof text !== 'string') return [];
  // Extrae acrónimos (ej. AES, API, GCM), números, variables entre llaves {var}
  const regex = /([A-Z]{2,}|[0-9]+|\{[^\}]+\})/g;
  const matches = text.match(regex) || [];
  return [...new Set(matches)]; // tokens únicos
}

function traverse(enObj, esObj, path) {
  for (let key in enObj) {
    if (typeof enObj[key] === 'string' && typeof esObj[key] === 'string') {
      const enTokens = extractTechnicalTokens(enObj[key]);
      const esTokens = extractTechnicalTokens(esObj[key]);
      
      const missingTokens = enTokens.filter(t => !esTokens.includes(t));
      if (missingTokens.length > 0) {
        discrepancies.push({
          path: path ? path + '.' + key : key,
          en: enObj[key],
          es: esObj[key],
          missing: missingTokens
        });
      }
    } else if (typeof enObj[key] === 'object' && enObj[key] && esObj[key]) {
      traverse(enObj[key], esObj[key], path ? path + '.' + key : key);
    }
  }
}

traverse(en, es, '');

console.log(`Found ${discrepancies.length} discrepancies where technical details might be lost.`);
discrepancies.forEach(d => {
  console.log(`\nPath: ${d.path}`);
  console.log(`Missing: ${d.missing.join(', ')}`);
  console.log(`EN: ${d.en}`);
  console.log(`ES: ${d.es}`);
});
