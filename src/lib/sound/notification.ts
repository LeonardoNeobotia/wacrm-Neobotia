// Utilidad de audio para notificaciones de mensajes
// Genera un sonido cristalino de doble tono mediante Web Audio API sin dependencias de red

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

export function playNotificationSound(): void {
	if (typeof window === "undefined") return;

	try {
		if (isSoundMuted()) return;

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
