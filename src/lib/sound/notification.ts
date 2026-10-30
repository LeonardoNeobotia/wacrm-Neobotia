// Utilidad de audio para notificaciones de mensajes
// Genera sonidos cristalinos mediante Web Audio API sin dependencias de red ni archivos externos

const STORAGE_KEY = "wacrm:internal-chat:sound-muted";

export function isSoundMuted(): boolean {
	if (typeof window === "undefined") return false;
	try {
		return localStorage.getItem(STORAGE_KEY) === "true";
	} catch {
		return false;
	}
}

export function setSoundMuted(muted: boolean): void {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(STORAGE_KEY, muted ? "true" : "false");
	} catch {
		// Silencioso
	}
}

// Variables para deduplicar reproducciones simultaneas (evita eco si varios listeners capturan el mismo evento)
let lastInternalChatSoundTime = 0;
let lastInboxSoundTime = 0;

/**
 * Sonido para Chat Interno:
 * Doble tono armonico brillante y energico (E5 ~659Hz -> B5 ~988Hz).
 * Utilizado para mensajes entre miembros del equipo.
 */
export function playInternalChatSound(): void {
	if (typeof window === "undefined") return;

	try {
		if (isSoundMuted()) return;

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

		// Tono 1: Armonico inicial (E5 ~ 659.25 Hz)
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
		// Restriccion de autoplay del navegador mitigada
	}
}

/**
 * Sonido para Bandeja de Entrada (Inbox / WhatsApp):
 * Sonido distintivo suave tipo gota de agua con micro-barrido y campana cristalina (A4 440Hz -> D5 587Hz -> A5 880Hz).
 * Agradable, sutil, de tono calido y perfectamente distinguible del chat interno.
 */
export function playInboxSound(): void {
	if (typeof window === "undefined") return;

	try {
		if (isSoundMuted()) return;

		const nowTime = Date.now();
		if (nowTime - lastInboxSoundTime < 350) return;
		lastInboxSoundTime = nowTime;

		const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
		if (!AudioContextClass) return;

		const ctx = new AudioContextClass();
		if (ctx.state === "suspended") {
			ctx.resume();
		}

		const now = ctx.currentTime;

		// Tono 1: Suave gota organica con sutil elevacion (440 Hz -> 587.33 Hz)
		const osc1 = ctx.createOscillator();
		const gain1 = ctx.createGain();
		osc1.type = "sine";
		osc1.frequency.setValueAtTime(440.00, now);
		osc1.frequency.exponentialRampToValueAtTime(587.33, now + 0.06);
		gain1.gain.setValueAtTime(0.08, now);
		gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
		osc1.connect(gain1);
		gain1.connect(ctx.destination);
		osc1.start(now);
		osc1.stop(now + 0.16);

		// Tono 2: Nota campana resolutiva dulce y brillante (A5 ~ 880.00 Hz)
		const osc2 = ctx.createOscillator();
		const gain2 = ctx.createGain();
		osc2.type = "sine";
		osc2.frequency.setValueAtTime(880.00, now + 0.05);
		gain2.gain.setValueAtTime(0.09, now + 0.05);
		gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
		osc2.connect(gain2);
		gain2.connect(ctx.destination);
		osc2.start(now + 0.05);
		osc2.stop(now + 0.28);
	} catch {
		// Restriccion de autoplay del navegador mitigada
	}
}

// Alias de retrocompatibilidad
export const playNotificationSound = playInternalChatSound;
