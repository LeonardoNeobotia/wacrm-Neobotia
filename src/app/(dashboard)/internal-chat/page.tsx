"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { InternalChatList } from "@/components/internal-chat/internal-chat-list";
import { InternalChatThread } from "@/components/internal-chat/internal-chat-thread";
import { CreateChatWizard } from "@/components/internal-chat/create-chat-wizard";
import type { InternalChat } from "@/types";
import { setActiveInternalChatId } from "@/lib/sound/active-presence";

export default function InternalChatPage() {
	return (
		<Suspense fallback={null}>
			<InternalChatPageInner />
		</Suspense>
	);
}

function InternalChatPageInner() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const deepLinkChatId = searchParams.get("c");
	const { user, profile, accountId } = useAuth();

	const [chats, setChats] = useState<InternalChat[]>([]);
	const [activeChatId, setActiveChatId] = useState<string | null>(deepLinkChatId);
	const [loading, setLoading] = useState(true);
	const [wizardOpen, setWizardOpen] = useState(false);

	const activeChatIdRef = useRef<string | null>(deepLinkChatId);
	const initialAutoSelectRef = useRef(false);

	// Mantener referencia sincronizada y presencia en memoria para verificacion precisa de foco
	useEffect(() => {
		activeChatIdRef.current = activeChatId;
		setActiveInternalChatId(activeChatId);
		return () => {
			setActiveInternalChatId(null);
		};
	}, [activeChatId]);

	// Cargar chats sin dependencias ciclicas (con bypass de cache)
	const fetchChats = useCallback(async () => {
		try {
			const res = await fetch(`/api/internal-chat?_t=${Date.now()}`, {
				cache: "no-store",
				headers: {
					"Cache-Control": "no-cache, no-store, must-revalidate",
					Pragma: "no-cache",
				},
			});
			if (res.ok) {
				const data = await res.json();
				const fetchedChats: InternalChat[] = (data.chats || []).map((c: InternalChat) =>
					c.id === activeChatIdRef.current ? { ...c, unread_count: 0 } : c
				);
				setChats(fetchedChats);

				// Solo auto-seleccionar en la carga inicial
				if (!initialAutoSelectRef.current) {
					initialAutoSelectRef.current = true;
					if (deepLinkChatId && fetchedChats.some((c) => c.id === deepLinkChatId)) {
						activeChatIdRef.current = deepLinkChatId;
						setActiveChatId(deepLinkChatId);
						fetch(`/api/internal-chat/${deepLinkChatId}/read`, { method: "POST" }).catch(() => {});
						if (typeof window !== "undefined") {
							window.dispatchEvent(new CustomEvent("internal-chat-read", { detail: { chatId: deepLinkChatId } }));
						}
					} else if (fetchedChats.length > 0) {
						if (typeof window !== "undefined" && window.innerWidth >= 1024) {
							const firstId = fetchedChats[0].id;
							activeChatIdRef.current = firstId;
							setActiveChatId(firstId);
							fetch(`/api/internal-chat/${firstId}/read`, { method: "POST" }).catch(() => {});
							setActiveInternalChatId(firstId);
							if (typeof window !== "undefined") {
								const url = `/internal-chat?c=${firstId}`;
								window.history.replaceState({ ...window.history.state, as: url, url }, "", url);
								window.dispatchEvent(new CustomEvent("internal-chat-read", { detail: { chatId: firstId } }));
							}
						}
					}
				} else if (activeChatIdRef.current) {
					// Si el chat activo fue eliminado por otro usuario, deseleccionar
					const exists = fetchedChats.some((c) => c.id === activeChatIdRef.current);
					if (!exists) {
						activeChatIdRef.current = null;
						setActiveChatId(null);
					}
				}
			}
		} catch (err) {
			console.error("Error al cargar chats internos:", err);
		} finally {
			setLoading(false);
		}
	}, [deepLinkChatId]);

	const fetchChatsRef = useRef(fetchChats);
	useEffect(() => {
		fetchChatsRef.current = fetchChats;
	}, [fetchChats]);

	useEffect(() => {
		fetchChats();
	}, [fetchChats]);

	// Suscribirse a cambios en membresias o chats para actualizar la lista en tiempo real de forma estable
	useEffect(() => {
		if (!accountId || !user?.id) return;

		const supabase = createClient();
		let channelStatus = "CLOSED";

		const channel = supabase
			.channel(`internal-chats-account:${accountId}`, {
				config: { broadcast: { ack: false, self: false } },
			})
			.on("broadcast", { event: "chat_updated" }, () => {
				fetchChatsRef.current?.();
			})
			.on("broadcast", { event: "chat_created" }, () => {
				fetchChatsRef.current?.();
			})
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "internal_chat_members",
					filter: `user_id=eq.${user.id}`,
				},
				() => {
					fetchChatsRef.current?.();
				}
			)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "internal_messages",
				},
				() => {
					fetchChatsRef.current?.();
				}
			)
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "internal_chats",
				},
				() => {
					fetchChatsRef.current?.();
				}
			);

		channel.subscribe((status) => {
			channelStatus = status;
			if (status === "SUBSCRIBED") {
				fetchChatsRef.current?.();
			}
		});

		// Actualizar al regresar a la pestana activa o al enfocar la ventana
		const handleFocusOrVisibility = () => {
			fetchChatsRef.current?.();
			if (channelStatus !== "SUBSCRIBED") {
				try {
					channel.subscribe((status) => {
						channelStatus = status;
					});
				} catch (err) {
					console.warn("Error reanudando canal de cuenta:", err);
				}
			}
		};

		window.addEventListener("focus", handleFocusOrVisibility);
		document.addEventListener("visibilitychange", handleFocusOrVisibility);

		// Sincronizacion de respaldo discreta (cada 30s) solo si la pestana esta activa
		const interval = setInterval(() => {
			if (typeof document !== "undefined" && document.hidden) return;
			fetchChatsRef.current?.();
		}, 30000);

		return () => {
			window.removeEventListener("focus", handleFocusOrVisibility);
			document.removeEventListener("visibilitychange", handleFocusOrVisibility);
			supabase.removeChannel(channel);
			clearInterval(interval);
		};
	}, [accountId, user?.id]);

	const handleSelectChat = (chatId: string) => {
		if (activeChatIdRef.current === chatId) return;
		activeChatIdRef.current = chatId;
		setActiveChatId(chatId);

		// Limpiar de inmediato el badge de no leídos en la lista
		setChats((prev) =>
			prev.map((c) => (c.id === chatId ? { ...c, unread_count: 0 } : c))
		);

		// Notificar al hook global y actualizar URL
		if (typeof window !== "undefined") {
			const url = `/internal-chat?c=${chatId}`;
			window.history.replaceState({ ...window.history.state, as: url, url }, "", url);
			window.dispatchEvent(new CustomEvent("internal-chat-read", { detail: { chatId } }));
		}

		// Marcar como leído en la base de datos
		fetch(`/api/internal-chat/${chatId}/read`, { method: "POST" }).catch((err) => {
			console.error("Error al marcar chat como leído:", err);
		});
	};

	const handleBack = () => {
		activeChatIdRef.current = null;
		setActiveChatId(null);
		setActiveInternalChatId(null);
		if (typeof window !== "undefined") {
			window.history.replaceState({ ...window.history.state, as: "/internal-chat", url: "/internal-chat" }, "", "/internal-chat");
		}
	};

	const activeChat = chats.find((c) => c.id === activeChatId) || null;

	return (
		<div className="-m-4 flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden sm:-m-6">
			<div className="flex h-full w-full overflow-hidden">
				{/* Panel Izquierdo: Lista de Chats */}
				<div
					className={`h-full w-full shrink-0 border-r border-border lg:w-80 xl:w-96 ${
						activeChatId ? "hidden lg:block" : "block"
					}`}
				>
					<InternalChatList
						chats={chats}
						activeChatId={activeChatId}
						onSelectChat={handleSelectChat}
						onOpenWizard={() => setWizardOpen(true)}
						loading={loading}
					/>
				</div>

				{/* Panel Derecho: Conversacion / Thread */}
				<div
					className={`h-full w-full flex-1 min-w-0 ${
						!activeChatId ? "hidden lg:flex" : "flex"
					}`}
				>
					<InternalChatThread
						chat={activeChat}
						onBack={handleBack}
						onChatUpdated={fetchChats}
					/>
				</div>
			</div>

			{/* Wizard para crear chats o grupos */}
			<CreateChatWizard
				open={wizardOpen}
				onOpenChange={setWizardOpen}
				onChatCreated={(newChatId) => {
					fetchChats();
					handleSelectChat(newChatId);
				}}
			/>
		</div>
	);
}
