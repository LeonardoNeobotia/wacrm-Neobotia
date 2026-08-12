const fs = require('fs');
const path = './messages/es.json';
const es = JSON.parse(fs.readFileSync(path, 'utf8'));

if (es.Settings) {
  // Tu perfil
  Object.assign(es.Settings.profile, {
    title: "Tu perfil",
    description: "Cómo te presentas en la app. Tu avatar y nombre aparecen en el encabezado, barra lateral y en cualquier lugar donde tus compañeros te vean.",
    changePhoto: "Cambiar foto",
    uploadPhoto: "Subir foto",
    remove: "Eliminar",
    photoHint: "PNG, JPG, WebP o GIF. Hasta 2 MB.",
    displayName: "Nombre a mostrar",
    email: "Correo electrónico",
    emailChangeHint: "Revisa la bandeja de entrada de <bold>{oldEmail}</bold> y <bold>{newEmail}</bold> — ambas deben confirmar antes de que el cambio se aplique.",
    accountDetails: "Detalles de la cuenta",
    role: "Rol",
    joined: "Se unió el",
    userId: "ID de usuario",
    loading: "Cargando tu perfil…",
    saving: "Guardando…",
    saveChanges: "Guardar cambios",
    unsupportedImage: "Tipo de imagen no soportado",
    unsupportedImageDesc: "Usa PNG, JPG, WebP o GIF.",
    imageTooLarge: "Imagen muy grande",
    imageTooLargeDesc: "Máximo 2 MB.",
    nameRequired: "El nombre es obligatorio",
    invalidEmail: "Ingresa un correo válido",
    uploadFailed: "Error al subir: {message}",
    saveFailed: "Error al guardar: {message}",
    profileSaved: "Perfil guardado",
    emailChangeFailed: "Error al cambiar correo: {message}",
    profileSavedEmailCheck: "Perfil guardado — revisa tu correo para confirmar el cambio",
    passwordTitle: "Contraseña",
    passwordDesc: "Usa al menos {min} caracteres. Mantendrás tu sesión iniciada en este dispositivo luego de cambiarla.",
    currentPassword: "Contraseña actual",
    newPassword: "Nueva contraseña",
    confirmPassword: "Confirmar nueva contraseña",
    updating: "Actualizando…",
    updatePassword: "Actualizar contraseña",
    cannotChangeNoEmail: "No puedes cambiar la contraseña sin un correo actual",
    passwordTooShort: "La contraseña debe tener al menos {min} caracteres",
    passwordMismatch: "La nueva contraseña y la confirmación no coinciden",
    currentPasswordIncorrect: "La contraseña actual es incorrecta",
    passwordUpdateFailed: "Error al actualizar contraseña: {message}",
    passwordUpdated: "Contraseña actualizada",
    sessionsTitle: "Sesiones activas",
    sessionsDesc: "Cierra sesión en cada dispositivo donde hayas ingresado — incluyendo este. Útil si perdiste un equipo o compartiste tu contraseña.",
    signOutAll: "Cerrar sesión en todos los dispositivos",
    signOutConfirmTitle: "¿Cerrar sesión en todas partes?",
    signOutConfirmDesc: "Se cerrará la sesión en cada dispositivo y deberás volver a ingresar. Serás redirigido a la página de inicio.",
    cancel: "Cancelar",
    signingOut: "Cerrando sesión…",
    signOutEverywhere: "Cerrar sesión en todos lados",
    signOutFailed: "Error al cerrar sesión: {message}"
  });

  // Apariencia
  if (!es.Settings.appearance) es.Settings.appearance = {};
  Object.assign(es.Settings.appearance, {
    useMode: "Usar modo {mode}",
    active: "Activo",
    useTheme: "Usar tema {name}"
  });

  // WhatsApp
  if (!es.Settings.whatsapp) es.Settings.whatsapp = {};
  Object.assign(es.Settings.whatsapp, {
    title: "WhatsApp",
    description: "Conecta tu API de WhatsApp Business de Meta. Credenciales, webhooks y pasos de configuración viven aquí.",
    emptyTitle: "Sin configuración",
    emptyDesc: "Conecta tu número",
    credentialsValid: "Credenciales válidas",
    credentialsValidDesc: "Tu token de acceso autentica con Meta. Revisa el estado de registro abajo para ver si los webhooks están conectados.",
    notRegistered: "No registrado — Meta no entregará eventos",
    verifyWithMeta: "Verificar con Meta",
    notRegisteredDesc: "Este número se guardó antes de existir el rastreo de registro, o el registro fue saltado. Ingresa el PIN de 2 pasos abajo y haz clic en Guardar Configuración para suscribirte.",
    apiCredentials: "Credenciales API",
    apiCredentialsDesc: "Ingresa tus credenciales de la API de WhatsApp Business de Meta.",
    phoneId: "ID del número de teléfono",
    phoneIdPlaceholder: "Ej. 101234567890123",
    businessId: "ID de cuenta de WhatsApp Business",
    businessIdPlaceholder: "Ej. 101234567890123",
    accessToken: "Token de acceso",
    accessTokenPlaceholder: "El token permanente de Meta",
    tokenHidden: "El token está oculto por seguridad. Vuelve a ingresarlo si deseas actualizar la configuración.",
    verifyToken: "Token de verificación del webhook",
    verifyTokenPlaceholder: "Crea un token de verificación personalizado",
    verifyTokenDesc: "Una cadena personalizada que tú creas. Debe coincidir con el token que establezcas en la configuración de webhook de Meta.",
    twoStepPin: "PIN de verificación en dos pasos (opcional)",
    twoStepPinPlaceholder: "PIN de 6 dígitos de Meta WhatsApp Manager",
    twoStepPinDesc: "Si habilitaste la verificación en dos pasos para este número en WhatsApp Manager, ingrésalo aquí. Requerido para suscribirse a webhooks de mensajes.",
    saving: "Guardando…",
    saveConfig: "Guardar Configuración",
    setupInstructions: "Instrucciones de Configuración",
    setupInstructionsDesc: "Sigue estos pasos para conectar tu API de WhatsApp Business.",
    step1Title: "1. Crear una App en Meta",
    step1Body: "Ve al <a1>Panel de Desarrolladores de Meta</a1> y haz clic en <strong>Crear App</strong>. Selecciona <strong>Otro</strong>, luego <strong>Negocios</strong>, y sigue los pasos.",
    step2Title: "2. Agregar producto WhatsApp",
    step2Body: "En el panel de tu app, busca WhatsApp bajo 'Agregar productos a tu app' y haz clic en <strong>Configurar</strong>. Necesitarás asociar o crear una Cuenta Comercial de Meta.",
    step3Title: "3. Obtener credenciales API",
    step3Body: "Bajo <strong>WhatsApp > Configuración API</strong>, encontrarás tu ID de número de teléfono y el ID de cuenta de WhatsApp Business. Necesitarás generar un token permanente desde la <strong>Configuración del Sistema</strong>.",
    step4Title: "4. Configurar Webhooks",
    step4Body: "Ve a <strong>WhatsApp > Configuración</strong> en Meta y haz clic en editar bajo Webhooks. Pega tu URL de Callback y el Token de Verificación. Luego suscríbete al evento <strong>messages</strong>.",
    docsLink: "Documentación de Meta WhatsApp API",
    whatsappSetupLink: "Guía de conexión",
    registrationSuccess: "Número registrado con Meta exitosamente",
    configSavedSuccess: "Configuración guardada",
    configSavedError: "Error al guardar configuración: {message}"
  });

  // Campos y Etiquetas
  if (!es.Settings.tagsAndFields) es.Settings.tagsAndFields = {};
  Object.assign(es.Settings.tagsAndFields, {
    title: "Campos y etiquetas",
    description: "Organiza tus contactos. Crea etiquetas para agrupamiento rápido y campos personalizados para almacenar datos estructurados específicos de tu negocio.",
    emptyTitle: "Sin etiquetas o campos",
    emptyDesc: "Añade tu primero"
  });

  // Plantillas
  if (!es.Settings.templates) es.Settings.templates = {};
  Object.assign(es.Settings.templates, {
    title: "Plantillas",
    description: "Gestiona plantillas de mensajes aprobadas por WhatsApp para difusiones e interacciones iniciales.",
    emptyTitle: "Sin plantillas",
    emptyDesc: "Añade una plantilla",
    syncTemplates: "Sincronizar de Meta"
  });

  // Roles
  if (!es.Settings.roles) es.Settings.roles = {};
  Object.assign(es.Settings.roles, {
    title: "Roles",
    description: "Gestiona permisos dentro del CRM.",
    emptyTitle: "Sin roles",
    emptyDesc: "Añade un rol"
  });

  // Miembros del equipo
  if (!es.Settings.members) es.Settings.members = {};
  Object.assign(es.Settings.members, {
    title: "Miembros del equipo",
    description: "Invita a tu equipo y gestiona el acceso.",
    emptyTitle: "Sin miembros",
    emptyDesc: "Invita a un miembro",
    inviteMember: "Invitar miembro"
  });

  // Grupos
  if (!es.Settings.groups) es.Settings.groups = {};
  Object.assign(es.Settings.groups, {
    title: "Grupos",
    description: "Gestiona grupos para colaborar o asignar contactos.",
    emptyTitle: "Sin grupos",
    emptyDesc: "Crea un grupo"
  });
  
  // Claves API
  if (!es.Settings.apiKeys) es.Settings.apiKeys = {};
  Object.assign(es.Settings.apiKeys, {
    title: "Claves API",
    description: "Genera claves de API para conectar herramientas externas.",
    emptyTitle: "Sin claves API",
    emptyDesc: "Crea una clave API"
  });
  
  // Deals & Currency
  if (!es.Settings.deals) es.Settings.deals = {};
  Object.assign(es.Settings.deals, {
    title: "Negociaciones y moneda",
    description: "Configura la moneda base de tu espacio de trabajo y visualiza el historial de conversiones para las oportunidades.",
    emptyTitle: "Sin negociaciones",
    emptyDesc: "No hay configuraciones disponibles."
  });

  // Quick replies
  if (!es.Settings.quickReplies) es.Settings.quickReplies = {};
  Object.assign(es.Settings.quickReplies, {
    title: "Quick replies",
    description: "Respuestas rápidas para usar en conversaciones.",
    emptyTitle: "Sin quick replies",
    emptyDesc: "Crea un quick reply"
  });
  
  // Themes
  if (!es.Settings.appearance.themes) es.Settings.appearance.themes = {
    violet: { title: "Violet", desc: "Por defecto — confiado, ligeramente lúdico." },
    emerald: { title: "Emerald", desc: "Crecimiento, acentos de mensajería sin copiar el verde de WhatsApp." },
    cobalt: { title: "Cobalt", desc: "Azul limpio B2B-SaaS — tranquilo y orientado a producto." },
    amber: { title: "Amber", desc: "Cálido y amigable — se siente bien para equipos PYME." },
    rose: { title: "Rose", desc: "Audaz y moderno — creadores, estilo de vida." }
  };
  
}

fs.writeFileSync(path, JSON.stringify(es, null, 2), 'utf8');
console.log('Settings keys fully translated in es.json');
