import { describe, it, expect } from "vitest";
import { validatePasswordStrength } from "./password-validation";

describe("validatePasswordStrength", () => {
	it("rechaza contraseñas con menos de 8 caracteres", () => {
		const res = validatePasswordStrength("123456");
		expect(res.isValid).toBe(false);
		expect(res.error).toBe("La contraseña debe tener al menos 8 caracteres.");
	});

	it("rechaza contraseñas de solo números aunque tengan 8 caracteres", () => {
		const res = validatePasswordStrength("12345678");
		expect(res.isValid).toBe(false);
		expect(res.error).toBe("La contraseña debe incluir al menos una letra mayúscula.");
	});

	it("rechaza contraseñas sin minúsculas", () => {
		const res = validatePasswordStrength("ABCDEF123");
		expect(res.isValid).toBe(false);
		expect(res.error).toBe("La contraseña debe incluir al menos una letra minúscula.");
	});

	it("rechaza contraseñas sin números", () => {
		const res = validatePasswordStrength("Abcdefgh");
		expect(res.isValid).toBe(false);
		expect(res.error).toBe("La contraseña debe incluir al menos un número.");
	});

	it("acepta contraseñas que cumplen todos los requisitos", () => {
		const res = validatePasswordStrength("Password123");
		expect(res.isValid).toBe(true);
		expect(res.error).toBeNull();
	});
});

