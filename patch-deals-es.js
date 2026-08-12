const fs = require('fs');
const es = JSON.parse(fs.readFileSync('./messages/es.json', 'utf8'));

Object.assign(es.Settings.deals, {
  "convertExistingLabel": "Convertir el valor de los negocios existentes al tipo de cambio actual",
  "conversionApiFailed": "No se pudo conectar al servicio de divisas. Intenta de nuevo.",
  "saveAndConverted": "Moneda actualizada y {count, plural, =1 {1 negocio convertido} other {# negocios convertidos}}"
});

fs.writeFileSync('./messages/es.json', JSON.stringify(es, null, 2));
