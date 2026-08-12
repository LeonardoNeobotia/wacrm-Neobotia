const fs = require('fs');
const path = './messages/es.json';
const es = JSON.parse(fs.readFileSync(path, 'utf8'));

if (es.Settings) {
  // --- TAGS AND FIELDS ---
  if (!es.Settings.tagsAndFields) es.Settings.tagsAndFields = {};
  Object.assign(es.Settings.tagsAndFields, {
    "title": "Campos y etiquetas",
    "description": "Dos formas de organizar contactos: etiquetas por color para agrupación rápida y campos personalizados para datos estructurados.",
    "tagsTitle": "Etiquetas",
    "tagsDesc": "Etiquetas de colores para agrupar y filtrar contactos.",
    "fieldsTitle": "Campos personalizados",
    "fieldsDesc": "Campos de contacto adicionales (ej. código postal, origen). Aparecen en todos los contactos y en la acción de automatización 'Actualizar campo de contacto'.",
    "adminRole": "Admin",
    "failedToLoadTags": "Error al cargar etiquetas",
    "nameRequired": "El nombre de la etiqueta es obligatorio",
    "notAuthenticated": "No autenticado",
    "tagCreated": "Etiqueta creada",
    "failedToCreateTag": "Error al crear etiqueta",
    "tagDeleted": "Etiqueta eliminada",
    "failedToDeleteTag": "Error al eliminar etiqueta",
    "deleteAria": "Eliminar {name}",
    "noTags": "Aún no hay etiquetas — crea la primera abajo.",
    "placeholder": "Ej. Boletín",
    "useColor": "Usar {color}",
    "addTag": "Añadir etiqueta",
    "deleteTag": "Eliminar etiqueta",
    "deleteConfirm": "¿Eliminar la etiqueta \"{name}\"? Esto la quitará de todos los contactos y no se puede deshacer.",
    "cancel": "Cancelar",
    "deleting": "Eliminando...",
    "colors": {
      "red": "Rojo",
      "orange": "Naranja",
      "amber": "Ámbar",
      "emerald": "Esmeralda",
      "cyan": "Cian",
      "blue": "Azul",
      "violet": "Violeta",
      "pink": "Rosa"
    }
  });

  // --- DEALS AND CURRENCY ---
  if (!es.Settings.deals) es.Settings.deals = {};
  Object.assign(es.Settings.deals, {
    "title": "Negociaciones y moneda",
    "description": "Configura la moneda base de tu espacio de trabajo.",
    "defaultCurrency": "Moneda predeterminada",
    "defaultCurrencyDesc": "Las nuevas negociaciones usarán esta moneda por defecto, y los totales en el embudo y tablero se mostrarán en ella. Las negociaciones existentes mantendrán la moneda con la que fueron guardadas.",
    "currencyLabel": "Moneda",
    "adminOnlyHint": "Solo los administradores pueden cambiar la configuración.",
    "save": "Guardar",
    "saving": "Guardando...",
    "saveFailed": "Error al guardar",
    "saveSuccess": "Guardado exitosamente"
  });

  // --- TEAM MEMBERS ---
  if (!es.Settings.members) es.Settings.members = {};
  Object.assign(es.Settings.members, {
    "title": "Miembros del equipo",
    "description": "Invita a tu equipo y gestiona el acceso.",
    "inviteMember": "Invitar miembro",
    "online": "en línea",
    "away": "ausente",
    "offline": "desconectado",
    "memberCount": "{count} miembros",
    "you": "TÚ",
    "unnamed": "Sin nombre",
    "joined": "Se unió {date}",
    "remove": "Eliminar",
    "removedToast": "Miembro eliminado",
    "updatedToast": "Rol actualizado",
    "pendingInvitations": "Invitaciones pendientes",
    "inviteHint": "Ayuda a recordar a quién enviaste el enlace.",
    "noPendingTitle": "No hay invitaciones pendientes.",
    "noPendingDesc": "Haz clic en Invitar miembro arriba para generar un enlace para compartir.",
    "untitledInvite": "Invitación sin título",
    "created": "Creado",
    "expiresInDays": "Expira en {days} días",
    "expiresInHours": "Expira en {hours} horas",
    "expired": "Expirado",
    "revoke": "Revocar",
    "revokedToast": "Invitación revocada",
    "removeDialogTitle": "¿Eliminar a {name}?",
    "removeDialogDesc": "Perderán acceso al CRM inmediatamente. Esta acción no se puede deshacer.",
    "cancel": "Cancelar",
    "removing": "Eliminando...",
    "removeBtn": "Eliminar miembro"
  });

  // --- INVITE DIALOG ---
  if (!es.Settings.invite) es.Settings.invite = {};
  Object.assign(es.Settings.invite, {
    "inviteCreated": "Invitación creada",
    "inviteCreatedDesc": "Copia el enlace de abajo y envíalo a tu compañero de equipo.",
    "inviteLink": "Enlace de invitación",
    "copy": "Copiar",
    "saveLinkNow": "Guarda este enlace ahora",
    "saveLinkHint": "Por seguridad, los enlaces de invitación no se pueden volver a mostrar después de cerrar esta ventana.",
    "sendViaWhatsApp": "Enviar por WhatsApp",
    "done": "Listo",
    "dialogTitle": "Invitar a un compañero de equipo",
    "dialogDesc": "Genera un enlace de invitación de un solo uso. Compártelo por WhatsApp, Slack o el canal que prefieras — no se requiere servicio de correo.",
    "roleLabel": "Rol",
    "validForLabel": "Enlace válido por",
    "days1": "1 día",
    "days7": "7 días",
    "days30": "30 días",
    "labelTitle": "Etiqueta (opcional)",
    "optional": "(opcional)",
    "labelPlaceholder": "Ej. Sara — equipo de soporte",
    "labelHint": "Te ayuda a recordar a quién enviaste el enlace en la lista de pendientes abajo.",
    "cancel": "Cancelar",
    "creating": "Creando...",
    "generateLink": "Generar enlace",
    "labelTooLong": "La etiqueta no puede tener más de 50 caracteres",
    "copied": "Copiado al portapapeles",
    "clipboardBlocked": "Bloqueado",
    "whatsappMessage": "¡Únete a mi equipo en el CRM! Aquí está tu enlace de invitación: "
  });
}

fs.writeFileSync(path, JSON.stringify(es, null, 2), 'utf8');
console.log('Remaining settings patched in es.json');
