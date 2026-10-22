"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/lib/currency";
import type { Contact, Pipeline, PipelineStage, Profile } from "@/types";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	DollarSign,
	Calendar,
	Building,
	Phone,
	Mail,
	User,
	Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface PipelineWithStages extends Pipeline {
	stages?: PipelineStage[];
}

interface CreateDealDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	contact: Contact;
	conversationId?: string;
	onDealCreated: () => void;
}

const DEFAULT_STAGES_FALLBACK = [
	{ name: "Nuevo Lead", color: "#3b82f6", position: 0 },
	{ name: "Calificado", color: "#eab308", position: 1 },
	{ name: "Propuesta Enviada", color: "#f97316", position: 2 },
	{ name: "Negociación", color: "#8b5cf6", position: 3 },
	{ name: "Ganado", color: "#22c55e", position: 4 },
];

export function CreateDealDialog({
	open,
	onOpenChange,
	contact,
	conversationId,
	onDealCreated,
}: CreateDealDialogProps) {
	const supabase = createClient();
	const { accountId, defaultCurrency } = useAuth();

	const [title, setTitle] = useState("");
	const [value, setValue] = useState("");
	const [currency, setCurrency] = useState(defaultCurrency || DEFAULT_CURRENCY);
	const [selectedPipelineId, setSelectedPipelineId] = useState("");
	const [selectedStageId, setSelectedStageId] = useState("");
	const [assignedTo, setAssignedTo] = useState("");
	const [expectedCloseDate, setExpectedCloseDate] = useState("");
	const [notes, setNotes] = useState("");

	const [pipelines, setPipelines] = useState<PipelineWithStages[]>([]);
	const [stages, setStages] = useState<PipelineStage[]>([]);
	const [profiles, setProfiles] = useState<Profile[]>([]);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);

	// Inicializar y cargar los datos del formulario cada vez que se abre el modal
	useEffect(() => {
		if (!open) return;

		// Pre-cargar datos del contacto en el título y valores iniciales
		const contactDisplayName = contact.name?.trim() || contact.phone;
		const defaultTitle = contact.company
			? `${contact.company} - Negocio con ${contactDisplayName}`
			: `Negocio con ${contactDisplayName}`;

		setTitle(defaultTitle);
		setValue("");
		setCurrency(defaultCurrency || DEFAULT_CURRENCY);
		setExpectedCloseDate("");
		setNotes("");

		let cancelled = false;

		const loadData = async () => {
			setLoading(true);
			try {
				const {
					data: { session },
				} = await supabase.auth.getSession();
				const currentUserId = session?.user?.id;

				// Cargar embudos con sus etapas y perfiles de la cuenta
				const [pipesRes, profilesRes] = await Promise.all([
					supabase
						.from("pipelines")
						.select("*, stages:pipeline_stages(*)")
						.order("created_at"),
					supabase.from("profiles").select("*").order("full_name"),
				]);

				if (cancelled) return;

				let loadedPipelines: PipelineWithStages[] = (pipesRes.data || []) as PipelineWithStages[];
				const loadedProfiles: Profile[] = (profilesRes.data || []) as Profile[];
				setProfiles(loadedProfiles);

				// Pre-seleccionar el usuario actual en "asignado a" si existe
				if (currentUserId) {
					const matchingProfile = loadedProfiles.find(
						(p) => p.user_id === currentUserId
					);
					if (matchingProfile) {
						setAssignedTo(matchingProfile.id);
					}
				}

				// Si la cuenta no tiene ningún embudo creado, sembrar uno por defecto
				if (loadedPipelines.length === 0 && currentUserId && accountId) {
					const { data: newPipe } = await supabase
						.from("pipelines")
						.insert({
							user_id: currentUserId,
							account_id: accountId,
							name: "Embudo de Ventas",
						})
						.select()
						.single();

					if (newPipe) {
						const stagesPayload = DEFAULT_STAGES_FALLBACK.map((s) => ({
							pipeline_id: newPipe.id,
							name: s.name,
							color: s.color,
							position: s.position,
						}));

						const { data: newStages } = await supabase
							.from("pipeline_stages")
							.insert(stagesPayload)
							.select();

						loadedPipelines = [
							{
								...newPipe,
								stages: (newStages || []).sort(
									(a, b) => a.position - b.position
								),
							},
						];
					}
				}

				setPipelines(loadedPipelines);

				// Seleccionar el primer embudo y su primera etapa por defecto
				if (loadedPipelines.length > 0) {
					const firstPipe = loadedPipelines[0];
					setSelectedPipelineId(firstPipe.id);

					const sortedStages = (firstPipe.stages || [])
						.slice()
						.sort((a, b) => a.position - b.position);

					setStages(sortedStages);
					setSelectedStageId(sortedStages[0]?.id || "");
				}
			} catch (err) {
				console.error("Error al cargar datos de embudos:", err);
				toast.error("Error al cargar las etapas del embudo");
			} finally {
				if (!cancelled) setLoading(false);
			}
		};

		loadData();

		return () => {
			cancelled = true;
		};
	}, [open, contact, defaultCurrency, accountId, supabase]);

	// Manejar cambio de embudo seleccionado
	const handlePipelineChange = useCallback(
		(pipeId: string) => {
			setSelectedPipelineId(pipeId);
			const foundPipe = pipelines.find((p) => p.id === pipeId);
			const pipeStages = (foundPipe?.stages || [])
				.slice()
				.sort((a, b) => a.position - b.position);

			setStages(pipeStages);
			setSelectedStageId(pipeStages[0]?.id || "");
		},
		[pipelines]
	);

	// Guardar el nuevo negocio en Supabase
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!title.trim()) {
			toast.error("El título del negocio es obligatorio");
			return;
		}

		if (!selectedPipelineId || !selectedStageId) {
			toast.error("Debe seleccionar un embudo y una etapa");
			return;
		}

		setSaving(true);
		try {
			const {
				data: { session },
			} = await supabase.auth.getSession();
			const user = session?.user;

			if (!user) {
				toast.error("Sesión no iniciada");
				setSaving(false);
				return;
			}

			if (!accountId) {
				toast.error("Su perfil no está vinculado a una cuenta");
				setSaving(false);
				return;
			}

			const parsedValue = parseFloat(value) || 0;

			const payload = {
				user_id: user.id,
				account_id: accountId,
				contact_id: contact.id,
				conversation_id: conversationId || null,
				pipeline_id: selectedPipelineId,
				stage_id: selectedStageId,
				title: title.trim(),
				value: parsedValue,
				currency: currency || DEFAULT_CURRENCY,
				assigned_to: assignedTo || null,
				expected_close_date: expectedCloseDate || null,
				notes: notes.trim() || null,
				status: "open",
			};

			const { error } = await supabase.from("deals").insert(payload);

			if (error) {
				console.error("Error al crear negocio:", error);
				toast.error("Error al crear el negocio: " + error.message);
				setSaving(false);
				return;
			}

			toast.success("Negocio creado exitosamente");
			onDealCreated();
			onOpenChange(false);
		} catch (err) {
			console.error("Error inesperado al crear negocio:", err);
			toast.error("Error inesperado al crear el negocio");
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg border-border bg-popover p-0 text-popover-foreground shadow-2xl">
				<form onSubmit={handleSubmit}>
					{/* Encabezado del modal */}
					<DialogHeader className="border-b border-border p-5">
						<DialogTitle className="text-base font-semibold text-foreground flex items-center gap-2">
							<DollarSign className="h-4 w-4 text-primary" />
							Crear Negocio
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground">
							Crea una nueva oportunidad comercial asociando automáticamente este contacto.
						</DialogDescription>
					</DialogHeader>

					{/* Contenido del formulario */}
					<div className="max-h-[72vh] overflow-y-auto p-5 space-y-4">
						{/* Ficha resumen del contacto prellenado */}
						<div className="rounded-lg border border-border bg-muted/40 p-3">
							<div className="flex items-center justify-between gap-2">
								<div className="flex items-center gap-2.5 min-w-0">
									<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-xs">
										{contact.name ? (
											contact.name.charAt(0).toUpperCase()
										) : (
											<User className="h-4 w-4" />
										)}
									</div>
									<div className="min-w-0">
										<p className="text-sm font-medium text-foreground truncate">
											{contact.name || "Contacto sin nombre"}
										</p>
										<p className="flex items-center gap-1 text-xs text-muted-foreground">
											<Phone className="h-3 w-3 shrink-0" />
											<span className="truncate">{contact.phone}</span>
										</p>
									</div>
								</div>
								{(contact.company || contact.email) && (
									<div className="text-right text-xs text-muted-foreground shrink-0 space-y-0.5">
										{contact.company && (
											<p className="flex items-center justify-end gap-1 font-medium text-foreground/80">
												<Building className="h-3 w-3" />
												<span className="truncate max-w-[140px]">
													{contact.company}
												</span>
											</p>
										)}
										{contact.email && (
											<p className="flex items-center justify-end gap-1">
												<Mail className="h-3 w-3" />
												<span className="truncate max-w-[140px]">
													{contact.email}
												</span>
											</p>
										)}
									</div>
								)}
							</div>
						</div>

						{loading ? (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="h-6 w-6 animate-spin text-primary" />
							</div>
						) : (
							<>
								{/* Título del negocio */}
								<div className="space-y-1.5">
									<Label className="text-xs font-medium text-foreground">
										Título de la negociación <span className="text-destructive">*</span>
									</Label>
									<Input
										value={title}
										onChange={(e) => setTitle(e.target.value)}
										placeholder="Ej: Contrato de servicios mensuales"
										className="border-border bg-muted text-sm text-foreground focus:border-primary"
										required
									/>
								</div>

								{/* Embudo y Etapa */}
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<div className="space-y-1.5">
										<Label className="text-xs font-medium text-foreground">
											Embudo
										</Label>
										<select
											value={selectedPipelineId}
											onChange={(e) => handlePipelineChange(e.target.value)}
											className="h-9 w-full rounded-md border border-border bg-muted px-2.5 text-xs text-foreground outline-none focus:border-primary"
										>
											{pipelines.map((p) => (
												<option key={p.id} value={p.id}>
													{p.name}
												</option>
											))}
										</select>
									</div>

									<div className="space-y-1.5">
										<Label className="text-xs font-medium text-foreground">
											Etapa <span className="text-destructive">*</span>
										</Label>
										<select
											value={selectedStageId}
											onChange={(e) => setSelectedStageId(e.target.value)}
											className="h-9 w-full rounded-md border border-border bg-muted px-2.5 text-xs text-foreground outline-none focus:border-primary"
											required
										>
											{stages.map((s) => (
												<option key={s.id} value={s.id}>
													{s.name}
												</option>
											))}
										</select>
									</div>
								</div>

								{/* Valor y Moneda */}
								<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
									<div className="sm:col-span-2 space-y-1.5">
										<Label className="text-xs font-medium text-foreground">
											Monto / Valor
										</Label>
										<div className="relative">
											<DollarSign className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
											<Input
												type="number"
												step="any"
												min="0"
												value={value}
												onChange={(e) => setValue(e.target.value)}
												placeholder="0"
												className="border-border bg-muted pl-8 text-sm text-foreground focus:border-primary"
											/>
										</div>
									</div>

									<div className="space-y-1.5">
										<Label className="text-xs font-medium text-foreground">
											Moneda
										</Label>
										<select
											value={currency}
											onChange={(e) => setCurrency(e.target.value)}
											className="h-9 w-full rounded-md border border-border bg-muted px-2.5 text-xs text-foreground outline-none focus:border-primary"
										>
											{CURRENCIES.map((c) => (
												<option key={c.code} value={c.code}>
													{c.code} ({c.symbol})
												</option>
											))}
										</select>
									</div>
								</div>

								{/* Fecha estimada de cierre y Asignado a */}
								<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
									<div className="space-y-1.5">
										<Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
											<Calendar className="h-3 w-3 text-muted-foreground" />
											Cierre estimado
										</Label>
										<Input
											type="date"
											value={expectedCloseDate}
											onChange={(e) => setExpectedCloseDate(e.target.value)}
											className="border-border bg-muted text-xs text-foreground focus:border-primary"
										/>
									</div>

									<div className="space-y-1.5">
										<Label className="text-xs font-medium text-foreground flex items-center gap-1.5">
											<User className="h-3 w-3 text-muted-foreground" />
											Asignado a
										</Label>
										<select
											value={assignedTo}
											onChange={(e) => setAssignedTo(e.target.value)}
											className="h-9 w-full rounded-md border border-border bg-muted px-2.5 text-xs text-foreground outline-none focus:border-primary"
										>
											<option value="">Sin asignar</option>
											{profiles.map((p) => (
												<option key={p.id} value={p.id}>
													{p.full_name || p.email}
												</option>
											))}
										</select>
									</div>
								</div>

								{/* Notas de la oportunidad */}
								<div className="space-y-1.5">
									<Label className="text-xs font-medium text-foreground">
										Notas o requerimientos
									</Label>
									<Textarea
										value={notes}
										onChange={(e) => setNotes(e.target.value)}
										placeholder="Observaciones de la negociación o datos relevantes..."
										rows={3}
										className="border-border bg-muted text-xs text-foreground placeholder-muted-foreground resize-none focus:border-primary"
									/>
								</div>
							</>
						)}
					</div>

					{/* Botones de acción */}
					<DialogFooter className="border-t border-border p-4 gap-2 flex sm:justify-end">
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => onOpenChange(false)}
							disabled={saving}
							className="border-border text-xs"
						>
							Cancelar
						</Button>
						<Button
							type="submit"
							size="sm"
							disabled={saving || loading || !title.trim() || !selectedStageId}
							className="bg-primary text-xs text-primary-foreground hover:bg-primary/90"
						>
							{saving ? (
								<>
									<Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
									Guardando...
								</>
							) : (
								"Crear Negocio"
							)}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
