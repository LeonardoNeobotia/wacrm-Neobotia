"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { uploadAccountMedia } from "@/lib/storage/upload-media";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
	Send,
	Paperclip,
	Smile,
	Users,
	User,
	Info,
	CheckCheck,
	Check,
	Clock,
	ArrowLeft,
	Loader2,
	FileText,
	Download,
	MessageSquare,
	Trash2,
	MoreVertical,
	LogOut,
	Pencil,
	AlertCircle,
	Volume2,
	VolumeX,
	ListTodo,
	Mic,
	Video,
	X,
} from "lucide-react";
import type { InternalChat, InternalMessage, InternalMessageType } from "@/types";
import { usePresence } from "@/hooks/use-presence";
import { PresenceDot } from "@/components/presence/presence-dot";
import {
	playInternalChatSound,
	isSoundMuted,
	setSoundMuted,
} from "@/lib/sound/notification";
import { ChatInfoDialog } from "./chat-info-dialog";
import { InternalChatSidePanel } from "./internal-chat-side-panel";

// Formatea tiempo relativo amigable en espanol para la ultima conexion
function formatSpanishLastSeen(lastSeenAt: string | null | undefined, now: number): string {
	if (!lastSeenAt) return "hace un momento";
	const last = new Date(lastSeenAt).getTime();
	if (Number.isNaN(last)) return "hace un momento";

	const diff = Math.max(0, now - last);
	const mins = Math.floor(diff / 60_000);
	if (mins < 1) return "hace un momento";
	if (mins === 1) return "hace 1 min";
	if (mins < 60) return `hace ${mins} min`;

	const hours = Math.floor(mins / 60);
	if (hours === 1) return "hace 1 h";
	if (hours < 24) return `hace ${hours} h`;

	const days = Math.floor(hours / 24);
	if (days === 1) return "ayer";
	return `hace ${days} d`;
}

const EMOJI_LIST = [
	"👍",
	"❤️",
	"😊",
	"🔥",
	"🎉",
	"👏",
	"✅",
	"🚀",
	"👀",
	"🤝",
	"🙌",
	"💯",
	"🙏",
	"⭐",
	"💼",
	"📞",
];

// Asigna un color consistente al nombre de cada remitente en los grupos
const SENDER_COLORS = [
	"#3b82f6",
	"#10b981",
	"#f59e0b",
	"#8b5cf6",
	"#ec4899",
	"#06b6d4",
	"#f97316",
];

function getSenderColor(name: string) {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = name.charCodeAt(i) + ((hash << 5) - hash);
	}
	const index = Math.abs(hash) % SENDER_COLORS.length;
	return SENDER_COLORS[index];
}

interface OutboundQueueItem {
	tempId: string;
	text: string;
	messageType: InternalMessageType;
	fileUrl?: string;
	fileName?: string;
	fileSize?: number;
}

interface InternalChatThreadProps {
	chat: InternalChat | null;
	onBack?: () => void;
	onChatUpdated?: () => void;
}

export function InternalChatThread({
	chat,
	onBack,
	onChatUpdated,
}: InternalChatThreadProps) {
	const { user, profile, accountId } = useAuth();
	const { getPresence, getRow, now } = usePresence();
	const [messages, setMessages] = useState<InternalMessage[]>([]);
	const [loading, setLoading] = useState(false);
	const [inputText, setInputText] = useState("");
	const [uploading, setUploading] = useState(false);
	const [infoOpen, setInfoOpen] = useState(false);
	const [sidePanelOpen, setSidePanelOpen] = useState(false);
	const [pendingTasksCount, setPendingTasksCount] = useState(0);
	const [respondingInvitation, setRespondingInvitation] = useState(false);
	const [muted, setMuted] = useState(() => isSoundMuted());
	const [typingUsers, setTypingUsers] = useState<Map<string, { fullName: string; timestamp: number }>>(new Map());

	// Grabación de mensajes de voz
	const [isRecordingVoice, setIsRecordingVoice] = useState(false);
	const [recordingDuration, setRecordingDuration] = useState(0);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const opusRecorderRef = useRef<any>(null);
	const isCancelledRecordingRef = useRef<boolean>(false);
	const audioChunksRef = useRef<Blob[]>([]);
	const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

	const messagesEndRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Canal de Realtime para transmision broadcast instantanea
	const chatChannelRef = useRef<any>(null);

	// Control de emision de estado escribiendo (typing)
	const lastTypingBroadcastRef = useRef<number>(0);
	const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Cola de mensajes salientes para envio secuencial y preciso
	const outboundQueueRef = useRef<OutboundQueueItem[]>([]);
	const isProcessingQueueRef = useRef(false);

	// Desplazar al ultimo mensaje
	const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
		messagesEndRef.current?.scrollIntoView({ behavior });
	}, []);

	// Sincronizar mensajes recientes con la base de datos (con bypass de cache garantizado)
	const syncRecentMessages = useCallback(async () => {
		if (!chat?.id) return;
		try {
			const res = await fetch(`/api/internal-chat/${chat.id}/messages?_t=${Date.now()}`, {
				cache: "no-store",
				headers: {
					"Cache-Control": "no-cache, no-store, must-revalidate",
					Pragma: "no-cache",
				},
			});
			if (res.ok) {
				const data = await res.json();
				const freshMsgs: InternalMessage[] = data.messages || [];
				setMessages((prev) => {
					// Identificar mensajes temporales que siguen en proceso de envio
					const tempMsgs = prev.filter(
						(m) => m.id.startsWith("temp-") || m.status === "sending"
					);
					const prevPersisted = prev.filter(
						(m) => !m.id.startsWith("temp-") && m.status !== "sending"
					);

					// Comparacion rapida para evitar re-renders si la lista es identica
					const isIdentical =
						prevPersisted.length === freshMsgs.length &&
						prevPersisted.every((pm, idx) => pm.id === freshMsgs[idx]?.id);

					if (isIdentical && tempMsgs.length === 0) {
						return prev;
					}

					// Descartar temporales que ya fueron confirmados en freshMsgs
					const unconfirmedTemps = tempMsgs.filter(
						(tm) =>
							!freshMsgs.some(
								(fm) => fm.sender_id === tm.sender_id && fm.text === tm.text
							)
					);

					if (freshMsgs.length > prevPersisted.length) {
						setTimeout(() => scrollToBottom("smooth"), 50);
					}

					return [...freshMsgs, ...unconfirmedTemps];
				});
			}
		} catch {
			// Silencioso
		}
	}, [chat?.id, user?.id, scrollToBottom]);

	const syncMessagesRef = useRef(syncRecentMessages);
	useEffect(() => {
		syncMessagesRef.current = syncRecentMessages;
	}, [syncRecentMessages]);

	// Limpieza periodica de indicadores de escritura que hayan expirado (>3.5s)
	useEffect(() => {
		const timer = setInterval(() => {
			const currentTime = Date.now();
			setTypingUsers((prev) => {
				let changed = false;
				const next = new Map(prev);
				for (const [uid, item] of prev.entries()) {
					if (currentTime - item.timestamp > 3500) {
						next.delete(uid);
						changed = true;
					}
				}
				return changed ? next : prev;
			});
		}, 1000);

		return () => clearInterval(timer);
	}, []);

	// Cargar mensajes cuando cambia el chat
	useEffect(() => {
		if (!chat?.id) {
			setMessages([]);
			setTypingUsers(new Map());
			return;
		}

		let isMounted = true;
		setLoading(true);
		setTypingUsers(new Map());

		async function fetchMessages() {
			try {
				const res = await fetch(`/api/internal-chat/${chat!.id}/messages?_t=${Date.now()}`, {
					cache: "no-store",
					headers: {
						"Cache-Control": "no-cache, no-store, must-revalidate",
						Pragma: "no-cache",
					},
				});
				if (res.ok) {
					const data = await res.json();
					if (isMounted) {
						setMessages(data.messages || []);
						setTimeout(() => scrollToBottom("auto"), 50);
					}
				}
			} catch (err) {
				console.error("Error al cargar mensajes:", err);
			} finally {
				if (isMounted) setLoading(false);
			}
		}

		fetchMessages();

		// Marcar como leido
		if (chat.my_membership?.status === "accepted") {
			fetch(`/api/internal-chat/${chat.id}/read`, { method: "POST" });
		}

		return () => {
			isMounted = false;
		};
	}, [chat?.id, scrollToBottom]);

	// Suscribirse a mensajes en tiempo real via Supabase Realtime (Broadcast + postgres_changes)
	useEffect(() => {
		if (!chat?.id) return;

		const supabase = createClient();
		let channelStatus = "CLOSED";

		// Canal del hilo del chat (para mensajes instantaneos entre participantes)
		const threadChannel = supabase.channel(`internal-chat-thread:${chat.id}`, {
			config: { broadcast: { ack: false, self: false } },
		});

		chatChannelRef.current = threadChannel;

		// Handler unificado para mensajes nuevos recibidos en tiempo real
		const handleIncomingMessage = async (newMsg: InternalMessage) => {
			if (!newMsg || !newMsg.id) return;

			// Limpiar indicador de escritura del remitente que acaba de mandar mensaje
			if (newMsg.sender_id) {
				setTypingUsers((prev) => {
					if (!prev.has(newMsg.sender_id!)) return prev;
					const next = new Map(prev);
					next.delete(newMsg.sender_id!);
					return next;
				});
			}

			// Resolver perfil del remitente si viene sin el
			if (newMsg.sender_id && !newMsg.sender_profile) {
				const { data: p } = await supabase
					.from("profiles")
					.select("user_id, full_name, avatar_url")
					.eq("user_id", newMsg.sender_id)
					.maybeSingle();
				if (p) newMsg.sender_profile = p;
			}

			setMessages((prev) => {
				// Si ya existe por id, ignorar
				if (prev.some((m) => m.id === newMsg.id)) return prev;

				// Si coincide con un mensaje temporal que este enviando el usuario actual
				const tempMatchIndex = prev.findIndex(
					(m) =>
						m.sender_id === newMsg.sender_id &&
						m.text === newMsg.text &&
						(m.id.startsWith("temp-") || m.status === "sending")
				);

				if (tempMatchIndex !== -1) {
					const copy = [...prev];
					copy[tempMatchIndex] = { ...newMsg, status: "sent" };
					return copy;
				}

				return [...prev, { ...newMsg, status: "sent" }];
			});

			// Si el mensaje es de otro usuario y tenemos el chat abierto, marcar como leido en la BD
			if (newMsg.sender_id !== user?.id) {
				fetch(`/api/internal-chat/${chat.id}/read`, { method: "POST" });
			}

			setTimeout(() => scrollToBottom("smooth"), 50);
		};

		// 1. Escucha por WebSockets Broadcast (ultra rapida e independiente de replicacion en BD)
		threadChannel
			.on("broadcast", { event: "new_message" }, ({ payload }) => {
				handleIncomingMessage(payload as InternalMessage);
			})
			.on("broadcast", { event: "delete_message" }, ({ payload }) => {
				const deletedId = (payload as { messageId?: string })?.messageId;
				if (deletedId) {
					setMessages((prev) => prev.filter((m) => m.id !== deletedId));
				}
			})
			.on("broadcast", { event: "typing" }, ({ payload }) => {
				if (!payload || payload.userId === user?.id) return;
				setTypingUsers((prev) => {
					const next = new Map(prev);
					if (payload.isTyping) {
						next.set(payload.userId, {
							fullName: payload.fullName || "Alguien",
							timestamp: Date.now(),
						});
					} else {
						next.delete(payload.userId);
					}
					return next;
				});
			});

		// 2. Escucha por postgres_changes (respaldo nativo por replicacion en BD)
		threadChannel
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "internal_messages",
					filter: `chat_id=eq.${chat.id}`,
				},
				(payload) => {
					handleIncomingMessage(payload.new as InternalMessage);
				}
			)
			.on(
				"postgres_changes",
				{
					event: "DELETE",
					schema: "public",
					table: "internal_messages",
					filter: `chat_id=eq.${chat.id}`,
				},
				(payload) => {
					const deletedId = (payload.old as any)?.id;
					if (deletedId) {
						setMessages((prev) => prev.filter((m) => m.id !== deletedId));
					}
				}
			);

		threadChannel.subscribe((status) => {
			channelStatus = status;
			if (status === "SUBSCRIBED") {
				syncMessagesRef.current?.();
			}
		});

		// Manejo de foco y cambio de pestana:
		// En navegadores con muchas pestanas, el browser puede desconectar el WebSocket o suspender timers.
		// Al regresar o enfocar la pestana, sincronizamos de inmediato y reanudamos la conexion si cayo.
		const handleFocusOrVisible = () => {
			syncMessagesRef.current?.();
			if (channelStatus !== "SUBSCRIBED") {
				try {
					threadChannel.subscribe((status) => {
						channelStatus = status;
					});
				} catch (err) {
					console.warn("Error reanudando canal de chat:", err);
				}
			}
		};

		window.addEventListener("focus", handleFocusOrVisible);
		document.addEventListener("visibilitychange", handleFocusOrVisible);

		return () => {
			window.removeEventListener("focus", handleFocusOrVisible);
			document.removeEventListener("visibilitychange", handleFocusOrVisible);
			supabase.removeChannel(threadChannel);
			chatChannelRef.current = null;
		};
	}, [chat?.id, user?.id, scrollToBottom]);

	// Sincronizacion periodica de respaldo discreta (cada 25s) solo si la ventana esta visible
	useEffect(() => {
		if (!chat?.id) return;

		const interval = setInterval(() => {
			if (typeof document !== "undefined" && document.hidden) return;
			syncMessagesRef.current?.();
		}, 25000);

		return () => {
			clearInterval(interval);
		};
	}, [chat?.id]);

	// Procesar cola secuencial de envio de mensajes
	const processOutboundQueue = useCallback(async () => {
		if (isProcessingQueueRef.current || !chat?.id) return;
		isProcessingQueueRef.current = true;

		while (outboundQueueRef.current.length > 0) {
			const item = outboundQueueRef.current[0];
			try {
				const res = await fetch(`/api/internal-chat/${chat.id}/messages`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						text: item.text,
						message_type: item.messageType,
						file_url: item.fileUrl,
						file_name: item.fileName,
						file_size: item.fileSize,
					}),
				});

				if (!res.ok) {
					const errData = await res.json();
					throw new Error(errData.error || "Error al enviar mensaje");
				}

				const data = await res.json();
				if (data.message) {
					setMessages((prev) =>
						prev.map((m) =>
							m.id === item.tempId || m.temp_id === item.tempId
								? { ...data.message, status: "sent" }
								: m
						)
					);

					// Transmitir inmediatamente via WebSockets a los participantes del chat
					try {
						chatChannelRef.current?.send({
							type: "broadcast",
							event: "new_message",
							payload: data.message,
						});
					} catch (e) {
						console.warn("Client broadcast fallback:", e);
					}

					// Notificar localmente para actualizar vista previa
					onChatUpdated?.();
				}
				outboundQueueRef.current.shift();
			} catch (err: any) {
				console.error("Error al procesar mensaje de cola:", err);
				setMessages((prev) =>
					prev.map((m) =>
						m.id === item.tempId ? { ...m, status: "error" } : m
					)
				);
				toast.error(err.message || "Error al enviar mensaje");
				outboundQueueRef.current.shift();
			}
		}

		isProcessingQueueRef.current = false;
		onChatUpdated?.();
	}, [chat?.id, onChatUpdated]);

	// Manejar cambio de texto en input y emitir typing debounced a companeros
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const val = e.target.value;
		setInputText(val);

		if (!chat?.id || !user?.id) return;

		const currentTime = Date.now();
		if (val.trim().length > 0) {
			if (currentTime - lastTypingBroadcastRef.current > 1500) {
				lastTypingBroadcastRef.current = currentTime;
				chatChannelRef.current?.send({
					type: "broadcast",
					event: "typing",
					payload: {
						userId: user.id,
						fullName: profile?.full_name || profile?.email || "Alguien",
						isTyping: true,
					},
				});
			}

			if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
			typingTimeoutRef.current = setTimeout(() => {
				chatChannelRef.current?.send({
					type: "broadcast",
					event: "typing",
					payload: { userId: user.id, isTyping: false },
				});
			}, 2500);
		} else {
			if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
			chatChannelRef.current?.send({
				type: "broadcast",
				event: "typing",
				payload: { userId: user.id, isTyping: false },
			});
		}
	};

	// Enviar mensaje con actualizacion optimista instantanea
	const handleSendMessage = () => {
		const textToSend = inputText.trim();
		if (!textToSend || !chat) return;

		// Notificar inmediatamente que se dejo de escribir
		if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
		chatChannelRef.current?.send({
			type: "broadcast",
			event: "typing",
			payload: { userId: user?.id, isTyping: false },
		});

		// Limpiar campo de texto inmediatamente para que el usuario pueda escribir el siguiente
		setInputText("");

		const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
		const optimisticMsg: InternalMessage = {
			id: tempId,
			temp_id: tempId,
			chat_id: chat.id,
			sender_id: user?.id || null,
			text: textToSend,
			message_type: "text",
			created_at: new Date().toISOString(),
			status: "sending",
			sender_profile: profile
				? {
						user_id: user?.id || profile.id,
						full_name: profile.full_name,
						avatar_url: profile.avatar_url,
				  }
				: undefined,
		};

		setMessages((prev) => [...prev, optimisticMsg]);
		setTimeout(() => scrollToBottom("smooth"), 30);

		outboundQueueRef.current.push({
			tempId,
			text: textToSend,
			messageType: "text",
		});

		processOutboundQueue();
	};

	// Subir y enviar archivo/imagen/video/audio
	const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file || !chat) return;

		setUploading(true);
		try {
			const isImage = file.type.startsWith("image/");
			const isVideo = file.type.startsWith("video/");
			const isAudio = file.type.startsWith("audio/");

			let mediaType: InternalMessageType = "file";
			let defaultText = file.name;

			if (isImage) {
				mediaType = "image";
				defaultText = "Imagen adjunta";
			} else if (isVideo) {
				mediaType = "video";
				defaultText = "Video adjunto";
			} else if (isAudio) {
				mediaType = "audio";
				defaultText = "Audio adjunto";
			}

			// Subir al bucket 'chat-media'
			const uploadResult = await uploadAccountMedia("chat-media", file);

			const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
			const optimisticMsg: InternalMessage = {
				id: tempId,
				temp_id: tempId,
				chat_id: chat.id,
				sender_id: user?.id || null,
				text: defaultText,
				message_type: mediaType,
				file_url: uploadResult.publicUrl,
				file_name: file.name,
				file_size: file.size,
				created_at: new Date().toISOString(),
				status: "sending",
				sender_profile: profile
					? {
							user_id: user?.id || profile.id,
							full_name: profile.full_name,
							avatar_url: profile.avatar_url,
					  }
					: undefined,
			};

			setMessages((prev) => [...prev, optimisticMsg]);
			setTimeout(() => scrollToBottom("smooth"), 30);

			outboundQueueRef.current.push({
				tempId,
				text: defaultText,
				messageType: mediaType,
				fileUrl: uploadResult.publicUrl,
				fileName: file.name,
				fileSize: file.size,
			});

			processOutboundQueue();
		} catch (err: any) {
			console.error("Error al adjuntar archivo:", err);
			toast.error(err.message || "Error al subir el archivo");
		} finally {
			setUploading(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	// Iniciar grabación de voz con opus-recorder (genera audio/ogg nativo compatible con chat-media y WhatsApp)
	const startVoiceRecording = async () => {
		if (uploading || isRecordingVoice) return;
		try {
			if (!navigator.mediaDevices?.getUserMedia) {
				toast.error("La grabación de voz no está soportada en este navegador.");
				return;
			}

			isCancelledRecordingRef.current = false;

			// Intentar usar opus-recorder para generar Ogg/Opus nativo (admitido por chat-media)
			try {
				const { default: Recorder } = await import("opus-recorder");
				const recorder = new Recorder({
					encoderPath: "/opus/encoderWorker.min.js",
					numberOfChannels: 1,
					encoderApplication: 2048,
					encoderSampleRate: 48000,
					streamPages: false,
				});

				recorder.ondataavailable = async (bytes: Uint8Array) => {
					if (isCancelledRecordingRef.current) return;
					const audioFile = new File([bytes as unknown as BlobPart], `voice_${Date.now()}.ogg`, {
						type: "audio/ogg",
					});
					await sendVoiceMessage(audioFile);
				};

				opusRecorderRef.current = recorder;
				await recorder.start();
				setIsRecordingVoice(true);
				setRecordingDuration(0);
				recordingTimerRef.current = setInterval(() => {
					setRecordingDuration((prev) => prev + 1);
				}, 1000);
				return;
			} catch (opusErr) {
				console.warn("opus-recorder no disponible, intentando con MediaRecorder nativo:", opusErr);
			}

			// Fallback a MediaRecorder estándar
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			const mimeType = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
				? "audio/ogg;codecs=opus"
				: MediaRecorder.isTypeSupported("audio/mp4")
				? "audio/mp4"
				: "audio/ogg";

			const mediaRecorder = new MediaRecorder(stream);
			audioChunksRef.current = [];

			mediaRecorder.ondataavailable = (e) => {
				if (e.data.size > 0) audioChunksRef.current.push(e.data);
			};

			mediaRecorder.onstop = async () => {
				stream.getTracks().forEach((track) => track.stop());
				if (isCancelledRecordingRef.current || audioChunksRef.current.length === 0) return;
				const audioBlob = new Blob(audioChunksRef.current, { type: "audio/ogg" });
				const audioFile = new File([audioBlob], `voice_${Date.now()}.ogg`, {
					type: "audio/ogg",
				});
				await sendVoiceMessage(audioFile);
			};

			mediaRecorderRef.current = mediaRecorder;
			mediaRecorder.start(250);
			setIsRecordingVoice(true);
			setRecordingDuration(0);
			recordingTimerRef.current = setInterval(() => {
				setRecordingDuration((prev) => prev + 1);
			}, 1000);
		} catch (err: any) {
			console.error("Error al iniciar grabación de voz:", err);
			toast.error("No se pudo acceder al micrófono. Verifica los permisos del navegador.");
		}
	};

	// Detener grabación de voz y enviar
	const stopVoiceRecording = () => {
		if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
		setIsRecordingVoice(false);
		if (opusRecorderRef.current) {
			void opusRecorderRef.current.stop().catch(() => {});
		} else if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
			mediaRecorderRef.current.stop();
		}
	};

	// Cancelar grabación de voz sin enviar
	const cancelVoiceRecording = () => {
		isCancelledRecordingRef.current = true;
		if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
		audioChunksRef.current = [];
		setIsRecordingVoice(false);
		if (opusRecorderRef.current) {
			void opusRecorderRef.current.stop().catch(() => {});
		} else if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
			mediaRecorderRef.current.stop();
		}
		toast.info("Grabación cancelada");
	};

	// Enviar mensaje de voz grabado
	const sendVoiceMessage = async (file: File) => {
		if (!chat) return;
		setUploading(true);
		try {
			const uploadResult = await uploadAccountMedia("chat-media", file);

			const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
			const optimisticMsg: InternalMessage = {
				id: tempId,
				temp_id: tempId,
				chat_id: chat.id,
				sender_id: user?.id || null,
				text: "Mensaje de voz",
				message_type: "audio",
				file_url: uploadResult.publicUrl,
				file_name: file.name,
				file_size: file.size,
				created_at: new Date().toISOString(),
				status: "sending",
				sender_profile: profile
					? {
							user_id: user?.id || profile.id,
							full_name: profile.full_name,
							avatar_url: profile.avatar_url,
					  }
					: undefined,
			};

			setMessages((prev) => [...prev, optimisticMsg]);
			setTimeout(() => scrollToBottom("smooth"), 30);

			outboundQueueRef.current.push({
				tempId,
				text: "Mensaje de voz",
				messageType: "audio",
				fileUrl: uploadResult.publicUrl,
				fileName: file.name,
				fileSize: file.size,
			});

			processOutboundQueue();
		} catch (err: any) {
			console.error("Error al enviar mensaje de voz:", err);
			toast.error(err.message || "Error al subir mensaje de voz");
		} finally {
			setUploading(false);
		}
	};

	// Eliminar un mensaje individual
	const handleDeleteMessage = async (messageId: string) => {
		if (!chat) return;

		// Eliminacion optimista inmediata
		setMessages((prev) => prev.filter((m) => m.id !== messageId));

		try {
			const res = await fetch(
				`/api/internal-chat/${chat.id}/messages/${messageId}`,
				{ method: "DELETE" }
			);

			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || "Error al eliminar mensaje");
			}

			toast.success("Mensaje eliminado");
			try {
				chatChannelRef.current?.send({
					type: "broadcast",
					event: "delete_message",
					payload: { messageId },
				});
			} catch {}
			onChatUpdated?.();
		} catch (err: any) {
			console.error("Error al eliminar mensaje:", err);
			toast.error(err.message || "Error al eliminar mensaje");
		}
	};

	// Responder a la invitacion (Aceptar / Rechazar)
	const handleRespondInvitation = async (action: "accept" | "decline") => {
		if (!chat) return;
		setRespondingInvitation(true);
		try {
			const res = await fetch(`/api/internal-chat/${chat.id}/respond`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ action }),
			});

			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || "Error al procesar invitación");
			}

			toast.success(
				action === "accept"
					? "Invitación aceptada. ¡Ya puedes chatear!"
					: "Has rechazado la invitación"
			);
			onChatUpdated?.();
		} catch (err: any) {
			console.error("Error al responder invitacion:", err);
			toast.error(err.message || "Error al responder invitación");
		} finally {
			setRespondingInvitation(false);
		}
	};

	if (!chat) {
		return (
			<div className="flex h-full w-full flex-1 flex-col items-center justify-center p-8 text-center bg-muted/20">
				<div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
					<MessageSquare className="h-8 w-8" />
				</div>
				<h3 className="text-sm font-semibold text-foreground">
					Selecciona una conversación
				</h3>
				<p className="text-xs text-muted-foreground max-w-xs mt-1">
					Elige un chat o grupo de la lista para ver los mensajes y coordinar con tu equipo.
				</p>
			</div>
		);
	}

	const isGroup = chat.type === "group";
	const isPending = chat.my_membership?.status === "pending";
	const isMyChatAdmin = chat.my_membership?.role === "admin";
	const otherMember = chat.members?.find((m) => m.user_id !== user?.id);
	const displayName = isGroup
		? chat.name || "Grupo"
		: otherMember?.profile?.full_name || otherMember?.profile?.email || "Chat Directo";
	const initials = displayName.charAt(0).toUpperCase();

	// Presencia para chat directo
	const otherPresence = otherMember ? getPresence(otherMember.user_id) : "offline";
	const otherPresenceRow = otherMember ? getRow(otherMember.user_id) : undefined;

	// Presencia para grupos
	const acceptedMembers = (chat.members || []).filter((m) => m.status === "accepted");
	const onlineGroupMembers = acceptedMembers.filter((m) => {
		const s = getPresence(m.user_id);
		return s === "online" || s === "away";
	});

	// Estado y texto de escritura en tiempo real
	const typingList = Array.from(typingUsers.values());
	const isSomeoneTyping = typingList.length > 0;
	let typingText = "";
	if (isSomeoneTyping) {
		if (!isGroup) {
			typingText = "escribiendo...";
		} else if (typingList.length === 1) {
			typingText = `${typingList[0].fullName} está escribiendo...`;
		} else if (typingList.length === 2) {
			typingText = `${typingList[0].fullName} y ${typingList[1].fullName} están escribiendo...`;
		} else {
			typingText = "Varios están escribiendo...";
		}
	}

	return (
		<div className="flex h-full w-full flex-1 bg-background min-w-0 overflow-hidden">
			{/* Área principal de la conversación */}
			<div className="flex h-full flex-1 flex-col min-w-0 overflow-hidden">
				{/* Encabezado del chat a ancho completo */}
				<div className="flex h-14 w-full items-center justify-between border-b border-border bg-card px-4 shrink-0 shadow-xs">
					<div className="flex items-center gap-3 min-w-0 flex-1">
						{/* Botón volver en móvil */}
						{onBack && (
							<button
								type="button"
								onClick={onBack}
								className="lg:hidden p-1.5 -ml-1 rounded-md text-muted-foreground hover:bg-muted cursor-pointer"
							>
								<ArrowLeft className="h-5 w-5" />
							</button>
						)}

						{/* Avatar con presencia para chats directos */}
						<div className="relative shrink-0">
							<div
								onClick={() => setInfoOpen(true)}
								className="h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 cursor-pointer shadow-xs transition-transform hover:scale-105"
								style={{ backgroundColor: chat.color || "#10b981" }}
							>
								{isGroup ? <Users className="h-4 w-4" /> : initials}
							</div>
							{!isGroup && otherMember && (
								<PresenceDot
									status={otherPresence}
									className="absolute bottom-0 right-0 ring-2 ring-card size-2.5"
								/>
							)}
						</div>

						{/* Título y miembros / estado en línea / escribiendo */}
						<div
							onClick={() => setInfoOpen(true)}
							className="min-w-0 flex-1 cursor-pointer"
						>
							<h3 className="text-sm font-semibold text-foreground truncate flex items-center gap-1.5">
								{displayName}
							</h3>
							<div className="text-[11px] text-muted-foreground truncate">
								{isSomeoneTyping ? (
									<span className="text-emerald-600 dark:text-emerald-400 font-medium italic flex items-center gap-1.5 animate-pulse">
										<span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
										{typingText}
									</span>
								) : isGroup ? (
									<span className="flex items-center gap-1.5 truncate">
										<span>{acceptedMembers.length} integrantes</span>
										<span>·</span>
										<span className={onlineGroupMembers.length > 0 ? "text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1" : ""}>
											{onlineGroupMembers.length > 0 && <PresenceDot status="online" className="size-1.5" />}
											{onlineGroupMembers.length} en línea
										</span>
										{onlineGroupMembers.length > 0 && (
											<span className="hidden sm:inline text-[10px] text-muted-foreground truncate max-w-[220px]">
												({onlineGroupMembers.map((m) => m.profile?.full_name?.split(" ")[0] || m.profile?.email?.split("@")[0] || "Miembro").join(", ")})
											</span>
										)}
									</span>
								) : otherMember?.status === "pending" ? (
									<span className="text-amber-500 font-medium">Invitación pendiente</span>
								) : otherPresence === "online" ? (
									<span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1.5">
										<PresenceDot status="online" className="size-1.5" />
										En línea
									</span>
								) : otherPresence === "away" ? (
									<span className="text-amber-500 font-medium flex items-center gap-1.5">
										<PresenceDot status="away" className="size-1.5" />
										Ausente
									</span>
								) : (
									<span className="text-muted-foreground flex items-center gap-1.5">
										<PresenceDot status="offline" className="size-1.5" />
										{otherPresenceRow?.last_seen_at
											? `Últ. vez ${formatSpanishLastSeen(otherPresenceRow.last_seen_at, now)}`
											: "Desconectado"}
									</span>
								)}
							</div>
						</div>
					</div>

					{/* Acciones del encabezado */}
					<div className="flex items-center gap-1 shrink-0">
						{/* Botón Notas y Tareas */}
						<Button
							variant={sidePanelOpen ? "secondary" : "ghost"}
							size="sm"
							onClick={() => setSidePanelOpen((prev) => !prev)}
							className={`cursor-pointer h-9 px-2.5 gap-1.5 text-xs font-medium ${
								sidePanelOpen
									? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
									: "text-muted-foreground hover:text-foreground"
							}`}
							title="Notas y Tareas del equipo"
						>
							<ListTodo className="h-4 w-4" />
							<span className="hidden sm:inline">Notas & Tareas</span>
							{pendingTasksCount > 0 && (
								<span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white px-1">
									{pendingTasksCount}
								</span>
							)}
						</Button>

						{/* Silenciar / Activar sonido de notificaciones */}
						<button
							type="button"
							onClick={() => {
								const next = !muted;
								setMuted(next);
								setSoundMuted(next);
								if (!next) {
									playInternalChatSound();
									toast.success("Sonido de notificaciones activado");
								} else {
									toast.info("Sonido de notificaciones silenciado");
								}
							}}
							className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
							title={muted ? "Activar sonido de notificaciones" : "Silenciar notificaciones"}
						>
							{muted ? (
								<VolumeX className="h-4 w-4 text-muted-foreground/60" />
							) : (
								<Volume2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
							)}
						</button>

						<Button
							variant="ghost"
							size="icon"
							onClick={() => setInfoOpen(true)}
							className="text-muted-foreground hover:text-foreground cursor-pointer h-9 w-9"
							title="Información del chat"
						>
							<Info className="h-4 w-4" />
						</Button>

						{/* Menú contextual */}
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button
										variant="ghost"
										size="icon"
										className="text-muted-foreground hover:text-foreground cursor-pointer h-9 w-9"
										title="Más opciones"
									/>
								}
							>
								<MoreVertical className="h-4 w-4" />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-48">
								<DropdownMenuItem
									onClick={() => setInfoOpen(true)}
									className="text-xs cursor-pointer gap-2"
								>
									<Info className="h-3.5 w-3.5 text-muted-foreground" />
									Información del chat
								</DropdownMenuItem>

								{isGroup && isMyChatAdmin && (
									<DropdownMenuItem
										onClick={() => setInfoOpen(true)}
										className="text-xs cursor-pointer gap-2"
									>
										<Pencil className="h-3.5 w-3.5 text-muted-foreground" />
										Editar grupo
									</DropdownMenuItem>
								)}

								<DropdownMenuSeparator />

								{isGroup && (
									<DropdownMenuItem
										onClick={() => setInfoOpen(true)}
										className="text-xs cursor-pointer gap-2 text-rose-600 dark:text-rose-400 focus:text-rose-600"
									>
										<LogOut className="h-3.5 w-3.5" />
										Salir del grupo
									</DropdownMenuItem>
								)}

								<DropdownMenuItem
									onClick={() => setInfoOpen(true)}
									className="text-xs cursor-pointer gap-2 text-rose-600 dark:text-rose-400 focus:text-rose-600"
								>
									<Trash2 className="h-3.5 w-3.5" />
									{isGroup ? "Eliminar grupo" : "Eliminar conversación"}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>
				</div>

				{/* Banner de Invitación Pendiente */}
				{isPending && (
					<div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs w-full shrink-0">
						<div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
							<Clock className="h-4 w-4 shrink-0" />
							<span>
								Has recibido una invitación para participar en este{" "}
								{isGroup ? "grupo" : "chat"}. Debes aceptarla para enviar mensajes.
							</span>
						</div>
						<div className="flex items-center gap-2 shrink-0">
							<Button
								size="sm"
								onClick={() => handleRespondInvitation("accept")}
								disabled={respondingInvitation}
								className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
							>
								{respondingInvitation ? (
									<Loader2 className="h-3 w-3 animate-spin mr-1" />
								) : (
									<Check className="h-3 w-3 mr-1" />
								)}
								Aceptar invitación
							</Button>
							<Button
								size="sm"
								variant="outline"
								onClick={() => handleRespondInvitation("decline")}
								disabled={respondingInvitation}
								className="h-7 text-xs border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
							>
								Rechazar
							</Button>
						</div>
					</div>
				)}

				{/* Área de Mensajes estilo WhatsApp Doodle */}
				<div className="flex-1 w-full overflow-y-auto overflow-x-hidden p-4 bg-background bg-[url('/inbox-doodle.svg')] bg-repeat space-y-3">
					{loading ? (
						<div className="flex h-full items-center justify-center">
							<Loader2 className="h-6 w-6 animate-spin text-primary" />
						</div>
					) : messages.length === 0 ? (
						<div className="flex h-full items-center justify-center">
							<div className="rounded-lg bg-card/80 backdrop-blur-xs px-4 py-2 border border-border/40 text-xs text-muted-foreground shadow-xs">
								No hay mensajes en esta conversación. ¡Di hola!
							</div>
						</div>
					) : (
						messages.map((msg) => {
							const isMe = msg.sender_id === user?.id;
							const isSystem = msg.message_type === "system";

							// Mensajes del sistema centrados
							if (isSystem) {
								return (
									<div key={msg.id} className="flex justify-center my-2">
										<div className="rounded-full bg-card/90 backdrop-blur-xs px-3 py-1 text-[11px] text-muted-foreground shadow-xs border border-border/40 text-center max-w-sm">
											{msg.text}
										</div>
									</div>
								);
							}

							const isVideo = msg.message_type === "video" || (!!msg.file_url && /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(msg.file_url));
							const isAudio = msg.message_type === "audio" || (!!msg.file_url && /\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i.test(msg.file_url) && !isVideo);
							const isImage = msg.message_type === "image" || (!!msg.file_url && /\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(msg.file_url) && !isVideo && !isAudio);
							const isGenericFile = (msg.message_type === "file" || (!isImage && !isVideo && !isAudio && !!msg.file_url)) && !isImage && !isVideo && !isAudio && !!msg.file_url;

							const senderName = msg.sender_profile?.full_name || "Compañero";
							const senderColor = getSenderColor(senderName);
							const timeStr = format(new Date(msg.created_at), "HH:mm");

							return (
								<div
									key={msg.id}
									className={`group flex items-center gap-1.5 w-full ${
										isMe ? "justify-end" : "justify-start"
									}`}
								>
									{/* Botón para eliminar mensaje en hover a la izquierda si el mensaje es mío */}
									{isMe && (isMe || isMyChatAdmin) && msg.status !== "sending" && (
										<button
											type="button"
											onClick={() => handleDeleteMessage(msg.id)}
											className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-muted/80 cursor-pointer shrink-0"
											title="Eliminar mensaje"
										>
											<Trash2 className="h-3.5 w-3.5" />
										</button>
									)}

									<div
										className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3.5 py-2 shadow-xs transition-all ${
											isMe
												? "bg-emerald-600 text-white rounded-tr-xs"
												: "bg-card text-foreground border border-border/50 rounded-tl-xs"
										}`}
									>
										{/* Nombre del remitente en grupos si es de otro */}
										{!isMe && isGroup && (
											<p
												className="text-[11px] font-bold mb-0.5 truncate"
												style={{ color: senderColor }}
											>
												{senderName}
											</p>
										)}

										{/* Imagen adjunta */}
										{isImage && msg.file_url && (
											<div className="mb-1.5 overflow-hidden rounded-lg">
												<img
													src={msg.file_url}
													alt="Adjunto"
													className="max-h-60 w-full object-cover cursor-pointer hover:opacity-95"
													onClick={() => window.open(msg.file_url!, "_blank")}
												/>
											</div>
										)}

										{/* Video adjunto con reproductor integrado */}
										{isVideo && msg.file_url && (
											<div className="mb-1.5 overflow-hidden rounded-lg bg-black/40 max-w-sm">
												<video
													src={msg.file_url}
													controls
													preload="metadata"
													className="max-h-64 w-full rounded-lg bg-black object-contain"
												/>
											</div>
										)}

										{/* Mensaje de voz con reproductor */}
										{isAudio && msg.file_url && (
											<div className={`mb-1.5 p-2 rounded-xl min-w-[220px] max-w-xs ${isMe ? "bg-emerald-700/60 text-white" : "bg-muted"}`}>
												<div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-medium opacity-90">
													<Mic className="h-3.5 w-3.5 text-emerald-300" />
													<span>Mensaje de voz</span>
												</div>
												<audio
													src={msg.file_url}
													controls
													preload="metadata"
													className="w-full h-8"
												/>
											</div>
										)}

										{/* Archivo adjunto genérico */}
										{isGenericFile && msg.file_url && (
											<a
												href={msg.file_url}
												target="_blank"
												rel="noopener noreferrer"
												className={`flex items-center gap-2 p-2 rounded-lg mb-1.5 ${
													isMe ? "bg-emerald-700/60 text-white" : "bg-muted"
												}`}
											>
												<FileText className="h-5 w-5 shrink-0" />
												<div className="truncate flex-1">
													<p className="text-xs font-medium truncate">
														{msg.file_name || "Archivo"}
													</p>
													{msg.file_size && (
														<p className="text-[10px] opacity-75">
															{(msg.file_size / 1024).toFixed(0)} KB
														</p>
													)}
												</div>
												<Download className="h-4 w-4 shrink-0 opacity-75" />
											</a>
										)}

										{/* Texto del mensaje */}
										{msg.text && (!isAudio || (msg.text !== "Mensaje de voz" && msg.text !== "Nota de voz")) && (!isVideo || (msg.text !== "Video adjunto" && msg.text !== "Video")) && (
											<p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
												{msg.text}
											</p>
										)}

										{/* Hora y estado de entrega estilo WhatsApp */}
										<div
											className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
												isMe ? "text-emerald-100" : "text-muted-foreground"
											}`}
										>
											<span>{timeStr}</span>
											{isMe && (
												msg.status === "sending" ? (
													<span title="Enviando...">
														<Clock className="h-3 w-3 animate-pulse text-emerald-200" />
													</span>
												) : msg.status === "error" ? (
													<span className="text-rose-300 font-semibold inline-flex items-center gap-0.5">
														<AlertCircle className="h-3 w-3" /> Error
													</span>
												) : (
													<span title="Entregado">
														<CheckCheck className="h-3.5 w-3.5 text-emerald-200" />
													</span>
												)
											)}
										</div>
									</div>

									{/* Botón para eliminar mensaje en hover a la derecha si es ajeno pero soy admin */}
									{!isMe && isMyChatAdmin && msg.status !== "sending" && (
										<button
											type="button"
											onClick={() => handleDeleteMessage(msg.id)}
											className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-muted/80 cursor-pointer shrink-0"
											title="Eliminar mensaje"
										>
											<Trash2 className="h-3.5 w-3.5" />
										</button>
									)}
								</div>
							);
						})
					)}
					<div ref={messagesEndRef} />
				</div>

				{/* Indicador visual de alguien escribiendo sobre la barra de entrada */}
				{isSomeoneTyping && (
					<div className="px-4 py-1.5 flex items-center gap-2 text-xs bg-muted/70 backdrop-blur-xs border-t border-border/50 text-emerald-600 dark:text-emerald-400 shrink-0">
						<div className="flex items-center gap-1">
							<span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0ms" }} />
							<span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "150ms" }} />
							<span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "300ms" }} />
						</div>
						<span className="text-[11px] font-medium italic">{typingText}</span>
					</div>
				)}

				{/* Barra de Entrada de Mensaje */}
				<div className="p-3 border-t border-border bg-card/90 backdrop-blur-xs shrink-0 w-full">
					{isPending ? (
						<div className="py-2 text-center text-xs text-muted-foreground">
							Debes aceptar la invitación para enviar mensajes en este chat.
						</div>
					) : isRecordingVoice ? (
						/* Modo Grabación de Audio */
						<div className="flex items-center gap-3 w-full bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5">
							<div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium text-xs">
								<span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
								<Mic className="h-4 w-4 text-rose-500" />
								<span className="font-medium text-foreground">Grabando audio</span>
								<span className="font-mono font-bold text-foreground">
									{Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, "0")}
								</span>
							</div>
							<div className="flex-1" />
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={cancelVoiceRecording}
								className="h-8 px-2 text-xs text-muted-foreground hover:text-rose-500 cursor-pointer"
							>
								<X className="h-4 w-4 mr-1" />
								Cancelar
							</Button>
							<Button
								type="button"
								size="sm"
								onClick={stopVoiceRecording}
								className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-full cursor-pointer shadow-xs gap-1.5"
							>
								<Send className="h-3.5 w-3.5" />
								Enviar nota
							</Button>
						</div>
					) : (
						/* Modo Estándar de Entrada */
						<div className="flex items-center gap-2 max-w-5xl mx-auto w-full">
							{/* Selector de emojis */}
							<Popover>
								<PopoverTrigger
									render={
										<button
											type="button"
											className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
											title="Emojis"
										/>
									}
								>
									<Smile className="h-5 w-5" />
								</PopoverTrigger>
								<PopoverContent
									side="top"
									align="start"
									className="w-56 p-2 bg-popover border-border"
								>
									<div className="grid grid-cols-4 gap-1 text-lg">
										{EMOJI_LIST.map((emoji) => (
											<button
												key={emoji}
												type="button"
												onClick={() => setInputText((prev) => prev + emoji)}
												className="h-9 w-9 flex items-center justify-center rounded-md hover:bg-muted cursor-pointer transition-transform hover:scale-110"
											>
												{emoji}
											</button>
										))}
									</div>
								</PopoverContent>
							</Popover>

							{/* Botón para adjuntar archivos, fotos y videos */}
							<input
								type="file"
								ref={fileInputRef}
								onChange={handleFileUpload}
								className="hidden"
								accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
							/>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={() => fileInputRef.current?.click()}
								disabled={uploading}
								className="text-muted-foreground hover:text-foreground rounded-full h-9 w-9 cursor-pointer"
								title="Adjuntar archivo, imagen o video"
							>
								{uploading ? (
									<Loader2 className="h-4 w-4 animate-spin text-primary" />
								) : (
									<Paperclip className="h-4 w-4" />
								)}
							</Button>

							{/* Campo de texto principal */}
							<Input
								value={inputText}
								onChange={handleInputChange}
								onKeyDown={(e) => {
									if (e.key === "Enter" && !e.shiftKey) {
										e.preventDefault();
										handleSendMessage();
									}
								}}
								placeholder="Escribe un mensaje..."
								className="h-10 text-xs bg-muted/50 border-border rounded-full px-4 focus-visible:ring-emerald-500 flex-1"
							/>

							{/* Botón dinámico: Micrófono cuando está vacío / Enviar cuando hay texto */}
							{inputText.trim() ? (
								<Button
									type="button"
									size="icon"
									onClick={handleSendMessage}
									className="h-10 w-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 cursor-pointer shadow-xs"
									title="Enviar mensaje"
								>
									<Send className="h-4 w-4" />
								</Button>
							) : (
								<Button
									type="button"
									size="icon"
									onClick={startVoiceRecording}
									disabled={uploading}
									className="h-10 w-10 rounded-full bg-muted hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 shrink-0 cursor-pointer transition-colors"
									title="Grabar nota de voz"
								>
									<Mic className="h-4 w-4" />
								</Button>
							)}
						</div>
					)}
				</div>
			</div>

			{/* Panel Lateral de Notas y Tareas */}
			{sidePanelOpen && (
				<InternalChatSidePanel
					chat={chat}
					onClose={() => setSidePanelOpen(false)}
					onTasksCountChange={setPendingTasksCount}
				/>
			)}

			{/* Diálogo de Información e Integrantes del Grupo */}
			<ChatInfoDialog
				chat={chat}
				open={infoOpen}
				onOpenChange={setInfoOpen}
				onMembersUpdated={() => {
					onChatUpdated?.();
				}}
				onChatDeleted={() => {
					onChatUpdated?.();
					onBack?.();
				}}
			/>
		</div>
	);
}
