"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { playInternalChatSound } from "@/lib/sound/notification";
import { getActiveInternalChatId } from "@/lib/sound/active-presence";

/**
 * Hook global para rastrear chats internos no leidos en todo el dashboard.
 * Controla el punto verde en la barra lateral y reproduce el sonido de chat interno
 * en cualquier seccion del dashboard o cuando el usuario cambia de pestana.
 */
export function useInternalChatUnread(): number {
	const { user, accountId } = useAuth();
	const [totalUnread, setTotalUnread] = useState(0);

	const unreadByChatRef = useRef<Map<string, number>>(new Map());
	const initialLoadDoneRef = useRef(false);

	useEffect(() => {
		if (!user?.id || !accountId) return;

		const supabase = createClient();
		let cancelled = false;

		// Sincronizar recuentos de mensajes no leidos desde el servidor
		const syncUnreadCounts = async () => {
			try {
				const res = await fetch(`/api/internal-chat?_t=${Date.now()}`, {
					cache: "no-store",
					headers: {
						"Cache-Control": "no-cache, no-store, must-revalidate",
						Pragma: "no-cache",
					},
				});
				if (!res.ok || cancelled) return;
				const data = await res.json();
				const chats: { id: string; unread_count?: number }[] = data.chats || [];

				const map = new Map<string, number>();
				let unreadChatsCount = 0;
				for (const c of chats) {
					const count = c.unread_count ?? 0;
					map.set(c.id, count);
					if (count > 0) unreadChatsCount += 1;
				}

				unreadByChatRef.current = map;
				initialLoadDoneRef.current = true;
				setTotalUnread(unreadChatsCount);
			} catch (err) {
				console.error("[useInternalChatUnread] Error al sincronizar chats:", err);
			}
		};

		syncUnreadCounts();

		// Canal global de tiempo real para mensajes y membresias de chat interno
		const channel = supabase
			.channel(`global-internal-chat:${accountId}:${user.id}`)
			.on(
				"postgres_changes",
				{
					event: "INSERT",
					schema: "public",
					table: "internal_messages",
				},
				(payload) => {
					const newMsg = payload.new as {
						id: string;
						chat_id: string;
						sender_id: string | null;
						created_at: string;
					};

					if (!newMsg || !newMsg.chat_id) return;

					// Ignorar mensajes enviados por uno mismo o generados por el sistema
					if (!newMsg.sender_id || newMsg.sender_id === user.id) return;

					// 1. Verificar si la pestaña tiene foco y no está oculta / minimizada
					const isHidden = typeof document !== "undefined" ? document.hidden : false;
					const hasFocus = typeof document !== "undefined" && typeof document.hasFocus === "function" ? document.hasFocus() : true;
					const isTabFocused = !isHidden && hasFocus;

					// 2. Verificar si está en la ruta de chat interno
					const isInternalChatRoute =
						typeof window !== "undefined" &&
						window.location.pathname.startsWith("/internal-chat");

					// 3. Obtener el chat activo actual
					const activeChatId =
						getActiveInternalChatId() ||
						(typeof window !== "undefined"
							? new URLSearchParams(window.location.search).get("c")
							: null);

					// El usuario sólo se considera "presente y activo en el chat" si la pestaña
					// está enfocada, en la sección de chat interno y con este chat abierto en pantalla
					const isActivelyViewingThisChat =
						isTabFocused &&
						isInternalChatRoute &&
						Boolean(activeChatId && activeChatId === newMsg.chat_id);

					if (!isActivelyViewingThisChat) {
						// Si está en otra pestaña, o en otra sección del dashboard, o en otro chat:
						const map = unreadByChatRef.current;
						const current = map.get(newMsg.chat_id) ?? 0;
						map.set(newMsg.chat_id, current + 1);

						let count = 0;
						for (const n of map.values()) {
							if (n > 0) count += 1;
						}
						setTotalUnread(count);

						// Reproducir sonido de notificación
						if (initialLoadDoneRef.current) {
							playInternalChatSound();
						}
					} else {
						// Si está en el chat presente y enfocado, NO reproducir sonido
						const map = unreadByChatRef.current;
						map.set(newMsg.chat_id, 0);

						let count = 0;
						for (const n of map.values()) {
							if (n > 0) count += 1;
						}
						setTotalUnread(count);
					}
				}
			)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "internal_chat_members",
					filter: `user_id=eq.${user.id}`,
				},
				(payload) => {
					const updatedMember = payload.new as {
						chat_id?: string;
						last_read_at?: string;
					};

					if (updatedMember?.chat_id) {
						const map = unreadByChatRef.current;
						map.set(updatedMember.chat_id, 0);

						let count = 0;
						for (const n of map.values()) {
							if (n > 0) count += 1;
						}
						setTotalUnread(count);
					}
				}
			)
			.subscribe();

		// Listener para eventos locales inmediatos al hacer click en un chat
		const handleLocalChatRead = (e: Event) => {
			const customEvent = e as CustomEvent<{ chatId: string }>;
			const chatId = customEvent.detail?.chatId;
			if (chatId) {
				const map = unreadByChatRef.current;
				map.set(chatId, 0);

				let count = 0;
				for (const n of map.values()) {
					if (n > 0) count += 1;
				}
				setTotalUnread(count);
			}
		};

		window.addEventListener("internal-chat-read", handleLocalChatRead);
		window.addEventListener("focus", syncUnreadCounts);

		return () => {
			cancelled = true;
			window.removeEventListener("internal-chat-read", handleLocalChatRead);
			window.removeEventListener("focus", syncUnreadCounts);
			supabase.removeChannel(channel);
		};
	}, [user?.id, accountId]);

	return totalUnread;
}

