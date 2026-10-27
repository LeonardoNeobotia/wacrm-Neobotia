"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import {
	ArrowLeft,
	Loader2,
	Save,
	Code,
	Copy,
	Check,
	Plus,
	Trash2,
	ExternalLink,
	Sliders,
	CheckSquare,
	Layers,
	HelpCircle,
	User,
	Mail,
	Phone,
	Building2,
	Eye,
	Monitor,
	Smartphone,
	ArrowRight,
	ShieldCheck,
	CheckCircle2,
	Sparkles,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"

const THEME_PRESETS = [
	{ label: "Azul", hex: "#3b82f6" },
	{ label: "Esmeralda", hex: "#10b981" },
	{ label: "Púrpura", hex: "#8b5cf6" },
	{ label: "Rosa", hex: "#f43f5e" },
	{ label: "Ámbar", hex: "#f59e0b" },
	{ label: "Cian", hex: "#06b6d4" },
	{ label: "Índigo", hex: "#6366f1" },
	{ label: "Pizarra", hex: "#475569" },
]

export default function FormEditorPage() {
	const router = useRouter()
	const params = useParams()
	const isNew = params.id === "new"
	const formId = isNew ? null : (params.id as string)

	const [loading, setLoading] = useState(!isNew)
	const [saving, setSaving] = useState(false)
	const [activeTab, setActiveTab] = useState<"general" | "fields" | "crm" | "preview">("general")
	const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop")
	const [showEmbedCode, setShowEmbedCode] = useState(false)
	const [copiedEmbed, setCopiedEmbed] = useState(false)
	const [copiedLink, setCopiedLink] = useState(false)
	const [pipelines, setPipelines] = useState<any[]>([])

	const [formData, setFormData] = useState({
		name: "",
		title: "",
		description: "",
		theme_color: "#3b82f6",
		pipeline_id: "none",
		stage_id: "none",
		fields_config: {
			name: { enabled: true, required: true },
			email: { enabled: true, required: true },
			phone: { enabled: false, required: false },
			company: { enabled: false, required: false },
			custom: [] as { id: string; label: string; required: boolean }[],
		},
	})

	useEffect(() => {
		async function init() {
			const supabase = createClient()

			// Cargar embudos de venta
			const { data: pipes } = await supabase
				.from("pipelines")
				.select("*, pipeline_stages(*)")
			if (pipes) setPipelines(pipes)

			if (!isNew) {
				const { data, error } = await supabase
					.from("web_forms")
					.select("*")
					.eq("id", formId)
					.single()

				if (error || !data) {
					toast.error("Formulario no encontrado")
					router.push("/forms")
					return
				}

				setFormData({
					name: data.name,
					title: data.title,
					description: data.description || "",
					theme_color: data.theme_color || "#3b82f6",
					pipeline_id: data.pipeline_id || "none",
					stage_id: data.stage_id || "none",
					fields_config: {
						...data.fields_config,
						custom: data.fields_config?.custom || [],
					},
				})
			}
			setLoading(false)
		}
		init()
	}, [isNew, formId, router])

	async function save() {
		if (!formData.name.trim() || !formData.title.trim()) {
			toast.error("El Nombre Interno y el Título Público son obligatorios")
			return
		}

		// Validar campos personalizados
		if (formData.fields_config.custom.some((cf) => !cf.label.trim())) {
			toast.error("Todos los campos personalizados deben tener una pregunta o nombre")
			return
		}

		setSaving(true)
		const supabase = createClient()
		const { data: userData } = await supabase.auth.getUser()
		const { data: profile } = await supabase
			.from("profiles")
			.select("account_id")
			.eq("user_id", userData.user?.id)
			.single()

		const payload = {
			account_id: profile?.account_id,
			name: formData.name.trim(),
			title: formData.title.trim(),
			description: formData.description.trim(),
			theme_color: formData.theme_color,
			pipeline_id: formData.pipeline_id === "none" ? null : formData.pipeline_id,
			stage_id: formData.stage_id === "none" ? null : formData.stage_id,
			fields_config: formData.fields_config,
		}

		let result
		if (isNew) {
			result = await supabase.from("web_forms").insert(payload).select().single()
		} else {
			result = await supabase
				.from("web_forms")
				.update(payload)
				.eq("id", formId)
				.select()
				.single()
		}

		setSaving(false)

		if (result.error) {
			toast.error(result.error.message || "Error al guardar el formulario")
		} else {
			toast.success("Formulario guardado exitosamente")
			if (isNew && result.data) {
				router.replace(`/forms/${result.data.id}`)
			}
		}
	}

	function handleFieldToggle(field: string, prop: "enabled" | "required") {
		setFormData((prev) => {
			const currentConfig = (prev.fields_config as any)[field]
			const updatedField = { ...currentConfig, [prop]: !currentConfig[prop] }

			// Si se activa 'required', tambien debe activarse 'enabled'
			if (prop === "required" && updatedField.required) {
				updatedField.enabled = true
			}
			// Si se desactiva 'enabled', tambien debe desactivarse 'required'
			if (prop === "enabled" && !updatedField.enabled) {
				updatedField.required = false
			}

			return {
				...prev,
				fields_config: {
					...prev.fields_config,
					[field]: updatedField,
				},
			}
		})
	}

	function addCustomField() {
		setFormData((prev) => ({
			...prev,
			fields_config: {
				...prev.fields_config,
				custom: [
					...prev.fields_config.custom,
					{ id: `custom_${Date.now()}`, label: "", required: false },
				],
			},
		}))
	}

	function updateCustomField(
		id: string,
		updates: Partial<{ label: string; required: boolean }>
	) {
		setFormData((prev) => ({
			...prev,
			fields_config: {
				...prev.fields_config,
				custom: prev.fields_config.custom.map((cf) =>
					cf.id === id ? { ...cf, ...updates } : cf
				),
			},
		}))
	}

	function removeCustomField(id: string) {
		setFormData((prev) => ({
			...prev,
			fields_config: {
				...prev.fields_config,
				custom: prev.fields_config.custom.filter((cf) => cf.id !== id),
			},
		}))
	}

	const selectedPipeline = pipelines.find((p) => p.id === formData.pipeline_id)

	if (loading) {
		return (
			<div className="flex h-[60vh] items-center justify-center">
				<Loader2 className="h-7 w-7 animate-spin text-primary" />
			</div>
		)
	}

	const appUrl =
		typeof window !== "undefined"
			? window.location.origin
			: process.env.NEXT_PUBLIC_APP_URL ?? ""

	const publicFormUrl = formId ? `${appUrl}/f/${formId}` : ""

	const embedCode = formId
		? `<!-- NeoWapp Form Widget -->
<div id="nw-form-${formId}"></div>
<script>
(function() {
  var fid = "${formId}", cid = "nw-form-" + fid;
  var c = document.getElementById(cid); if (!c) return;
  var f = document.createElement("iframe");
  f.src = "${appUrl}/f/" + fid;
  f.id = "nw-iframe-" + fid;
  f.style.cssText = "width:100%;border:none;display:block;min-height:480px;transition:height 0.2s ease;";
  f.setAttribute("frameborder", "0");
  f.setAttribute("scrolling", "no");
  f.setAttribute("allowtransparency", "true");
  c.appendChild(f);
  window.addEventListener("message", function(e) {
    if (e.data && e.data.type === "nw-form-resize" && e.data.formId === fid) {
      f.style.height = (e.data.height + 24) + "px";
    }
  });
})();
<\/script>`
		: ""

	return (
		<div className="mx-auto max-w-5xl space-y-6 pb-20">
			{/* Barra superior y acciones */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
				<div className="flex items-center gap-3">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => router.push("/forms")}
						className="h-9 w-9 rounded-lg hover:bg-muted cursor-pointer"
					>
						<ArrowLeft className="h-4 w-4" />
					</Button>
					<div>
						<div className="flex items-center gap-2 text-xs text-muted-foreground">
							<span
								onClick={() => router.push("/forms")}
								className="hover:underline cursor-pointer"
							>
								Formularios Web
							</span>
							<span>/</span>
							<span className="font-medium text-foreground truncate max-w-xs">
								{formData.name || (isNew ? "Nuevo Formulario" : "Editar")}
							</span>
						</div>
						<h1 className="text-xl font-bold text-foreground">
							{isNew ? "Crear Formulario Web" : "Editar Formulario Web"}
						</h1>
					</div>
				</div>

				<div className="flex items-center gap-2 shrink-0">
					{!isNew && (
						<>
							<Button
								variant="outline"
								size="sm"
								onClick={() => window.open(publicFormUrl, "_blank")}
								className="h-9 text-xs gap-1.5 cursor-pointer"
								title="Abrir vista previa del formulario en una nueva pestaña"
							>
								<ExternalLink className="h-3.5 w-3.5" />
								<span className="hidden sm:inline">Vista Previa</span>
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowEmbedCode(true)}
								className="h-9 text-xs gap-1.5 cursor-pointer"
							>
								<Code className="h-3.5 w-3.5" />
								<span>Código Embed</span>
							</Button>
						</>
					)}
					<Button
						size="sm"
						onClick={save}
						disabled={saving}
						className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer shadow-xs"
					>
						{saving ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							<Save className="h-3.5 w-3.5" />
						)}
						Guardar Formulario
					</Button>
				</div>
			</div>

			{/* Selector de Pestañas de Navegación Segmentada */}
			<div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-2xl border border-border/70 max-w-2xl mx-auto shadow-2xs">
				<button
					type="button"
					onClick={() => setActiveTab("general")}
					className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
						activeTab === "general"
							? "bg-card text-foreground shadow-xs border border-border/50"
							: "text-muted-foreground hover:text-foreground"
					}`}
				>
					<Sliders className="h-3.5 w-3.5 text-primary" />
					<span>General y Diseño</span>
				</button>

				<button
					type="button"
					onClick={() => setActiveTab("fields")}
					className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
						activeTab === "fields"
							? "bg-card text-foreground shadow-xs border border-border/50"
							: "text-muted-foreground hover:text-foreground"
					}`}
				>
					<CheckSquare className="h-3.5 w-3.5 text-blue-600" />
					<span>Campos y Preguntas</span>
					<span className="ml-0.5 text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-mono font-bold">
						{(formData.fields_config.name?.enabled ? 1 : 0) +
							(formData.fields_config.email?.enabled ? 1 : 0) +
							(formData.fields_config.phone?.enabled ? 1 : 0) +
							(formData.fields_config.company?.enabled ? 1 : 0) +
							(formData.fields_config.custom?.length || 0)}
					</span>
				</button>

				<button
					type="button"
					onClick={() => setActiveTab("crm")}
					className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
						activeTab === "crm"
							? "bg-card text-foreground shadow-xs border border-border/50"
							: "text-muted-foreground hover:text-foreground"
					}`}
				>
					<Layers className="h-3.5 w-3.5 text-emerald-600" />
					<span>Integración CRM</span>
					{formData.pipeline_id !== "none" && (
						<span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
					)}
				</button>

				<button
					type="button"
					onClick={() => setActiveTab("preview")}
					className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
						activeTab === "preview"
							? "bg-card text-foreground shadow-xs border border-border/50"
							: "text-muted-foreground hover:text-foreground"
					}`}
				>
					<Eye className="h-3.5 w-3.5 text-amber-600" />
					<span>Vista Previa</span>
				</button>
			</div>

			{/* Pestaña 1: General y Diseño */}
			{activeTab === "general" && (
				<div className="mx-auto max-w-2xl rounded-2xl border border-border/70 bg-card p-6 sm:p-8 shadow-xs space-y-6 animate-in fade-in duration-200">
					<div className="flex items-center gap-3 pb-4 border-b border-border/50">
						<div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
							<Sliders className="h-4.5 w-4.5" />
						</div>
						<div>
							<h2 className="text-base font-bold text-foreground">
								Ajustes Generales e Identidad Visual
							</h2>
							<p className="text-xs text-muted-foreground">
								Configura el nombre identificador para tu CRM y el aspecto público del formulario
							</p>
						</div>
					</div>

					<div className="space-y-4">
						<div>
							<Label className="text-xs font-semibold text-foreground">Nombre Interno (CRM)</Label>
							<Input
								placeholder="ej. Formulario de Contacto Web"
								value={formData.name}
								onChange={(e) => setFormData({ ...formData, name: e.target.value })}
								className="mt-1.5 h-10 text-xs bg-muted/30"
							/>
							<p className="mt-1 text-[11px] text-muted-foreground">
								Nombre visible únicamente para los miembros de tu equipo en el dashboard
							</p>
						</div>

						<div>
							<Label className="text-xs font-semibold text-foreground">Título Público</Label>
							<Input
								placeholder="ej. Contacta a nuestros expertos"
								value={formData.title}
								onChange={(e) => setFormData({ ...formData, title: e.target.value })}
								className="mt-1.5 h-10 text-xs bg-muted/30 font-medium"
							/>
							<p className="mt-1 text-[11px] text-muted-foreground">
								Encabezado principal visible por los visitantes en tu sitio web
							</p>
						</div>

						<div>
							<Label className="text-xs font-semibold text-foreground">
								Descripción o Subtítulo Público
							</Label>
							<Textarea
								placeholder="Estamos listos para ayudarte a transformar tu negocio con automatización inteligente..."
								value={formData.description}
								onChange={(e) =>
									setFormData({ ...formData, description: e.target.value })
								}
								rows={3}
								className="mt-1.5 text-xs bg-muted/30 resize-none leading-relaxed"
							/>
						</div>

						{/* Selector de Color de Tema */}
						<div className="pt-2 border-t border-border/40">
							<div className="flex items-center justify-between mb-2">
								<Label className="text-xs font-semibold text-foreground">Color de Tema y Marca</Label>
								<span className="text-[11px] text-muted-foreground">
									Aplica a botones, títulos y acentos
								</span>
							</div>

							<div className="flex flex-wrap items-center gap-2.5">
								{THEME_PRESETS.map((preset) => {
									const isSelected =
										formData.theme_color.toLowerCase() === preset.hex.toLowerCase()
									return (
										<button
											key={preset.hex}
											type="button"
											onClick={() =>
												setFormData({ ...formData, theme_color: preset.hex })
											}
											className="h-8 w-8 rounded-full flex items-center justify-center transition-all hover:scale-110 cursor-pointer shadow-xs"
											style={{
												backgroundColor: preset.hex,
												boxShadow: isSelected
													? `0 0 0 2px var(--background), 0 0 0 4px ${preset.hex}`
													: undefined,
											}}
											title={preset.label}
										>
											{isSelected && <Check className="h-4 w-4 text-white" />}
										</button>
									)
								})}
							</div>

							<div className="mt-3 flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/50">
								<Input
									type="color"
									className="h-9 w-14 p-1 rounded-lg cursor-pointer"
									value={formData.theme_color}
									onChange={(e) =>
										setFormData({ ...formData, theme_color: e.target.value })
									}
								/>
								<Input
									type="text"
									value={formData.theme_color}
									onChange={(e) =>
										setFormData({ ...formData, theme_color: e.target.value })
									}
									className="h-9 w-32 text-xs font-mono uppercase bg-background"
								/>
								<div className="ml-auto flex items-center gap-2">
									<div
										className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-xs"
										style={{ backgroundColor: formData.theme_color }}
									>
										Botón de Muestra
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Boton de navegacion siguiente */}
					<div className="pt-4 border-t border-border/50 flex justify-end">
						<Button
							type="button"
							onClick={() => setActiveTab("fields")}
							className="text-xs gap-2 cursor-pointer bg-primary text-primary-foreground"
						>
							<span>Siguiente: Configurar Campos</span>
							<ArrowRight className="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>
			)}

			{/* Pestaña 2: Campos y Preguntas */}
			{activeTab === "fields" && (
				<div className="mx-auto max-w-2xl rounded-2xl border border-border/70 bg-card p-6 sm:p-8 shadow-xs space-y-6 animate-in fade-in duration-200">
					<div className="flex items-center gap-3 pb-4 border-b border-border/50">
						<div className="h-9 w-9 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center">
							<CheckSquare className="h-4.5 w-4.5" />
						</div>
						<div>
							<h2 className="text-base font-bold text-foreground">
								Campos y Preguntas del Formulario
							</h2>
							<p className="text-xs text-muted-foreground">
								Activa los datos de contacto y formula preguntas adicionales
							</p>
						</div>
					</div>

					{/* Bloque 1: Campos Predeterminados */}
					<div className="space-y-3">
						<h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
							Datos de Contacto Principales
						</h3>

						<div className="rounded-xl border border-border/60 overflow-hidden divide-y divide-border/40">
							<div className="grid grid-cols-[1fr_auto_auto] gap-4 bg-muted/40 p-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								<div>Campo</div>
								<div className="w-16 text-center">Activo</div>
								<div className="w-16 text-center">Requerido</div>
							</div>

							{[
								{ id: "name", label: "Nombre Completo", icon: User, locked: true },
								{ id: "email", label: "Correo Electrónico", icon: Mail, locked: true },
								{ id: "phone", label: "Teléfono Móvil", icon: Phone, locked: false },
								{ id: "company", label: "Empresa u Organización", icon: Building2, locked: false },
							].map((field) => {
								const config = (formData.fields_config as any)[field.id]
								const Icon = field.icon

								return (
									<div
										key={field.id}
										className="grid grid-cols-[1fr_auto_auto] gap-4 items-center p-3 hover:bg-muted/20 transition-colors text-xs"
									>
										<div className="flex items-center gap-2.5 min-w-0">
											<div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0">
												<Icon className="h-3.5 w-3.5" />
											</div>
											<div className="truncate">
												<span className="font-semibold text-foreground">
													{field.label}
												</span>
												{field.locked && (
													<span className="ml-2 text-[10px] text-muted-foreground font-normal">
														(Obligatorio)
													</span>
												)}
											</div>
										</div>

										<div className="w-16 flex justify-center">
											<Switch
												checked={config.enabled}
												onCheckedChange={() => handleFieldToggle(field.id, "enabled")}
												disabled={field.locked}
											/>
										</div>

										<div className="w-16 flex justify-center">
											<Switch
												checked={config.required}
												onCheckedChange={() => handleFieldToggle(field.id, "required")}
												disabled={field.locked || !config.enabled}
											/>
										</div>
									</div>
								)
							})}
						</div>
					</div>

					{/* Bloque 2: Campos Personalizados */}
					<div className="space-y-3 pt-2">
						<div className="flex items-center justify-between">
							<div>
								<h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
									Preguntas Adicionales y Campos Personalizados
								</h3>
								<p className="text-[11px] text-muted-foreground mt-0.5">
									Las respuestas se guardarán en las notas del contacto y la oportunidad en el CRM
								</p>
							</div>
						</div>

						<div className="space-y-2.5">
							{formData.fields_config.custom.length === 0 ? (
								<p className="text-xs text-muted-foreground text-center py-5 bg-muted/20 rounded-xl border border-dashed border-border/70">
									No hay preguntas personalizadas configuradas todavía.
								</p>
							) : (
								formData.fields_config.custom.map((cf) => (
									<div
										key={cf.id}
										className="flex items-center gap-2 p-2.5 rounded-xl border border-border/70 bg-muted/20 text-xs"
									>
										<Input
											placeholder="ej. ¿A qué se dedica tu empresa?"
											value={cf.label}
											onChange={(e) =>
												updateCustomField(cf.id, { label: e.target.value })
											}
											className="h-9 text-xs bg-background flex-1"
										/>
										<div className="flex items-center gap-1.5 shrink-0 px-2">
											<span className="text-[11px] text-muted-foreground">
												Requerido
											</span>
											<Switch
												checked={cf.required}
												onCheckedChange={(v) =>
													updateCustomField(cf.id, { required: v })
												}
											/>
										</div>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => removeCustomField(cf.id)}
											className="h-8 w-8 text-muted-foreground hover:text-rose-500 cursor-pointer shrink-0"
										>
											<Trash2 className="h-3.5 w-3.5" />
										</Button>
									</div>
								))
							)}

							<Button
								variant="outline"
								size="sm"
								onClick={addCustomField}
								className="w-full h-9 text-xs gap-1.5 cursor-pointer border-dashed hover:border-primary/60 hover:bg-primary/5"
							>
								<Plus className="h-3.5 w-3.5 text-primary" />
								<span>Añadir Pregunta / Campo Extra</span>
							</Button>
						</div>
					</div>

					{/* Botones de navegacion */}
					<div className="pt-4 border-t border-border/50 flex items-center justify-between">
						<Button
							type="button"
							variant="outline"
							onClick={() => setActiveTab("general")}
							className="text-xs cursor-pointer"
						>
							Anterior: General y Diseño
						</Button>
						<Button
							type="button"
							onClick={() => setActiveTab("crm")}
							className="text-xs gap-2 cursor-pointer bg-primary text-primary-foreground"
						>
							<span>Siguiente: Integración CRM</span>
							<ArrowRight className="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>
			)}

			{/* Pestaña 3: Integración CRM */}
			{activeTab === "crm" && (
				<div className="mx-auto max-w-2xl rounded-2xl border border-border/70 bg-card p-6 sm:p-8 shadow-xs space-y-6 animate-in fade-in duration-200">
					<div className="flex items-center gap-3 pb-4 border-b border-border/50">
						<div className="h-9 w-9 rounded-xl bg-emerald-600/10 text-emerald-600 flex items-center justify-center">
							<Layers className="h-4.5 w-4.5" />
						</div>
						<div>
							<h2 className="text-base font-bold text-foreground">
								Integración Comercial y Pipeline
							</h2>
							<p className="text-xs text-muted-foreground">
								Crea contactos y abre oportunidades automáticamente en tus embudos de venta
							</p>
						</div>
					</div>

					<div className="space-y-4">
						<div>
							<Label className="text-xs font-semibold text-foreground">
								Embudo de Ventas (Pipeline)
							</Label>
							<select
								className="mt-1.5 block w-full rounded-xl border border-input bg-muted/30 px-3.5 py-2.5 text-xs text-foreground focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
								value={formData.pipeline_id}
								onChange={(e) => {
									const pid = e.target.value
									setFormData({
										...formData,
										pipeline_id: pid,
										stage_id:
											pid === "none"
												? "none"
												: pipelines.find((p) => p.id === pid)
														?.pipeline_stages?.[0]?.id || "none",
									})
								}}
							>
								<option value="none">No crear negociación (solo registrar contacto)</option>
								{pipelines.map((p) => (
									<option key={p.id} value={p.id}>
										{p.name}
									</option>
								))}
							</select>
							<p className="mt-1 text-[11px] text-muted-foreground">
								Embudo en el que se creará la oportunidad cuando un visitante responda
							</p>
						</div>

						{formData.pipeline_id !== "none" && selectedPipeline && (
							<div>
								<Label className="text-xs font-semibold text-foreground">
									Etapa Inicial de la Negociación
								</Label>
								<select
									className="mt-1.5 block w-full rounded-xl border border-input bg-muted/30 px-3.5 py-2.5 text-xs text-foreground focus:bg-background focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
									value={formData.stage_id}
									onChange={(e) =>
										setFormData({ ...formData, stage_id: e.target.value })
									}
								>
									{selectedPipeline.pipeline_stages
										?.sort((a: any, b: any) => a.position - b.position)
										.map((s: any) => (
											<option key={s.id} value={s.id}>
												{s.name}
											</option>
										))}
								</select>
							</div>
						)}

						{/* Resumen explicativo del flujo de automatizacion */}
						<div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40 space-y-2">
							<div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300">
								<Sparkles className="h-4 w-4" />
								<span>Flujo automático garantizado</span>
							</div>
							<p className="text-xs text-emerald-700/90 dark:text-emerald-400 leading-relaxed">
								Cada vez que una persona complete este formulario:
							</p>
							<ul className="text-xs text-emerald-700/80 dark:text-emerald-400/80 space-y-1 list-disc pl-4 leading-relaxed">
								<li>Se creará o actualizará la ficha del contacto por email o teléfono.</li>
								<li>
									{formData.pipeline_id !== "none"
										? "Se abrirá una nueva negociación en la etapa configurada con fecha estimada a 3 meses."
										: "El contacto quedará guardado para tu equipo comercial."}
								</li>
								<li>
									Todas las respuestas personalizadas se registrarán en las notas del contacto y de la oportunidad.
								</li>
							</ul>
						</div>
					</div>

					{/* Botones de navegacion */}
					<div className="pt-4 border-t border-border/50 flex items-center justify-between">
						<Button
							type="button"
							variant="outline"
							onClick={() => setActiveTab("fields")}
							className="text-xs cursor-pointer"
						>
							Anterior: Campos y Preguntas
						</Button>
						<Button
							type="button"
							onClick={() => setActiveTab("preview")}
							className="text-xs gap-2 cursor-pointer bg-primary text-primary-foreground"
						>
							<span>Ver Vista Previa en Vivo</span>
							<ArrowRight className="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>
			)}

			{/* Pestaña 4: Vista Previa en Vivo */}
			{activeTab === "preview" && (
				<div className="mx-auto max-w-3xl space-y-4 animate-in fade-in duration-200">
					{/* Barra de control de la vista previa */}
					<div className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/70 shadow-2xs">
						<div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg">
							<button
								type="button"
								onClick={() => setPreviewDevice("desktop")}
								className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
									previewDevice === "desktop"
										? "bg-card text-foreground shadow-2xs"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								<Monitor className="h-3.5 w-3.5" />
								<span>Escritorio</span>
							</button>
							<button
								type="button"
								onClick={() => setPreviewDevice("mobile")}
								className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
									previewDevice === "mobile"
										? "bg-card text-foreground shadow-2xs"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								<Smartphone className="h-3.5 w-3.5" />
								<span>Móvil</span>
							</button>
						</div>

						{!isNew && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => window.open(publicFormUrl, "_blank")}
								className="h-8 text-xs gap-1.5 cursor-pointer"
							>
								<ExternalLink className="h-3.5 w-3.5" />
								<span>Abrir en nueva pestaña</span>
							</Button>
						)}
					</div>

					{/* Contenedor del Mockup del Formulario */}
					<div className="flex justify-center p-4 sm:p-8 rounded-2xl bg-slate-100/70 dark:bg-zinc-900/50 border border-border/60">
						<div
							className={`w-full transition-all duration-300 ${
								previewDevice === "mobile"
									? "max-w-sm rounded-[2.5rem] border-8 border-slate-800 bg-white shadow-2xl p-6 overflow-hidden"
									: "max-w-xl rounded-2xl border border-slate-200 bg-white p-7 sm:p-8 shadow-xl shadow-slate-200/50 relative overflow-hidden"
							}`}
						>
							{/* Barra superior de acento con el color del tema */}
							<div
								className="absolute top-0 left-0 right-0 h-1.5"
								style={{ backgroundColor: formData.theme_color }}
							/>

							{/* Cabecera del formulario en tiempo real */}
							<div className="mb-6 text-center">
								<h2
									className="text-xl sm:text-2xl font-extrabold tracking-tight"
									style={{ color: formData.theme_color }}
								>
									{formData.title || "Título del Formulario"}
								</h2>
								{formData.description && (
									<p className="mt-2 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
										{formData.description}
									</p>
								)}
							</div>

							{/* Campos del formulario en tiempo real */}
							<div className="space-y-4">
								{formData.fields_config.name?.enabled && (
									<div>
										<label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
											Nombre Completo{" "}
											{formData.fields_config.name.required && (
												<span className="text-rose-500">*</span>
											)}
										</label>
										<input
											type="text"
											readOnly
											placeholder="Tu nombre completo"
											className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-700 pointer-events-none placeholder:text-slate-400"
										/>
									</div>
								)}

								{formData.fields_config.email?.enabled && (
									<div>
										<label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
											Correo Electrónico{" "}
											{formData.fields_config.email.required && (
												<span className="text-rose-500">*</span>
											)}
										</label>
										<input
											type="email"
											readOnly
											placeholder="correo@ejemplo.com"
											className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-700 pointer-events-none placeholder:text-slate-400"
										/>
									</div>
								)}

								{formData.fields_config.phone?.enabled && (
									<div>
										<label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
											Teléfono{" "}
											{formData.fields_config.phone.required && (
												<span className="text-rose-500">*</span>
											)}
										</label>
										<div className="flex rounded-xl border border-slate-200 bg-slate-50/50 overflow-hidden pointer-events-none">
											<div className="flex items-center gap-1.5 px-3 py-2 bg-slate-100/80 border-r border-slate-200 text-xs">
												<img
													src="https://flagcdn.com/20x15/cl.png"
													alt="Chile"
													width={18}
													height={14}
													className="rounded-xs"
												/>
											</div>
											<input
												type="tel"
												readOnly
												placeholder="+56 9 1234 5678"
												className="w-full px-3.5 py-2 text-xs text-slate-700 placeholder:text-slate-400 bg-transparent font-mono"
											/>
										</div>
									</div>
								)}

								{formData.fields_config.company?.enabled && (
									<div>
										<label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
											Empresa{" "}
											{formData.fields_config.company.required && (
												<span className="text-rose-500">*</span>
											)}
										</label>
										<input
											type="text"
											readOnly
											placeholder="Nombre de tu empresa u organización"
											className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-700 pointer-events-none placeholder:text-slate-400"
										/>
									</div>
								)}

								{formData.fields_config.custom?.map((cf) => (
									<div key={cf.id}>
										<label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 mb-1">
											{cf.label || "Pregunta adicional"}{" "}
											{cf.required && <span className="text-rose-500">*</span>}
										</label>
										<textarea
											readOnly
											rows={2}
											placeholder="Escribe tu respuesta aquí..."
											className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-700 pointer-events-none placeholder:text-slate-400 resize-none"
										/>
									</div>
								))}

								<button
									type="button"
									disabled
									className="mt-5 flex w-full items-center justify-center rounded-xl py-2.5 px-4 text-xs font-semibold text-white shadow-md cursor-default"
									style={{ backgroundColor: formData.theme_color }}
								>
									Enviar Mensaje
								</button>

								<div className="pt-3 flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium">
									<ShieldCheck className="h-3 w-3 text-emerald-600" />
									<span>Formulario protegido contra spam y cifrado</span>
								</div>
							</div>
						</div>
					</div>

					{/* Botones inferiores */}
					<div className="p-4 rounded-xl bg-card border border-border/70 flex items-center justify-between">
						<Button
							type="button"
							variant="outline"
							onClick={() => setActiveTab("general")}
							className="text-xs cursor-pointer"
						>
							Volver al Editor
						</Button>
						<Button
							onClick={save}
							disabled={saving}
							className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer shadow-xs"
						>
							{saving ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Save className="h-3.5 w-3.5" />
							)}
							Guardar Formulario
						</Button>
					</div>
				</div>
			)}

			{/* Modal de Codigo Embed Corregido (sin desbordamiento y con diseño premium) */}
			<Dialog open={showEmbedCode} onOpenChange={setShowEmbedCode}>
				<DialogContent className="w-full sm:max-w-2xl md:max-w-3xl overflow-hidden p-6 border-border bg-card shadow-2xl">
					<DialogHeader>
						<div className="flex items-center gap-2 text-primary mb-1">
							<Code className="h-5 w-5" />
							<DialogTitle className="text-lg font-bold text-foreground">
								Incrustar Formulario Web
							</DialogTitle>
						</div>
						<DialogDescription className="text-xs text-muted-foreground leading-relaxed">
							Inserta este widget en cualquier parte del HTML de tu sitio web (WordPress,
							Shopify, Webflow, React, HTML plano, etc.) para capturar leads directamente en
							tu CRM.
						</DialogDescription>
					</DialogHeader>

					<div className="mt-4 space-y-4">
						{/* Enlace directo / Vista Previa */}
						<div className="rounded-xl border border-border/70 bg-muted/30 p-3.5 space-y-2">
							<div className="flex items-center justify-between text-xs font-semibold text-foreground">
								<span>Enlace directo al formulario:</span>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => window.open(publicFormUrl, "_blank")}
									className="h-6 text-xs text-primary gap-1 cursor-pointer"
								>
									<ExternalLink className="h-3 w-3" /> Abrir en nueva pestaña
								</Button>
							</div>
							<div className="flex items-center gap-2">
								<Input
									readOnly
									value={publicFormUrl}
									className="h-8 text-xs font-mono bg-background text-foreground/80 select-all"
								/>
								<Button
									size="sm"
									variant="outline"
									onClick={() => {
										navigator.clipboard.writeText(publicFormUrl)
										setCopiedLink(true)
										toast.success("Enlace copiado al portapapeles")
										setTimeout(() => setCopiedLink(false), 2000)
									}}
									className="h-8 text-xs shrink-0 gap-1.5 cursor-pointer"
								>
									{copiedLink ? (
										<Check className="h-3.5 w-3.5 text-emerald-600" />
									) : (
										<Copy className="h-3.5 w-3.5" />
									)}
									{copiedLink ? "Copiado" : "Copiar"}
								</Button>
							</div>
						</div>

						{/* Codigo HTML / Iframe responsivo */}
						<div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden shadow-inner">
							<div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/80 bg-zinc-900/60">
								<div className="flex items-center gap-1.5">
									<div className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
									<div className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
									<div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
									<span className="ml-2 text-[11px] font-mono text-zinc-400">
										widget-embed.html
									</span>
								</div>
								<Button
									size="sm"
									onClick={() => {
										navigator.clipboard.writeText(embedCode)
										setCopiedEmbed(true)
										toast.success("Código embed copiado al portapapeles")
										setTimeout(() => setCopiedEmbed(false), 2000)
									}}
									className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 cursor-pointer shadow-xs"
								>
									{copiedEmbed ? (
										<Check className="h-3.5 w-3.5" />
									) : (
										<Copy className="h-3.5 w-3.5" />
									)}
									{copiedEmbed ? "¡Código Copiado!" : "Copiar Código"}
								</Button>
							</div>

							<pre className="p-4 text-[11px] font-mono text-emerald-400/95 overflow-x-auto max-h-64 leading-relaxed select-all">
								{embedCode}
							</pre>
						</div>

						<p className="text-[11px] text-muted-foreground leading-relaxed">
							Tip: El widget detecta y ajusta la altura automáticamente mediante eventos
							de iframe responsivo, sin mostrar barras de scroll feas en tu página web.
						</p>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	)
}
