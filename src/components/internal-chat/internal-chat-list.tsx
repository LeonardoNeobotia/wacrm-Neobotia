"use client";

import { useState, useMemo } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import {
	Search,
	Plus,
	Users,
	User,
	MessageSquare,
	Clock,
	CheckCheck,
} from "lucide-react";
import type { InternalChat } from "@/types";
import { usePresence } from "@/hooks/use-presence";
import { PresenceDot } from "@/components/presence/presence-dot";

interface InternalChatListProps {
	chats: InternalChat[];
	activeChatId: string | null;
	onSelectChat: (chatId: string) => void;
	onOpenWizard: () => void;
	loading?: boolean;
}

type ChatFilter = "all" | "direct" | "group" | "invitations";

export function InternalChatList({
	chats,
	activeChatId,
	onSelectChat,
	onOpenWizard,
	loading,
}: InternalChatListProps) {
	const { user, profile } = useAuth();
	const { getPresence } = usePresence();
	const [searchQuery, setSearchQuery] = useState("");
	const [filter, setFilter] = useState<ChatFilter>("all");

	// Contar invitaciones pendientes
	const pendingInvitationsCount = useMemo(() => {
		return chats.filter((c) => c.my_membership?.status === "pending").length;
	}, [chats]);

	// Filtrar chats
	const filteredChats = useMemo(() => {
		return chats.filter((chat) => {
			// Filtro de pestaña
			if (filter === "direct" && chat.type !== "direct") return false;
			if (filter === "group" && chat.type !== "group") return false;
			if (filter === "invitations" && chat.my_membership?.status !== "pending")
				return false;

			// Filtro de busqueda
			if (!searchQuery.trim()) return true;
			const q = searchQuery.toLowerCase().trim();

			// Buscar por nombre del chat
			if (chat.name && chat.name.toLowerCase().includes(q)) return true;

			// Buscar por nombres de miembros
			const matchMember = chat.members?.some(
				(m) =>
					m.profile?.full_name?.toLowerCase().includes(q) ||
					m.profile?.email?.toLowerCase().includes(q)
			);
			return matchMember;
		});
	}, [chats, filter, searchQuery]);

	// Obtener el nombre para mostrar de un chat (en directos se muestra el otro integrante)
	const getChatDisplayName = (chat: InternalChat) => {
		if (chat.type === "group") {
			return chat.name || "Grupo sin nombre";
		}
		// En chat directo buscar al otro miembro
		const other = chat.members?.find((m) => m.user_id !== user?.id);
		return other?.profile?.full_name || other?.profile?.email || "Chat Directo";
	};

	// Formatear hora amigable
	const formatMessageTime = (dateStr?: string) => {
		if (!dateStr) return "";
		try {
			const d = new Date(dateStr);
			if (isToday(d)) return format(d, "HH:mm");
			if (isYesterday(d)) return "Ayer";
			return format(d, "dd/MM/yy");
		} catch {
			return "";
		}
	};

	return (
		<div className="flex h-full flex-col border-r border-border bg-card">
			{/* Cabecera de la lista */}
			<div className="p-3.5 border-b border-border space-y-3">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<div className="h-8 w-8 rounded-lg bg-emerald-600/10 text-emerald-600 flex items-center justify-center font-bold">
							<MessageSquare className="h-4 w-4" />
						</div>
						<h2 className="text-base font-bold text-foreground">Chat Interno</h2>
					</div>
					<Button
						size="sm"
						onClick={onOpenWizard}
						className="h-8 gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
					>
						<Plus className="h-3.5 w-3.5" />
						Nuevo Chat
					</Button>
				</div>

				{/* Buscador */}
				<div className="relative">
					<Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
					<Input
						placeholder="Buscar chats o compañeros..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="h-8 pl-8 text-xs bg-muted/40 border-border"
					/>
				</div>

				{/* Filtros estilo pills modernos */}
				<div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
					<button
						type="button"
						onClick={() => setFilter("all")}
						className={`px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap text-xs ${
							filter === "all"
								? "bg-emerald-600 text-white font-medium shadow-xs"
								: "text-muted-foreground hover:bg-muted/70"
						}`}
					>
						Todos
					</button>
					<button
						type="button"
						onClick={() => setFilter("direct")}
						className={`px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap text-xs ${
							filter === "direct"
								? "bg-emerald-600 text-white font-medium shadow-xs"
								: "text-muted-foreground hover:bg-muted/70"
						}`}
					>
						Directos
					</button>
					<button
						type="button"
						onClick={() => setFilter("group")}
						className={`px-3 py-1 rounded-full transition-all cursor-pointer whitespace-nowrap text-xs ${
							filter === "group"
								? "bg-emerald-600 text-white font-medium shadow-xs"
								: "text-muted-foreground hover:bg-muted/70"
						}`}
					>
						Grupos
					</button>
					<button
						type="button"
						onClick={() => setFilter("invitations")}
						className={`px-3 py-1 rounded-full transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap text-xs ${
							filter === "invitations"
								? "bg-emerald-600 text-white font-medium shadow-xs"
								: "text-muted-foreground hover:bg-muted/70"
						}`}
					>
						Invitaciones
						{pendingInvitationsCount > 0 && (
							<span className={`h-4 min-w-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
								filter === "invitations" ? "bg-white text-emerald-700" : "bg-amber-500 text-white"
							}`}>
								{pendingInvitationsCount}
							</span>
						)}
					</button>
				</div>
			</div>

			{/* Lista de Chats o Empty State */}
			<ScrollArea className="flex-1">
				{chats.length === 0 ? (
					/* Estado Vacio: No tienes un grupo o chat interno */
					<div className="flex flex-col items-center justify-center text-center p-6 mt-12 space-y-3">
						<div className="h-16 w-16 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center shadow-inner">
							<Users className="h-8 w-8" />
						</div>
						<div className="space-y-1">
							<h3 className="text-sm font-semibold text-foreground">
								No tienes un grupo o chat interno con un miembro
							</h3>
							<p className="text-xs text-muted-foreground max-w-xs">
								Comienza a coordinar con tus compañeros de equipo directamente
								desde el CRM.
							</p>
						</div>
						<Button
							size="sm"
							onClick={onOpenWizard}
							className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
						>
							<Plus className="h-4 w-4 mr-1" />
							Crear un grupo o chat
						</Button>
					</div>
				) : filteredChats.length === 0 ? (
					<div className="flex flex-col items-center justify-center text-center p-8 min-h-[300px] text-xs text-muted-foreground space-y-2.5">
						{filter === "invitations" ? (
							<>
								<div className="h-12 w-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-1">
									<Clock className="h-6 w-6" />
								</div>
								<p className="font-semibold text-foreground text-sm">No tienes invitaciones pendientes</p>
								<p className="text-xs text-muted-foreground max-w-[260px] leading-relaxed mx-auto">
									Aquí verás los chats a los que otros compañeros te inviten. Si creaste un chat nuevo, encuéntralo en &quot;Todos&quot; o &quot;Directos&quot;.
								</p>
							</>
						) : (
							<>
								<div className="h-12 w-12 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mb-1">
									<Search className="h-5 w-5" />
								</div>
								<p className="font-semibold text-foreground text-sm">Sin resultados</p>
								<p className="text-xs text-muted-foreground max-w-[220px] mx-auto">
									No se encontraron conversaciones con este filtro o búsqueda.
								</p>
							</>
						)}
					</div>
				) : (
					<div className="p-1 space-y-0.5">
						{filteredChats.map((chat) => {
							const isSelected = chat.id === activeChatId;
							const displayName = getChatDisplayName(chat);
							const isGroup = chat.type === "group";
							const isPending = chat.my_membership?.status === "pending";
							const otherMember = chat.members?.find((m) => m.user_id !== user?.id);
							const isOtherPending = !isGroup && otherMember?.status === "pending";
							const initials = displayName.charAt(0).toUpperCase();
							const lastMsg = chat.last_message;

							return (
								<button
									key={chat.id}
									type="button"
									onClick={() => onSelectChat(chat.id)}
									className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all cursor-pointer ${
										isSelected
											? "bg-emerald-500/10 dark:bg-emerald-500/15 border-l-4 border-l-emerald-600 shadow-2xs"
											: "hover:bg-muted/50"
									}`}
								>
									{/* Avatar del Chat con presencia para directos */}
									<div className="relative shrink-0">
										<div
											className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-xs"
											style={{ backgroundColor: chat.color || "#10b981" }}
										>
											{isGroup ? (
												<Users className="h-5 w-5" />
											) : (
												initials
											)}
										</div>
										{!isGroup && otherMember && (
											<PresenceDot
												status={getPresence(otherMember.user_id)}
												className="absolute bottom-0 right-0 ring-2 ring-card size-2.5"
											/>
										)}
									</div>

									{/* Info del Chat */}
									<div className="flex-1 min-w-0">
										<div className="flex items-center justify-between">
											<h4 className="text-xs font-semibold text-foreground truncate">
												{displayName}
											</h4>
											<span className="text-[10px] text-muted-foreground shrink-0 ml-1">
												{formatMessageTime(
													lastMsg?.created_at || chat.updated_at
												)}
											</span>
										</div>

										<div className="flex items-center justify-between mt-0.5">
											<p className="text-[11px] text-muted-foreground truncate">
												{isPending ? (
													<span className="inline-flex items-center gap-1 text-amber-500 font-medium">
														<Clock className="h-3 w-3" /> Invitación recibida
													</span>
												) : isOtherPending ? (
													<span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
														<Clock className="h-3 w-3" /> Invitación enviada (pendiente)
													</span>
												) : lastMsg ? (
													<>
														{lastMsg.sender_id === user?.id && (
															<span className="text-muted-foreground font-medium mr-1">
																Tú:
															</span>
														)}
														{lastMsg.text}
													</>
												) : (
													"Sin mensajes aún"
												)}
											</p>

											{/* Badge de no leídos */}
											{chat.unread_count && chat.unread_count > 0 && !isPending ? (
												<span className="h-4 min-w-4 px-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 ml-1">
													{chat.unread_count}
												</span>
											) : null}
										</div>
									</div>
								</button>
							);
						})}
					</div>
				)}
			</ScrollArea>
		</div>
	);
}
