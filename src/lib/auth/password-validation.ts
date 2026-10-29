// ============================================================
// Validación de complejidad de contraseñas
// Exige al menos 8 caracteres, mayúsculas, minúsculas y números
// para garantizar la seguridad de las cuentas de usuario.
// ============================================================

export interface PasswordValidationResult {
	isValid: boolean;
	error: string | null;
}

/**
 * Valida que una contraseña cumpla con los estándares de seguridad:
 * - Mínimo 8 caracteres
 * - Al menos una letra mayúscula
 * - Al menos una letra minúscula
 * - Al menos un número
 *
 * @param password Contraseña en texto plano a verificar
 * @returns Resultado con booleano y mensaje explicativo en español
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
	if (!password || password.length < 8) {
		return {
			isValid: false,
			error: "La contraseña debe tener al menos 8 caracteres.",
		};
	}

	if (!/[A-Z]/.test(password)) {
		return {
			isValid: false,
			error: "La contraseña debe incluir al menos una letra mayúscula.",
		};
	}

	if (!/[a-z]/.test(password)) {
		return {
			isValid: false,
			error: "La contraseña debe incluir al menos una letra minúscula.",
		};
	}

	if (!/[0-9]/.test(password)) {
		return {
			isValid: false,
			error: "La contraseña debe incluir al menos un número.",
		};
	}

	return {
		isValid: true,
		error: null,
	};
}

