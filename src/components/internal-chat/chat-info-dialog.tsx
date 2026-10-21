"use client";

import { useState, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
	Users,
	User,
	Shield,
	Clock,
	CheckCircle2,
	Plus,
	LogOut,
	UserPlus,
	Trash2,
	Pencil,
	X,
	Check,
	UserMinus,
	ShieldAlert,
	Loader2,
} from "lucide-react";
import type { InternalChat, AccountMember } from "@/types";

const PRESET_COLORS = [
	"#10b981",
	"#3b82f6",
	"#8b5cf6",
	"#ec4899",
	"#f59e0b",
	"#06b6d4",
	"#f97316",
	"#64748b",
];

interface ChatInfoDialogProps {
	chat: InternalChat | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onMembersUpdated?: () => void;
	onChatDeleted?: () => void;
}

export function ChatInfoDialog({
	chat,
	open,
	onOpenChange,
	onMembersUpdated,
	onChatDeleted,
}: ChatInfoDialogProps) {
	const { user } = useAuth();

	// Modo edicion del grupo
	const [isEditing, setIsEditing] = useState(false);
	const [editName, setEditName] = useState("");
	const [editDescription, setEditDescription] = useState("");
	const [editColor, setEditColor] = useState("#10b981");
	const [savingEdit, setSavingEdit] = useState(false);

	// Modo agregar miembros
	const [isAddingMembers, setIsAddingMembers] = useState(false);
	const [availableMembers, setAvailableMembers] = useState<AccountMember[]>([]);
	const [selectedToAdd, setSelectedToAdd] = useState<string[]>([]);
	const [loadingAvailable, setLoadingAvailable] = useState(false);
	const [addingMembersLoading, setAddingMembersLoading] = useState(false);

	// Confirmaciones
	const [confirmAction, setConfirmAction] = useState<"delete" | "leave" | null>(null);
	const [actionLoading, setActionLoading] = useState(false);

	useEffect(() => {
		if (chat) {
			setEditName(chat.name || "");
			setEditDescription(chat.description || "");
			setEditColor(chat.color || "#10b981");
		}
		setIsEditing(false);
		setIsAddingMembers(false);
		setConfirmAction(null);
	}, [chat, open]);

	if (!chat) return null;

	const isGroup = chat.type === "group";
	const isMyChatAdmin = chat.my_membership?.role === "admin";
	const isCreator = chat.created_by === user?.id;
	const canManage = isGroup && (isMyChatAdmin || isCreator);
	const members = chat.members || [];

	// Guardar edicion del grupo
	const handleSaveEdit = async () => {
		if (!editName.trim()) {
			toast.error("El nombre del grupo es obligatorio");
			return;
		}

		setSavingEdit(true);
		try {
			const res = await fetch(`/api/internal-chat/${chat.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: editName.trim(),
					description: editDescription.trim(),
					color: editColor,
				}),
			});

			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || "Error al actualizar grupo");
			}

			toast.success("Información del grupo actualizada");
			setIsEditing(false);
			onMembersUpdated?.();
		} catch (err: any) {
			console.error("Error al actualizar grupo:", err);
			toast.error(err.message || "Error al actualizar grupo");
		} finally {
			setSavingEdit(false);
		}
	};

	// Cargar miembros disponibles del CRM para invitar
	const handleOpenAddMembers = async () => {
		setIsAddingMembers(true);
		setLoadingAvailable(true);
		setSelectedToAdd([]);

		try {
			const res = await fetch("/api/account/members");
			if (res.ok) {
				const data = await res.json();
				const existingIds = new Set(members.map((m) => m.user_id));
				const eligible = (data.members || []).filter(
					(m: AccountMember) => !existingIds.has(m.user_id)
				);
				setAvailableMembers(eligible);
			}
		} catch (err) {
			console.error("Error al cargar miembros disponibles:", err);
		} finally {
			setLoadingAvailable(false);
		}
	};

	// Enviar invitaciones a miembros seleccionados
	const handleAddMembersSubmit = async () => {
		if (selectedToAdd.length === 0) return;

		setAddingMembersLoading(true);
		try {
			const res = await fetch(`/api/internal-chat/${chat.id}/members`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ member_user_ids: selectedToAdd }),
			});

			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || "Error al agregar miembros");
			}

			toast.success("Invitaciones enviadas con éxito");
			setIsAddingMembers(false);
			onMembersUpdated?.();
		} catch (err: any) {
			console.error("Error al agregar miembros:", err);
			toast.error(err.message || "Error al agregar miembros");
		} finally {
			setAddingMembersLoading(false);
		}
	};

	// Cambiar rol de miembro (Admin <-> Miembro)
	const handleToggleMemberRole = async (targetUserId: string, currentRole: string) => {
		const newRole = currentRole === "admin" ? "member" : "admin";
		try {
			const res = await fetch(`/api/internal-chat/${chat.id}/members`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ user_id: targetUserId, role: newRole }),
			});

			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || "Error al cambiar rol");
			}

			toast.success(newRole === "admin" ? "Usuario ascendido a Administrador" : "Rol cambiado a Miembro");
			onMembersUpdated?.();
		} catch (err: any) {
			console.error("Error al cambiar rol:", err);
			toast.error(err.message || "Error al cambiar rol");
		}
	};

	// Expulsar miembro
	const handleKickMember = async (targetUserId: string) => {
		try {
			const res = await fetch(`/api/internal-chat/${chat.id}/members`, {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ user_id: targetUserId }),
			});

			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || "Error al expulsar miembro");
			}

			toast.success("Miembro expulsado del grupo");
			onMembersUpdated?.();
		} catch (err: any) {
			console.error("Error al expulsar miembro:", err);
			toast.error(err.message || "Error al expulsar miembro");
		}
	};

	// Eliminar chat o salir de grupo
	const handleConfirmAction = async () => {
		if (!confirmAction) return;

		setActionLoading(true);
		try {
			const res = await fetch(`/api/internal-chat/${chat.id}?action=${confirmAction}`, {
				method: "DELETE",
			});

			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.error || "Error al realizar la acción");
			}

			toast.success(
				confirmAction === "delete"
					? isGroup
						? "Grupo eliminado por completo"
						: "Conversación eliminada"
					: "Has salido del grupo"
			);

			onOpenChange(false);
			onChatDeleted?.();
			onMembersUpdated?.();
		} catch (err: any) {
			console.error("Error al procesar acción:", err);
			toast.error(err.message || "Error al procesar acción");
		} finally {
			setActionLoading(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-md bg-card border-border p-6 max-h-[90vh] overflow-y-auto">
				{/* Vista de confirmacion de eliminacion o salida */}
				{confirmAction ? (
					<div className="space-y-4 py-2 text-center">
						<div className="h-12 w-12 rounded-full bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto">
							<ShieldAlert className="h-6 w-6" />
						</div>
						<div className="space-y-1">
							<h3 className="text-sm font-bold text-foreground">
								{confirmAction === "delete"
									? isGroup
										? "¿Eliminar este grupo para todos?"
										: "¿Eliminar esta conversación?"
									: "¿Deseas salir de este grupo?"}
							</h3>
							<p className="text-xs text-muted-foreground max-w-xs mx-auto">
								{confirmAction === "delete"
									? "Esta acción borrará todos los mensajes, archivos y participantes del chat de forma permanente."
									: "Ya no recibirás mensajes ni podrás participar a menos que un administrador vuelva a invitarte."}
							</p>
						</div>
						<div className="flex items-center justify-center gap-2 pt-2">
							<Button
								variant="outline"
								size="sm"
								disabled={actionLoading}
								onClick={() => setConfirmAction(null)}
								className="cursor-pointer text-xs"
							>
								Cancelar
							</Button>
							<Button
								variant="destructive"
								size="sm"
								disabled={actionLoading}
								onClick={handleConfirmAction}
								className="cursor-pointer text-xs gap-1"
							>
								{actionLoading && <Loader2 className="h-3 w-3 animate-spin" />}
								{confirmAction === "delete" ? "Eliminar definitivamente" : "Salir del grupo"}
							</Button>
						</div>
					</div>
				) : isEditing ? (
					/* Vista de edicion de grupo */
					<div className="space-y-4 py-1">
						<DialogHeader>
							<DialogTitle className="text-base font-bold text-foreground">
								Editar Información del Grupo
							</DialogTitle>
							<DialogDescription className="text-xs text-muted-foreground">
								Modifica el nombre, descripción y color identificador del grupo.
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-3">
							<div className="space-y-1">
								<label className="text-xs font-medium text-foreground">Nombre del grupo</label>
								<Input
									value={editName}
									onChange={(e) => setEditName(e.target.value)}
									placeholder="Nombre del grupo..."
									className="text-xs bg-muted/40"
								/>
							</div>

							<div className="space-y-1">
								<label className="text-xs font-medium text-foreground">Descripción</label>
								<Textarea
									value={editDescription}
									onChange={(e) => setEditDescription(e.target.value)}
									placeholder="Descripción o propósito del grupo..."
									rows={2}
									className="text-xs bg-muted/40 resize-none"
								/>
							</div>

							<div className="space-y-1">
								<label className="text-xs font-medium text-foreground">Color</label>
								<div className="flex items-center gap-2 pt-1">
									{PRESET_COLORS.map((c) => (
										<button
											key={c}
											type="button"
											onClick={() => setEditColor(c)}
											className="h-6 w-6 rounded-full transition-transform cursor-pointer flex items-center justify-center"
											style={{
												backgroundColor: c,
												transform: editColor === c ? "scale(1.2)" : "scale(1)",
												boxShadow: editColor === c ? "0 0 0 2px var(--background), 0 0 0 4px " + c : "none",
											}}
										>
											{editColor === c && <Check className="h-3 w-3 text-white" />}
										</button>
									))}
								</div>
							</div>
						</div>

						<div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setIsEditing(false)}
								className="text-xs cursor-pointer"
								disabled={savingEdit}
							>
								Cancelar
							</Button>
							<Button
								size="sm"
								onClick={handleSaveEdit}
								disabled={savingEdit || !editName.trim()}
								className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer gap-1"
							>
								{savingEdit && <Loader2 className="h-3 w-3 animate-spin" />}
								Guardar cambios
							</Button>
						</div>
					</div>
				) : isAddingMembers ? (
					/* Vista de agregar miembros */
					<div className="space-y-4 py-1">
						<DialogHeader>
							<DialogTitle className="text-base font-bold text-foreground">
								Agregar Miembros al Grupo
							</DialogTitle>
							<DialogDescription className="text-xs text-muted-foreground">
								Selecciona compañeros del equipo para enviarles una invitación.
							</DialogDescription>
						</DialogHeader>

						{loadingAvailable ? (
							<div className="flex h-36 items-center justify-center">
								<Loader2 className="h-6 w-6 animate-spin text-primary" />
							</div>
						) : availableMembers.length === 0 ? (
							<p className="text-xs text-center text-muted-foreground py-6">
								Todos los miembros del CRM ya forman parte de este grupo.
							</p>
						) : (
							<ScrollArea className="h-52 rounded-lg border border-border p-2">
								<div className="space-y-1">
									{availableMembers.map((m) => {
										const isSelected = selectedToAdd.includes(m.user_id);
										return (
											<button
												key={m.user_id}
												type="button"
												onClick={() =>
													setSelectedToAdd((prev) =>
														isSelected
															? prev.filter((id) => id !== m.user_id)
															: [...prev, m.user_id]
													)
												}
												className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
													isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted/60"
												}`}
											>
												<div className="truncate">
													<p className="font-semibold text-foreground truncate">{m.full_name || m.email}</p>
													{m.email && <p className="text-[11px] text-muted-foreground truncate">{m.email}</p>}
												</div>
												<div
													className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
														isSelected ? "bg-primary border-primary text-white" : "border-border"
													}`}
												>
													{isSelected && <Check className="h-3 w-3" />}
												</div>
											</button>
										);
									})}
								</div>
							</ScrollArea>
						)}

						<div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setIsAddingMembers(false)}
								className="text-xs cursor-pointer"
								disabled={addingMembersLoading}
							>
								Cancelar
							</Button>
							<Button
								size="sm"
								onClick={handleAddMembersSubmit}
								disabled={addingMembersLoading || selectedToAdd.length === 0}
								className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer gap-1"
							>
								{addingMembersLoading && <Loader2 className="h-3 w-3 animate-spin" />}
								Enviar invitaciones ({selectedToAdd.length})
							</Button>
						</div>
					</div>
				) : (
					/* Vista principal de informacion */
					<>
						<DialogHeader>
							<div className="flex flex-col items-center text-center pb-2 relative">
								<div
									className="h-16 w-16 rounded-full flex items-center justify-center text-white text-xl font-bold mb-3 shadow-md"
									style={{ backgroundColor: chat.color || "#10b981" }}
								>
									{isGroup ? <Users className="h-8 w-8" /> : <User className="h-8 w-8" />}
								</div>
								<div className="flex items-center gap-2 justify-center">
									<DialogTitle className="text-lg font-bold text-foreground">
										{chat.name || "Chat Directo"}
									</DialogTitle>
									{canManage && (
										<button
											type="button"
											onClick={() => setIsEditing(true)}
											className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
											title="Editar grupo"
										>
											<Pencil className="h-3.5 w-3.5" />
										</button>
									)}
								</div>
								<DialogDescription className="text-xs text-muted-foreground mt-1">
									{isGroup
										? `${members.length} integrante(s) en total`
										: "Conversación directa entre miembros"}
								</DialogDescription>
								{chat.description && (
									<p className="text-xs text-foreground/80 mt-2 bg-muted/40 p-2 rounded-md max-w-sm">
										{chat.description}
									</p>
								)}
							</div>
						</DialogHeader>

						<div className="space-y-3 py-2">
							<div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">
								<span>Integrantes ({members.length})</span>
								{canManage && (
									<button
										type="button"
										onClick={handleOpenAddMembers}
										className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 normal-case font-medium hover:underline cursor-pointer"
									>
										<UserPlus className="h-3 w-3" /> Agregar
									</button>
								)}
							</div>

							<ScrollArea className="h-56 rounded-lg border border-border bg-muted/10 p-2">
								<div className="space-y-1.5">
									{members.map((member) => {
										const isMe = member.user_id === user?.id;
										const memberName =
											member.profile?.full_name || member.profile?.email || "Usuario";
										const initials = memberName.charAt(0).toUpperCase();
										const isAdmin = member.role === "admin";
										const isAccepted = member.status === "accepted";
										const canModerateThisMember = canManage && !isMe && member.user_id !== chat.created_by;

										return (
											<div
												key={member.id}
												className="flex items-center justify-between p-2 rounded-lg bg-card/60 border border-border/50 text-xs gap-2"
											>
												<div className="flex items-center gap-2.5 min-w-0 flex-1">
													<div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
														{member.profile?.avatar_url ? (
															<img
																src={member.profile.avatar_url}
																alt={memberName}
																className="h-8 w-8 rounded-full object-cover"
															/>
														) : (
															initials
														)}
													</div>
													<div className="truncate min-w-0 flex-1">
														<div className="flex items-center gap-1.5 truncate">
															<span className="font-semibold text-foreground truncate">
																{memberName} {isMe && "(Tú)"}
															</span>
															{isAdmin && (
																<span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] bg-amber-500/10 text-amber-500 font-medium border border-amber-500/20">
																	<Shield className="h-2.5 w-2.5" /> Admin
																</span>
															)}
														</div>
														{member.profile?.email && (
															<p className="text-[11px] text-muted-foreground truncate">
																{member.profile.email}
															</p>
														)}
													</div>
												</div>

												<div className="flex items-center gap-1 shrink-0">
													{isAccepted ? (
														<span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
															<CheckCircle2 className="h-3 w-3" /> Activo
														</span>
													) : (
														<span className="inline-flex items-center gap-1 text-[10px] text-amber-500 font-medium bg-amber-500/10 px-1.5 py-0.5 rounded-full">
															<Clock className="h-3 w-3" /> Pendiente
														</span>
													)}

													{/* Acciones de moderacion de miembros para admins */}
													{canModerateThisMember && (
														<div className="flex items-center gap-0.5 ml-1">
															<button
																type="button"
																onClick={() => handleToggleMemberRole(member.user_id, member.role)}
																className="p-1 rounded text-muted-foreground hover:text-amber-500 hover:bg-muted cursor-pointer"
																title={isAdmin ? "Quitar admin" : "Hacer administrador"}
															>
																<Shield className="h-3.5 w-3.5" />
															</button>
															<button
																type="button"
																onClick={() => handleKickMember(member.user_id)}
																className="p-1 rounded text-muted-foreground hover:text-rose-500 hover:bg-muted cursor-pointer"
																title="Expulsar del grupo"
															>
																<UserMinus className="h-3.5 w-3.5" />
															</button>
														</div>
													)}
												</div>
											</div>
										);
									})}
								</div>
							</ScrollArea>

							{/* Botones de gestion destructiva al fondo */}
							<div className="pt-3 border-t border-border flex flex-col gap-2">
								{isGroup && (
									<Button
										variant="outline"
										size="sm"
										onClick={() => setConfirmAction("leave")}
										className="w-full text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1.5"
									>
										<LogOut className="h-3.5 w-3.5" />
										Salir del grupo
									</Button>
								)}

								{(isMyChatAdmin || isCreator || !isGroup) && (
									<Button
										variant="destructive"
										size="sm"
										onClick={() => setConfirmAction("delete")}
										className="w-full text-xs cursor-pointer gap-1.5"
									>
										<Trash2 className="h-3.5 w-3.5" />
										{isGroup ? "Eliminar grupo para todos" : "Eliminar conversación"}
									</Button>
								)}
							</div>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
