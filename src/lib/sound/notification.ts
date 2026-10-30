// Utilidad de audio para notificaciones de mensajes
// Genera sonidos mediante Web Audio API sin dependencias de red ni archivos externos

const STORAGE_KEY_INTERNAL_CHAT = "wacrm:sound:internal-chat:enabled";
const STORAGE_KEY_INBOX = "wacrm:sound:inbox:enabled";
const LEGACY_STORAGE_KEY_MUTED = "wacrm:internal-chat:sound-muted";

/**
 * Consulta si el sonido para chat interno está habilitado.
 */
export function isInternalChatSoundEnabled(): boolean {
	if (typeof window === "undefined") return false;
	try {
		if (localStorage.getItem(LEGACY_STORAGE_KEY_MUTED) === "true") return false;
		const val = localStorage.getItem(STORAGE_KEY_INTERNAL_CHAT);
		return val !== "false";
	} catch {
		return true;
	}
}

/**
 * Configura la preferencia de sonido para chat interno.
 */
export function setInternalChatSoundEnabled(enabled: boolean): void {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(STORAGE_KEY_INTERNAL_CHAT, enabled ? "true" : "false");
		if (enabled) {
			localStorage.removeItem(LEGACY_STORAGE_KEY_MUTED);
		} else {
			localStorage.setItem(LEGACY_STORAGE_KEY_MUTED, "true");
		}
		window.dispatchEvent(
			new CustomEvent("wacrm:sound-settings-changed", {
				detail: { channel: "internal-chat", enabled },
			})
		);
	} catch {
		// Silencioso
	}
}

/**
 * Consulta si el sonido para bandeja de entrada (WhatsApp) está habilitado.
 */
export function isInboxSoundEnabled(): boolean {
	if (typeof window === "undefined") return false;
	try {
		const val = localStorage.getItem(STORAGE_KEY_INBOX);
		return val !== "false";
	} catch {
		return true;
	}
}

/**
 * Configura la preferencia de sonido para bandeja de entrada (WhatsApp).
 */
export function setInboxSoundEnabled(enabled: boolean): void {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(STORAGE_KEY_INBOX, enabled ? "true" : "false");
		window.dispatchEvent(
			new CustomEvent("wacrm:sound-settings-changed", {
				detail: { channel: "inbox", enabled },
			})
		);
	} catch {
		// Silencioso
	}
}

// Retrocompatibilidad con funciones previas de mute general
export function isSoundMuted(): boolean {
	return !isInternalChatSoundEnabled();
}

export function setSoundMuted(muted: boolean): void {
	setInternalChatSoundEnabled(!muted);
}

// Variables para deduplicar reproducciones simultaneas
let lastInternalChatSoundTime = 0;
let lastInboxSoundTime = 0;

/**
 * Sonido para Chat Interno:
 * Doble tono armónico brillante y campana ascendente (E5 ~659Hz -> B5 ~988Hz).
 * Utilizado para mensajes entre miembros del equipo.
 */
export function playInternalChatSound(): void {
	if (typeof window === "undefined") return;

	try {
		if (!isInternalChatSoundEnabled()) return;

		const nowTime = Date.now();
		if (nowTime - lastInternalChatSoundTime < 350) return;
		lastInternalChatSoundTime = nowTime;

		const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
		if (!AudioContextClass) return;

		const ctx = new AudioContextClass();
		if (ctx.state === "suspended") {
			ctx.resume();
		}

		const now = ctx.currentTime;

		// Tono 1: Armónico inicial (E5 ~ 659.25 Hz)
		const osc1 = ctx.createOscillator();
		const gain1 = ctx.createGain();
		osc1.type = "sine";
		osc1.frequency.setValueAtTime(659.25, now);
		gain1.gain.setValueAtTime(0.08, now);
		gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
		osc1.connect(gain1);
		gain1.connect(ctx.destination);
		osc1.start(now);
		osc1.stop(now + 0.16);

		// Tono 2: Nota campana principal (B5 ~ 987.77 Hz)
		const osc2 = ctx.createOscillator();
		const gain2 = ctx.createGain();
		osc2.type = "sine";
		osc2.frequency.setValueAtTime(987.77, now + 0.06);
		gain2.gain.setValueAtTime(0.12, now + 0.06);
		gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
		osc2.connect(gain2);
		gain2.connect(ctx.destination);
		osc2.start(now + 0.06);
		osc2.stop(now + 0.35);
	} catch {
		// Restricción de autoplay mitigada
	}
}

/**
 * Sonido para Bandeja de Entrada (Inbox / WhatsApp):
 * Sonido distintivo percusivo y suave tipo "burbuja / pop de agua".
 * Se caracteriza por un barrido rápido ascendente (360Hz -> 740Hz) de breve duración (70ms),
 * seguido de una segunda micro-burbuja de resonancia más aguda (520Hz -> 920Hz).
 * Es orgánico, dulce, no molesto y se diferencia inmediatamente de la campana metálica de chat interno.
 */
export function playInboxSound(): void {
	if (typeof window === "undefined") return;

	try {
		if (!isInboxSoundEnabled()) return;

		const nowTime = Date.now();
		if (nowTime - lastInboxSoundTime < 300) return;
		lastInboxSoundTime = nowTime;

		const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
		if (!AudioContextClass) return;

		const ctx = new AudioContextClass();
		if (ctx.state === "suspended") {
			ctx.resume();
		}

		const now = ctx.currentTime;

		// Pop 1: Burbuja principal suave con barrido rápido ascendente
		const osc1 = ctx.createOscillator();
		const gain1 = ctx.createGain();
		osc1.type = "sine";
		osc1.frequency.setValueAtTime(360, now);
		if (typeof osc1.frequency.exponentialRampToValueAtTime === "function") {
			osc1.frequency.exponentialRampToValueAtTime(740, now + 0.04);
		} else {
			osc1.frequency.setValueAtTime(740, now + 0.04);
		}
		gain1.gain.setValueAtTime(0.11, now);
		gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);
		osc1.connect(gain1);
		gain1.connect(ctx.destination);
		osc1.start(now);
		osc1.stop(now + 0.075);

		// Pop 2: Segunda micro-burbuja dulce de resonancia acústica (+45ms)
		const osc2 = ctx.createOscillator();
		const gain2 = ctx.createGain();
		osc2.type = "sine";
		osc2.frequency.setValueAtTime(520, now + 0.045);
		if (typeof osc2.frequency.exponentialRampToValueAtTime === "function") {
			osc2.frequency.exponentialRampToValueAtTime(920, now + 0.08);
		} else {
			osc2.frequency.setValueAtTime(920, now + 0.08);
		}
		gain2.gain.setValueAtTime(0.09, now + 0.045);
		gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
		osc2.connect(gain2);
		gain2.connect(ctx.destination);
		osc2.start(now + 0.045);
		osc2.stop(now + 0.12);
	} catch {
		// Restricción de autoplay mitigada
	}
}

// Alias de retrocompatibilidad
export const playNotificationSound = playInternalChatSound;
