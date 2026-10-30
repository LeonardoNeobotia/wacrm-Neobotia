import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
	isInternalChatSoundEnabled,
	setInternalChatSoundEnabled,
	isInboxSoundEnabled,
	setInboxSoundEnabled,
	isSoundMuted,
	setSoundMuted,
	playInternalChatSound,
	playInboxSound,
	playNotificationSound,
} from "./notification";

describe("sound notifications", () => {
	const storage = new Map<string, string>();
	const mockLocalStorage = {
		getItem: (key: string) => storage.get(key) ?? null,
		setItem: (key: string, val: string) => storage.set(key, val),
		removeItem: (key: string) => storage.delete(key),
		clear: () => storage.clear(),
	};

	beforeEach(() => {
		vi.useFakeTimers();
		storage.clear();
		vi.stubGlobal("localStorage", mockLocalStorage);
		vi.stubGlobal("window", {
			localStorage: mockLocalStorage,
			dispatchEvent: vi.fn(),
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("manages separate internal chat and inbox states in localStorage", () => {
		expect(isInternalChatSoundEnabled()).toBe(true);
		expect(isInboxSoundEnabled()).toBe(true);

		setInternalChatSoundEnabled(false);
		expect(isInternalChatSoundEnabled()).toBe(false);
		expect(isInboxSoundEnabled()).toBe(true);

		setInboxSoundEnabled(false);
		expect(isInboxSoundEnabled()).toBe(false);

		setInternalChatSoundEnabled(true);
		expect(isInternalChatSoundEnabled()).toBe(true);
		expect(isInboxSoundEnabled()).toBe(false);
	});

	it("maintains backwards compatibility with isSoundMuted and setSoundMuted", () => {
		expect(isSoundMuted()).toBe(false);
		setSoundMuted(true);
		expect(isSoundMuted()).toBe(true);
		expect(isInternalChatSoundEnabled()).toBe(false);
		setSoundMuted(false);
		expect(isSoundMuted()).toBe(false);
		expect(isInternalChatSoundEnabled()).toBe(true);
	});

	it("does not throw when AudioContext is missing", () => {
		vi.setSystemTime(new Date(2030, 1, 1, 10, 0, 0));
		expect(() => playInternalChatSound()).not.toThrow();
		vi.setSystemTime(new Date(2030, 1, 1, 10, 1, 0));
		expect(() => playInboxSound()).not.toThrow();
		vi.setSystemTime(new Date(2030, 1, 1, 10, 2, 0));
		expect(() => playNotificationSound()).not.toThrow();
	});

	it("synthesizes sound when AudioContext is present and respects individual channel switches", () => {
		const mockCreateOscillator = vi.fn().mockReturnValue({
			type: "sine",
			frequency: {
				setValueAtTime: vi.fn(),
				exponentialRampToValueAtTime: vi.fn(),
			},
			connect: vi.fn(),
			start: vi.fn(),
			stop: vi.fn(),
		});

		const mockCreateGain = vi.fn().mockReturnValue({
			gain: {
				setValueAtTime: vi.fn(),
				exponentialRampToValueAtTime: vi.fn(),
			},
			connect: vi.fn(),
		});

		class MockAudioContext {
			state = "running";
			currentTime = 10;
			destination = {};
			createOscillator = mockCreateOscillator;
			createGain = mockCreateGain;
			resume = vi.fn();
		}

		(globalThis as any).window.AudioContext = MockAudioContext;

		setInternalChatSoundEnabled(true);
		setInboxSoundEnabled(true);

		// 1. Chat interno habilitado
		vi.setSystemTime(new Date(2030, 1, 1, 12, 0, 10));
		playInternalChatSound();
		expect(mockCreateOscillator).toHaveBeenCalled();
		expect(mockCreateGain).toHaveBeenCalled();

		// 2. Inbox habilitado
		mockCreateOscillator.mockClear();
		mockCreateGain.mockClear();
		vi.setSystemTime(new Date(2030, 1, 1, 12, 0, 15));
		playInboxSound();
		expect(mockCreateOscillator).toHaveBeenCalled();
		expect(mockCreateGain).toHaveBeenCalled();

		// 3. Desactivar solo chat interno
		setInternalChatSoundEnabled(false);
		mockCreateOscillator.mockClear();
		vi.setSystemTime(new Date(2030, 1, 1, 12, 0, 20));
		playInternalChatSound();
		expect(mockCreateOscillator).not.toHaveBeenCalled();

		// Inbox sigue funcionando
		vi.setSystemTime(new Date(2030, 1, 1, 12, 0, 25));
		playInboxSound();
		expect(mockCreateOscillator).toHaveBeenCalled();

		// 4. Desactivar también inbox
		setInboxSoundEnabled(false);
		mockCreateOscillator.mockClear();
		vi.setSystemTime(new Date(2030, 1, 1, 12, 0, 30));
		playInboxSound();
		expect(mockCreateOscillator).not.toHaveBeenCalled();
	});
});
