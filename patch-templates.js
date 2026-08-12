const fs = require('fs');
const es = JSON.parse(fs.readFileSync('messages/es.json', 'utf8'));

if (es.Automations && es.Automations.list) {
  es.Automations.list.templateCards = {
    welcome_message: {
      name: "Mensaje de Bienvenida",
      description: "Saluda automáticamente a los nuevos contactos y establece expectativas."
    },
    out_of_office: {
      name: "Fuera de la Oficina",
      description: "Respuesta automática fuera de horario para que nadie quede esperando."
    },
    lead_qualifier: {
      name: "Calificador de Leads",
      description: "Haz 3 preguntas y asigna a la persona adecuada."
    },
    review_request: {
      name: "Solicitud de Reseña",
      description: "Envía un enlace de reseña de Google después de resolver un ticket."
    }
  };
}

fs.writeFileSync('messages/es.json', JSON.stringify(es, null, 2), 'utf8');
console.log('Agregadas traducciones de templateCards');
