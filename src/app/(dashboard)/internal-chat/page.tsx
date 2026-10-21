"use client";

import { Suspense, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { InternalChatList } from "@/components/internal-chat/internal-chat-list";
import { InternalChatThread } from "@/components/internal-chat/internal-chat-thread";
import { CreateChatWizard } from "@/components/internal-chat/create-chat-wizard";
import type { InternalChat } from "@/types";

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

	// Mantener referencia sincronizada
	useEffect(() => {
		activeChatIdRef.current = activeChatId;
	}, [activeChatId]);

	// Cargar chats sin dependencias ciclicas
	const fetchChats = useCallback(async () => {
		try {
			const res = await fetch("/api/internal-chat");
			if (res.ok) {
				const data = await res.json();
				const fetchedChats: InternalChat[] = data.chats || [];
				setChats(fetchedChats);

				// Solo auto-seleccionar en la carga inicial
				if (!initialAutoSelectRef.current) {
					initialAutoSelectRef.current = true;
					if (deepLinkChatId && fetchedChats.some((c) => c.id === deepLinkChatId)) {
						activeChatIdRef.current = deepLinkChatId;
						setActiveChatId(deepLinkChatId);
					} else if (fetchedChats.length > 0) {
						if (typeof window !== "undefined" && window.innerWidth >= 1024) {
							activeChatIdRef.current = fetchedChats[0].id;
							setActiveChatId(fetchedChats[0].id);
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
		const channel = supabase
			.channel("internal-chats-channel")
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
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	}, [accountId, user?.id]);

	const handleSelectChat = (chatId: string) => {
		if (activeChatIdRef.current === chatId) return;
		activeChatIdRef.current = chatId;
		setActiveChatId(chatId);
		if (typeof window !== "undefined") {
			const url = `/internal-chat?c=${chatId}`;
			window.history.replaceState({ ...window.history.state, as: url, url }, "", url);
		}
	};

	const handleBack = () => {
		activeChatIdRef.current = null;
		setActiveChatId(null);
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
