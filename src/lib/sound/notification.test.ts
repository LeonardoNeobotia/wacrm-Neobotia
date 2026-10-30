import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
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
		clear: () => storage.clear(),
	};

	beforeEach(() => {
		vi.useFakeTimers();
		storage.clear();
		vi.stubGlobal("localStorage", mockLocalStorage);
		vi.stubGlobal("window", {
			localStorage: mockLocalStorage,
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("manages mute state in localStorage", () => {
		expect(isSoundMuted()).toBe(false);
		setSoundMuted(true);
		expect(isSoundMuted()).toBe(true);
		setSoundMuted(false);
		expect(isSoundMuted()).toBe(false);
	});

	it("does not throw when AudioContext is missing", () => {
		vi.setSystemTime(new Date(2030, 1, 1, 10, 0, 0));
		expect(() => playInternalChatSound()).not.toThrow();
		vi.setSystemTime(new Date(2030, 1, 1, 10, 1, 0));
		expect(() => playInboxSound()).not.toThrow();
		vi.setSystemTime(new Date(2030, 1, 1, 10, 2, 0));
		expect(() => playNotificationSound()).not.toThrow();
	});

	it("synthesizes sound when AudioContext is present", () => {
		const mockCreateOscillator = vi.fn().mockReturnValue({
			type: "sine",
			frequency: { setValueAtTime: vi.fn() },
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

		setSoundMuted(false);
		vi.setSystemTime(new Date(2030, 1, 1, 12, 0, 10));
		playInternalChatSound();
		expect(mockCreateOscillator).toHaveBeenCalled();
		expect(mockCreateGain).toHaveBeenCalled();

		// Probar que Inbox sound también sintetiza notas
		mockCreateOscillator.mockClear();
		mockCreateGain.mockClear();
		vi.setSystemTime(new Date(2030, 1, 1, 12, 0, 15));
		playInboxSound();
		expect(mockCreateOscillator).toHaveBeenCalled();
		expect(mockCreateGain).toHaveBeenCalled();

		// Respetar mute
		mockCreateOscillator.mockClear();
		setSoundMuted(true);
		vi.setSystemTime(new Date(2030, 1, 1, 12, 0, 20));
		playInternalChatSound();
		expect(mockCreateOscillator).not.toHaveBeenCalled();
	});
});
