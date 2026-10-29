// ============================================================
// Traducción y formateo de mensajes de error de autenticación
// Mapea los mensajes en inglés emitidos por Supabase Auth (GoTrue)
// a mensajes claros y técnicos en español.
// ============================================================

/**
 * Traduce un error de autenticación de Supabase o JavaScript a un mensaje entendible en español.
 *
 * @param error Objeto de error o cadena devuelta por la operación de autenticación
 * @returns Mensaje amigable en español
 */
export function getAuthErrorMessage(error: unknown): string {
	if (!error) {
		return "Ha ocurrido un error inesperado. Por favor, intenta nuevamente.";
	}

	const rawMessage = typeof error === "string" 
		? error 
		: (error as { message?: string })?.message || "";

	const normalized = rawMessage.toLowerCase().trim();

	// Contraseña igual a la anterior
	if (
		normalized.includes("new password should be different from the old password") ||
		normalized.includes("different from the old password") ||
		normalized.includes("same password")
	) {
		return "La nueva contraseña debe ser diferente a la contraseña anterior.";
	}

	// Longitud de contraseña
	if (
		normalized.includes("password should be at least") ||
		normalized.includes("at least 6 characters")
	) {
		return "La contraseña debe tener al menos 6 caracteres.";
	}

	// Contraseña débil o común
	if (normalized.includes("password is too common")) {
		return "La contraseña ingresada es muy común. Por favor, elige una más segura.";
	}

	if (
		normalized.includes("password should contain") ||
		normalized.includes("weak password")
	) {
		return "La contraseña no cumple con los requisitos de seguridad mínimos.";
	}

	// Sesión o token expirado / ausente
	if (
		normalized.includes("auth session missing") ||
		normalized.includes("session missing")
	) {
		return "La sesión de seguridad ha expirado. Por favor, solicita un nuevo enlace de recuperación.";
	}

	if (
		normalized.includes("token has expired") ||
		normalized.includes("otp expired") ||
		normalized.includes("invalid token")
	) {
		return "El enlace de recuperación ha expirado o ya fue utilizado. Por favor, solicita uno nuevo.";
	}

	// Credenciales incorrectas
	if (normalized.includes("invalid login credentials")) {
		return "Correo electrónico o contraseña incorrectos.";
	}

	// Correo no confirmado
	if (normalized.includes("email not confirmed")) {
		return "Debes confirmar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.";
	}

	// Usuario ya registrado
	if (
		normalized.includes("user already registered") ||
		normalized.includes("already exists")
	) {
		return "Ya existe una cuenta registrada con este correo electrónico.";
	}

	// Usuario no encontrado
	if (normalized.includes("user not found")) {
		return "No existe ninguna cuenta asociada a este correo electrónico.";
	}

	// Límite de tasa / Rate limit
	if (
		normalized.includes("for security purposes, you can only request this once every") ||
		normalized.includes("rate limit") ||
		normalized.includes("over_email_send_rate_limit") ||
		normalized.includes("too many requests")
	) {
		return "Demasiadas solicitudes en poco tiempo. Por seguridad, espera unos minutos antes de intentar de nuevo.";
	}

	// Correo no válido
	if (
		normalized.includes("invalid email") ||
		normalized.includes("unable to validate email")
	) {
		return "El formato del correo electrónico ingresado no es válido.";
	}

	// Error de conexión o red
	if (
		normalized.includes("failed to fetch") ||
		normalized.includes("network request failed") ||
		normalized.includes("fetch failed")
	) {
		return "No se pudo conectar con el servidor. Verifica tu conexión a internet e inténtalo de nuevo.";
	}

	// Si el mensaje ya viene en español o no coincide con los patrones en inglés, se devuelve el texto original
	if (rawMessage.length > 0) {
		return rawMessage;
	}

	return "No se pudo procesar la solicitud. Por favor, intenta nuevamente.";
}

