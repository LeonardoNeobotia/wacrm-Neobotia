"use client";

import { useState, useEffect, useMemo } from "react";
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
	User,
	Users,
	Search,
	Check,
	ArrowRight,
	ArrowLeft,
	Loader2,
	MessageSquare,
	Shield,
} from "lucide-react";
import type { AccountMember } from "@/types";

const PRESET_COLORS = [
	"#10b981", // Emerald
	"#3b82f6", // Blue
	"#8b5cf6", // Purple
	"#ec4899", // Pink
	"#f59e0b", // Amber
	"#06b6d4", // Cyan
	"#f97316", // Orange
	"#64748b", // Slate
];

interface CreateChatWizardProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onChatCreated: (chatId: string) => void;
}

type WizardStep = 1 | 2 | 3 | 4;

export function CreateChatWizard({
	open,
	onOpenChange,
	onChatCreated,
}: CreateChatWizardProps) {
	const { user, profile } = useAuth();
	const [step, setStep] = useState<WizardStep>(1);
	const [chatType, setChatType] = useState<"direct" | "group">("direct");
	const [groupName, setGroupName] = useState("");
	const [description, setDescription] = useState("");
	const [groupColor, setGroupColor] = useState(PRESET_COLORS[0]);
	const [members, setMembers] = useState<AccountMember[]>([]);
	const [loadingMembers, setLoadingMembers] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
	const [submitting, setSubmitting] = useState(false);

	// Inicializar nombre del grupo por defecto con el nombre del usuario
	useEffect(() => {
		if (profile?.full_name) {
			setGroupName(`Grupo de ${profile.full_name}`);
		} else {
			setGroupName("Nuevo Grupo");
		}
	}, [profile?.full_name]);

	// Cargar miembros del CRM
	useEffect(() => {
		if (!open) return;
		async function fetchMembers() {
			setLoadingMembers(true);
			try {
				const res = await fetch("/api/account/members");
				if (res.ok) {
					const data = await res.json();
					// Excluir al usuario actual
					const otherMembers = (data.members || []).filter(
						(m: AccountMember) => m.user_id !== user?.id
					);
					setMembers(otherMembers);
				}
			} catch (err) {
				console.error("Error al cargar miembros:", err);
				toast.error("No se pudieron cargar los miembros del CRM");
			} finally {
				setLoadingMembers(false);
			}
		}
		fetchMembers();
	}, [open, user?.id]);

	// Resetear wizard al cerrar
	const handleClose = (newOpen: boolean) => {
		if (!newOpen) {
			setStep(1);
			setChatType("direct");
			setSelectedUserIds([]);
			setDescription("");
			setSearchQuery("");
		}
		onOpenChange(newOpen);
	};

	// Filtrar miembros por buscador
	const filteredMembers = useMemo(() => {
		const q = searchQuery.toLowerCase().trim();
		if (!q) return members;
		return members.filter(
			(m) =>
				m.full_name.toLowerCase().includes(q) ||
				(m.email && m.email.toLowerCase().includes(q))
		);
	}, [members, searchQuery]);

	// Alternar seleccion de miembro
	const toggleSelectMember = (userId: string) => {
		if (chatType === "direct") {
			// En directo solo puede haber 1 miembro seleccionado
			setSelectedUserIds([userId]);
		} else {
			// En grupo pueden ser multiples
			setSelectedUserIds((prev) =>
				prev.includes(userId)
					? prev.filter((id) => id !== userId)
					: [...prev, userId]
			);
		}
	};

	// Enviar formulario y crear chat
	const handleSubmit = async () => {
		if (selectedUserIds.length === 0) {
			toast.error("Debes seleccionar al menos un compañero");
			return;
		}

		if (chatType === "group" && !groupName.trim()) {
			toast.error("El nombre del grupo es obligatorio");
			return;
		}

		setSubmitting(true);
		try {
			const res = await fetch("/api/internal-chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					type: chatType,
					name: chatType === "group" ? groupName.trim() : null,
					description: chatType === "group" ? description.trim() : null,
					color: groupColor,
					member_user_ids: selectedUserIds,
				}),
			});

			const data = await res.json();
			if (!res.ok) {
				throw new Error(data.error || "Error al crear el chat");
			}

			if (data.already_exists) {
				toast.info("Ya tenías una conversación directa con este miembro");
			} else {
				toast.success(
					chatType === "group"
						? "Grupo creado e invitaciones enviadas"
						: "Invitación de chat enviada"
				);
			}

			handleClose(false);
			onChatCreated(data.chat_id);
		} catch (err: any) {
			console.error("Error al crear chat:", err);
			toast.error(err.message || "Error al crear el chat");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent className="sm:max-w-md bg-card border-border p-6">
				<DialogHeader>
					<div className="flex items-center justify-between">
						<DialogTitle className="text-lg font-semibold text-foreground">
							{step === 1 && "Nuevo Chat Interno"}
							{step === 2 && "Personalizar Grupo"}
							{step === 3 &&
								(chatType === "direct"
									? "Selecciona un compañero"
									: "Invitar miembros al grupo")}
							{step === 4 && "Confirmar y Enviar Invitación"}
						</DialogTitle>
						<span className="text-xs font-medium text-muted-foreground">
							Paso {step} de {chatType === "group" ? 4 : 3}
						</span>
					</div>
					<DialogDescription className="text-xs text-muted-foreground mt-1">
						{step === 1 &&
							"Elige si deseas una conversación directa con un colega o crear un grupo para tu equipo."}
						{step === 2 &&
							"Configura el nombre y la apariencia visual de tu grupo."}
						{step === 3 &&
							(chatType === "direct"
								? "Selecciona a qué miembro del CRM deseas invitar a chatear."
								: "Selecciona los miembros que recibirán la invitación para unirse.")}
						{step === 4 &&
							"Revisa la información antes de crear el chat y enviar las invitaciones."}
					</DialogDescription>
				</DialogHeader>

				{/* Paso 1: Tipo de Chat */}
				{step === 1 && (
					<div className="grid grid-cols-2 gap-3 py-4">
						<button
							type="button"
							onClick={() => setChatType("direct")}
							className={`flex flex-col items-center justify-center gap-3 p-5 rounded-xl border text-center transition-all cursor-pointer ${
								chatType === "direct"
									? "border-primary bg-primary/10 text-primary shadow-sm"
									: "border-border hover:border-muted-foreground/40 bg-muted/30 text-foreground"
							}`}
						>
							<div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
								<User className="h-6 w-6" />
							</div>
							<div>
								<p className="text-sm font-semibold">Chat Directo</p>
								<p className="text-xs text-muted-foreground mt-1">
									Conversación 1 a 1 con un colega
								</p>
							</div>
						</button>

						<button
							type="button"
							onClick={() => setChatType("group")}
							className={`flex flex-col items-center justify-center gap-3 p-5 rounded-xl border text-center transition-all cursor-pointer ${
								chatType === "group"
									? "border-primary bg-primary/10 text-primary shadow-sm"
									: "border-border hover:border-muted-foreground/40 bg-muted/30 text-foreground"
							}`}
						>
							<div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
								<Users className="h-6 w-6" />
							</div>
							<div>
								<p className="text-sm font-semibold">Grupo de Equipo</p>
								<p className="text-xs text-muted-foreground mt-1">
									Conversación grupal con varios miembros
								</p>
							</div>
						</button>
					</div>
				)}

				{/* Paso 2: Personalizar Grupo (Solo si es grupo) */}
				{step === 2 && chatType === "group" && (
					<div className="space-y-4 py-3">
						<div className="space-y-1.5">
							<label className="text-xs font-medium text-foreground">
								Nombre del grupo <span className="text-rose-500">*</span>
							</label>
							<Input
								value={groupName}
								onChange={(e) => setGroupName(e.target.value)}
								placeholder="Ej. Ventas Santiago, Soporte Tecnico..."
								className="text-sm bg-muted/40"
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-foreground">
								Descripción del grupo (opcional)
							</label>
							<Textarea
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="¿De qué trata este grupo?"
								rows={2}
								className="text-sm bg-muted/40 resize-none"
							/>
						</div>

						<div className="space-y-1.5">
							<label className="text-xs font-medium text-foreground">
								Color identificador
							</label>
							<div className="flex items-center gap-2 pt-1">
								{PRESET_COLORS.map((c) => (
									<button
										key={c}
										type="button"
										onClick={() => setGroupColor(c)}
										className={`h-7 w-7 rounded-full transition-all cursor-pointer ${
											groupColor === c
												? "ring-2 ring-primary ring-offset-2 ring-offset-card scale-110"
												: "opacity-80 hover:opacity-100"
										}`}
										style={{ backgroundColor: c }}
									/>
								))}
							</div>
						</div>
					</div>
				)}

				{/* Paso 3: Seleccionar Miembros */}
				{((step === 2 && chatType === "direct") ||
					(step === 3 && chatType === "group")) && (
					<div className="space-y-3 py-2">
						<div className="relative">
							<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Buscar por nombre o correo..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-8 text-xs bg-muted/40 h-9"
							/>
						</div>

						<div className="text-xs text-muted-foreground flex justify-between items-center px-1">
							<span>
								{chatType === "direct"
									? "Selecciona 1 compañero"
									: `${selectedUserIds.length} seleccionado(s)`}
							</span>
						</div>

						<ScrollArea className="h-56 rounded-lg border border-border bg-muted/10 p-2">
							{loadingMembers ? (
								<div className="flex h-32 items-center justify-center">
									<Loader2 className="h-5 w-5 animate-spin text-primary" />
								</div>
							) : filteredMembers.length === 0 ? (
								<div className="p-4 text-center text-xs text-muted-foreground">
									No se encontraron otros miembros en tu cuenta.
								</div>
							) : (
								<div className="space-y-1">
									{filteredMembers.map((member) => {
										const isSelected = selectedUserIds.includes(member.user_id);
										const initials =
											member.full_name?.charAt(0).toUpperCase() || "U";
										return (
											<button
												key={member.user_id}
												type="button"
												onClick={() => toggleSelectMember(member.user_id)}
												className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors cursor-pointer ${
													isSelected
														? "bg-primary/10 text-primary border border-primary/20"
														: "hover:bg-muted text-foreground"
												}`}
											>
												<div className="flex items-center gap-2.5 min-w-0">
													<div className="h-8 w-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-semibold text-xs shrink-0">
														{member.avatar_url ? (
															<img
																src={member.avatar_url}
																alt={member.full_name}
																className="h-8 w-8 rounded-full object-cover"
															/>
														) : (
															initials
														)}
													</div>
													<div className="truncate">
														<p className="text-xs font-medium truncate">
															{member.full_name || "Sin nombre"}
														</p>
														{member.email && (
															<p className="text-[11px] text-muted-foreground truncate">
																{member.email}
															</p>
														)}
													</div>
												</div>
												<div
													className={`h-5 w-5 rounded-md flex items-center justify-center border transition-colors ${
														isSelected
															? "bg-primary border-primary text-primary-foreground"
															: "border-muted-foreground/30"
													}`}
												>
													{isSelected && <Check className="h-3.5 w-3.5" />}
												</div>
											</button>
										);
									})}
								</div>
							)}
						</ScrollArea>
					</div>
				)}

				{/* Paso 4 (o 3 en direct): Confirmar */}
				{((step === 3 && chatType === "direct") ||
					(step === 4 && chatType === "group")) && (
					<div className="space-y-4 py-3">
						<div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
							<div className="flex items-center gap-3">
								<div
									className="h-10 w-10 rounded-full flex items-center justify-center text-white shrink-0"
									style={{ backgroundColor: groupColor }}
								>
									{chatType === "group" ? (
										<Users className="h-5 w-5" />
									) : (
										<User className="h-5 w-5" />
									)}
								</div>
								<div className="min-w-0">
									<h4 className="text-sm font-semibold text-foreground truncate">
										{chatType === "group"
											? groupName
											: members.find((m) => m.user_id === selectedUserIds[0])
													?.full_name || "Chat Directo"}
									</h4>
									<p className="text-xs text-muted-foreground">
										{chatType === "group"
											? `Grupo con ${selectedUserIds.length} miembro(s) invitado(s)`
											: "Invitación a chat 1 a 1"}
									</p>
								</div>
							</div>

							<div className="border-t border-border/60 pt-3 text-xs text-muted-foreground space-y-1">
								<p>
									Se enviará una invitación a los miembros seleccionados. El chat
									se activará inmediatamente y podrán aceptar la invitación para
									conversar.
								</p>
							</div>
						</div>
					</div>
				)}

				{/* Botones de Navegación del Wizard */}
				<div className="flex items-center justify-between pt-3 border-t border-border">
					{step > 1 ? (
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => setStep((s) => (s - 1) as WizardStep)}
							disabled={submitting}
						>
							<ArrowLeft className="h-4 w-4 mr-1" />
							Atrás
						</Button>
					) : (
						<div />
					)}

					{/* Botón Siguiente o Crear */}
					{((step < 3 && chatType === "direct") ||
						(step < 4 && chatType === "group")) && (
						<Button
							type="button"
							size="sm"
							onClick={() => {
								if (step === 1 && chatType === "direct") {
									setStep(2);
								} else if (step === 1 && chatType === "group") {
									setStep(2);
								} else if (step === 2 && chatType === "group") {
									if (!groupName.trim()) {
										toast.error("Ingresa un nombre para el grupo");
										return;
									}
									setStep(3);
								} else if (step === 2 && chatType === "direct") {
									if (selectedUserIds.length === 0) {
										toast.error("Selecciona a un compañero");
										return;
									}
									setStep(3);
								} else if (step === 3 && chatType === "group") {
									if (selectedUserIds.length === 0) {
										toast.error("Selecciona al menos un miembro para el grupo");
										return;
									}
									setStep(4);
								}
							}}
						>
							Siguiente
							<ArrowRight className="h-4 w-4 ml-1" />
						</Button>
					)}

					{((step === 3 && chatType === "direct") ||
						(step === 4 && chatType === "group")) && (
						<Button
							type="button"
							size="sm"
							onClick={handleSubmit}
							disabled={submitting}
							className="bg-emerald-600 hover:bg-emerald-700 text-white"
						>
							{submitting ? (
								<Loader2 className="h-4 w-4 animate-spin mr-1.5" />
							) : (
								<MessageSquare className="h-4 w-4 mr-1.5" />
							)}
							Crear y Enviar Invitación
						</Button>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
