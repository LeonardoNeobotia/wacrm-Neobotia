import { describe, it, expect } from "vitest";
import { getAuthErrorMessage } from "./error-messages";

describe("getAuthErrorMessage", () => {
	it("traduce el error de contraseña igual a la anterior", () => {
		const error = { message: "New password should be different from the old password." };
		expect(getAuthErrorMessage(error)).toBe("La nueva contraseña debe ser diferente a la contraseña anterior.");
	});

	it("traduce error de contraseña corta", () => {
		const error = { message: "Password should be at least 6 characters." };
		expect(getAuthErrorMessage(error)).toBe("La contraseña debe tener al menos 6 caracteres.");
	});

	it("traduce error de sesión expirada o faltante", () => {
		const error = { message: "Auth session missing!" };
		expect(getAuthErrorMessage(error)).toBe("La sesión de seguridad ha expirado. Por favor, solicita un nuevo enlace de recuperación.");
	});

	it("traduce credenciales incorrectas", () => {
		const error = { message: "Invalid login credentials" };
		expect(getAuthErrorMessage(error)).toBe("Correo electrónico o contraseña incorrectos.");
	});

	it("traduce límite de tasa / rate limit", () => {
		const error = { message: "For security purposes, you can only request this once every 60 seconds" };
		expect(getAuthErrorMessage(error)).toBe("Demasiadas solicitudes en poco tiempo. Por seguridad, espera unos minutos antes de intentar de nuevo.");
	});

	it("mantiene mensajes que ya vienen en español", () => {
		const error = { message: "Las contraseñas no coinciden" };
		expect(getAuthErrorMessage(error)).toBe("Las contraseñas no coinciden");
	});

	it("maneja errores desconocidos o nulos sin fallar", () => {
		expect(getAuthErrorMessage(null)).toBe("Ha ocurrido un error inesperado. Por favor, intenta nuevamente.");
	});
});

