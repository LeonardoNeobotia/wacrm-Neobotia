"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog"
import {
	Search,
	Download,
	RefreshCw,
	Eye,
	Inbox,
	Loader2,
	ExternalLink,
	Globe,
	Phone,
	Mail,
	User,
} from "lucide-react"

export interface FormSubmissionRow {
	id: string
	formId: string
	formTitle: string
	contactId?: string | null
	contactName?: string | null
	contactPhone?: string | null
	contactEmail?: string | null
	contactCompany?: string | null
	dealId?: string | null
	dealTitle?: string | null
	subject?: string | null
	message?: string | null
	fullData: Record<string, any>
	ipAddress?: string | null
	userAgent?: string | null
	createdAt: string
}

/**
 * Formatea una fecha ISO a fecha y hora en formato legible chileno (DD/MM/YYYY HH:mm).
 */
function formatDateTime(dateStr?: string | null) {
	if (!dateStr) return { date: "-", time: "" }
	try {
		const d = new Date(dateStr)
		if (isNaN(d.getTime())) return { date: "-", time: "" }
		const day = String(d.getDate()).padStart(2, "0")
		const month = String(d.getMonth() + 1).padStart(2, "0")
		const year = d.getFullYear()
		const hours = String(d.getHours()).padStart(2, "0")
		const minutes = String(d.getMinutes()).padStart(2, "0")
		return {
			date: `${day}/${month}/${year}`,
			time: `${hours}:${minutes}`,
		}
	} catch {
		return { date: "-", time: "" }
	}
}

export function FormSubmissionsTable() {
	const [submissions, setSubmissions] = useState<FormSubmissionRow[]>([])
	const [loading, setLoading] = useState(true)
	const [search, setSearch] = useState("")
	const [selectedForm, setSelectedForm] = useState<string>("all")
	const [detailRow, setDetailRow] = useState<FormSubmissionRow | null>(null)
	const [formTitles, setFormTitles] = useState<string[]>([])

	const loadSubmissions = async () => {
		setLoading(true)
		try {
			const supabase = createClient()

			// 1. Intentar consultar desde la tabla dedicada web_form_submissions
			const { data: directSubs, error: subError } = await supabase
				.from("web_form_submissions")
				.select(`
					id,
					form_id,
					contact_id,
					deal_id,
					data,
					ip_address,
					user_agent,
					created_at,
					web_forms ( id, title, name ),
					contacts ( id, name, phone, email, company ),
					deals ( id, title )
				`)
				.order("created_at", { ascending: false })
				.limit(100)

			if (!subError && directSubs && directSubs.length > 0) {
				const rows: FormSubmissionRow[] = directSubs.map((s: any) => {
					const f = Array.isArray(s.web_forms) ? s.web_forms[0] : s.web_forms
					const c = Array.isArray(s.contacts) ? s.contacts[0] : s.contacts
					const d = Array.isArray(s.deals) ? s.deals[0] : s.deals
					const data = s.data || {}

					const subject = data.asunto || data.subject || data.motivo || ""
					const message = data.mensaje || data.message || data.comentario || data.comments || ""

					return {
						id: s.id,
						formId: s.form_id,
						formTitle: f?.title || f?.name || "Formulario Web",
						contactId: s.contact_id,
						contactName: c?.name || data.name || data.nombre || "Lead Web",
						contactPhone: c?.phone || data.phone || data.telefono || null,
						contactEmail: c?.email || data.email || data.correo || null,
						contactCompany: c?.company || data.company || data.empresa || null,
						dealId: s.deal_id,
						dealTitle: d?.title || null,
						subject: String(subject || "").trim() || null,
						message: String(message || "").trim() || null,
						fullData: data,
						ipAddress: s.ip_address,
						userAgent: s.user_agent,
						createdAt: s.created_at,
					}
				})
				setSubmissions(rows)
				const uniqueForms = Array.from(new Set(rows.map((r) => r.formTitle))).filter(Boolean)
				setFormTitles(uniqueForms)
				setLoading(false)
				return
			}

			// 2. Respaldo inteligente: si la tabla no existe o no tiene datos, extraer desde contact_notes
			const { data: notes, error: notesError } = await supabase
				.from("contact_notes")
				.select(`
					id,
					contact_id,
					note_text,
					created_at,
					contacts ( id, name, phone, email, company )
				`)
				.like("note_text", "[Formulario:%")
				.order("created_at", { ascending: false })
				.limit(100)

			if (!notesError && notes) {
				const rows: FormSubmissionRow[] = notes.map((n: any) => {
					const c = Array.isArray(n.contacts) ? n.contacts[0] : n.contacts
					const text = n.note_text || ""

					// Extraer titulo de formulario: [Formulario: Nombre]
					const matchTitle = text.match(/\[Formulario:\s*([^\]]+)\]/)
					const formTitle = matchTitle ? matchTitle[1].trim() : "Formulario Web"

					// Extraer campos estructurados: Label: Valor
					const fullData: Record<string, string> = {}
					const lines = text.split("\n\n")
					lines.forEach((part: string) => {
						const colonIdx = part.indexOf(":")
						if (colonIdx > 0 && !part.startsWith("[Formulario")) {
							const k = part.substring(0, colonIdx).trim()
							const v = part.substring(colonIdx + 1).trim()
							fullData[k] = v
						}
					})

					const subject = fullData["Asunto"] || fullData["Subject"] || null
					const message = fullData["Mensaje"] || fullData["Message"] || null

					return {
						id: n.id,
						formId: "note-source",
						formTitle,
						contactId: n.contact_id,
						contactName: c?.name || "Lead Web",
						contactPhone: c?.phone || null,
						contactEmail: c?.email || null,
						contactCompany: c?.company || null,
						dealId: null,
						dealTitle: null,
						subject,
						message,
						fullData,
						ipAddress: null,
						userAgent: null,
						createdAt: n.created_at,
					}
				})
				setSubmissions(rows)
				const uniqueForms = Array.from(new Set(rows.map((r) => r.formTitle))).filter(Boolean)
				setFormTitles(uniqueForms)
			}
		} catch (err) {
			console.error("Error al cargar envíos:", err)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		loadSubmissions()
	}, [])

	// Filtrado de envíos por texto y formulario
	const filtered = useMemo(() => {
		return submissions.filter((item) => {
			if (selectedForm !== "all" && item.formTitle !== selectedForm) {
				return false
			}
			if (!search.trim()) return true
			const term = search.toLowerCase()
			const nameMatch = (item.contactName || "").toLowerCase().includes(term)
			const phoneMatch = (item.contactPhone || "").toLowerCase().includes(term)
			const emailMatch = (item.contactEmail || "").toLowerCase().includes(term)
			const formMatch = (item.formTitle || "").toLowerCase().includes(term)
			const subjectMatch = (item.subject || "").toLowerCase().includes(term)
			const messageMatch = (item.message || "").toLowerCase().includes(term)
			return nameMatch || phoneMatch || emailMatch || formMatch || subjectMatch || messageMatch
		})
	}, [submissions, search, selectedForm])

	// Exportar a archivo CSV (con BOM para visualización correcta en Excel)
	const exportToCSV = () => {
		if (filtered.length === 0) return
		const headers = [
			"Fecha",
			"Hora",
			"Formulario",
			"Nombre Lead",
			"Telefono",
			"Correo",
			"Empresa",
			"Asunto",
			"Mensaje",
			"IP",
		]

		const rows = filtered.map((item) => {
			const dt = formatDateTime(item.createdAt)
			return [
				`"${dt.date}"`,
				`"${dt.time}"`,
				`"${(item.formTitle || "").replace(/"/g, '""')}"`,
				`"${(item.contactName || "").replace(/"/g, '""')}"`,
				`"${(item.contactPhone || "").replace(/"/g, '""')}"`,
				`"${(item.contactEmail || "").replace(/"/g, '""')}"`,
				`"${(item.contactCompany || "").replace(/"/g, '""')}"`,
				`"${(item.subject || "").replace(/"/g, '""')}"`,
				`"${(item.message || "").replace(/"/g, '""')}"`,
				`"${(item.ipAddress || "").replace(/"/g, '""')}"`,
			].join(",")
		})

		const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n")
		const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
		const url = URL.createObjectURL(blob)
		const link = document.createElement("a")
		link.href = url
		link.setAttribute("download", `envios_formularios_${new Date().toISOString().split("T")[0]}.csv`)
		document.body.appendChild(link)
		link.click()
		document.body.removeChild(link)
	}

	return (
		<div className="space-y-4">
			{/* Barra superior de busqueda y controles */}
			<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
				<div className="flex items-center gap-2 flex-1 max-w-md">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Buscar por lead, teléfono, correo o asunto..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="pl-9 text-sm"
						/>
					</div>
					{formTitles.length > 1 && (
						<select
							value={selectedForm}
							onChange={(e) => setSelectedForm(e.target.value)}
							className="h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
						>
							<option value="all">Todos los formularios</option>
							{formTitles.map((t) => (
								<option key={t} value={t}>
									{t}
								</option>
							))}
						</select>
					)}
				</div>

				<div className="flex items-center gap-2 justify-end">
					<Button
						variant="outline"
						size="sm"
						onClick={exportToCSV}
						disabled={filtered.length === 0}
						className="gap-1.5 text-xs"
					>
						<Download className="h-3.5 w-3.5" />
						Exportar CSV
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={loadSubmissions}
						disabled={loading}
						className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
					>
						<RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
						Actualizar
					</Button>
				</div>
			</div>

			{/* Tabla de envios */}
			<div className="rounded-lg border border-border overflow-hidden bg-card">
				<Table>
					<TableHeader>
						<TableRow className="border-border hover:bg-transparent">
							<TableHead className="w-36 text-muted-foreground">Fecha y Hora</TableHead>
							<TableHead className="text-muted-foreground">Formulario</TableHead>
							<TableHead className="text-muted-foreground">Lead / Contacto</TableHead>
							<TableHead className="text-muted-foreground hidden md:table-cell">Asunto / Mensaje</TableHead>
							<TableHead className="text-muted-foreground hidden lg:table-cell">Negociación</TableHead>
							<TableHead className="w-20 text-right text-muted-foreground">Acción</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{loading ? (
							<TableRow className="border-border">
								<TableCell colSpan={6} className="text-center py-12">
									<div className="flex flex-col items-center gap-2">
										<Loader2 className="h-6 w-6 animate-spin text-primary" />
										<p className="text-sm text-muted-foreground">Cargando registros de envíos...</p>
									</div>
								</TableCell>
							</TableRow>
						) : filtered.length === 0 ? (
							<TableRow className="border-border">
								<TableCell colSpan={6} className="text-center py-12">
									<div className="flex flex-col items-center gap-2">
										<Inbox className="h-8 w-8 text-muted-foreground" />
										<p className="text-sm font-medium text-foreground">No se encontraron envíos</p>
										<p className="text-xs text-muted-foreground">
											Los formularios completados por los usuarios aparecerán registrados aquí automáticamente.
										</p>
									</div>
								</TableCell>
							</TableRow>
						) : (
							filtered.map((item) => {
								const dt = formatDateTime(item.createdAt)
								return (
									<TableRow
										key={item.id}
										className="border-border hover:bg-muted/50 cursor-pointer"
										onClick={() => setDetailRow(item)}
									>
										{/* Fecha y Hora */}
										<TableCell className="whitespace-nowrap">
											<div className="flex flex-col text-xs leading-tight">
												<span className="font-medium text-foreground">{dt.date}</span>
												<span className="text-[11px] text-muted-foreground">{dt.time} hrs</span>
											</div>
										</TableCell>

										{/* Titulo del formulario */}
										<TableCell>
											<span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
												{item.formTitle}
											</span>
										</TableCell>

										{/* Contacto / Lead */}
										<TableCell>
											<div className="flex flex-col text-xs">
												<span className="font-medium text-foreground">{item.contactName}</span>
												{item.contactPhone && (
													<span className="text-muted-foreground font-mono text-[11px]">{item.contactPhone}</span>
												)}
												{item.contactEmail && (
													<span className="text-muted-foreground text-[11px]">{item.contactEmail}</span>
												)}
											</div>
										</TableCell>

										{/* Asunto y extracto */}
										<TableCell className="hidden md:table-cell max-w-xs truncate">
											<div className="flex flex-col text-xs truncate">
												{item.subject && (
													<span className="font-medium text-foreground truncate">{item.subject}</span>
												)}
												<span className="text-muted-foreground text-[11px] truncate">
													{item.message || "Sin mensaje adicional"}
												</span>
											</div>
										</TableCell>

										{/* Trato o Negociacion vinculada */}
										<TableCell className="hidden lg:table-cell">
											{item.dealTitle ? (
												<span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground font-medium">
													{item.dealTitle}
												</span>
											) : (
												<span className="text-xs text-muted-foreground">-</span>
											)}
										</TableCell>

										{/* Acciones */}
										<TableCell className="text-right">
											<Button
												variant="ghost"
												size="icon-sm"
												onClick={(e) => {
													e.stopPropagation()
													setDetailRow(item)
												}}
												title="Ver respuestas completas"
											>
												<Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
											</Button>
										</TableCell>
									</TableRow>
								)
							})
						)}
					</TableBody>
				</Table>
			</div>

			{/* Modal con detalle completo de respuestas y datos tecnicos */}
			<Dialog open={!!detailRow} onOpenChange={(open) => !open && setDetailRow(null)}>
				<DialogContent className="max-w-lg">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Globe className="h-5 w-5 text-primary" />
							Detalle de Envío Web
						</DialogTitle>
						<DialogDescription>
							Registro completo de los datos enviados a través del formulario.
						</DialogDescription>
					</DialogHeader>

					{detailRow && (
						<div className="space-y-4 text-sm mt-2">
							{/* Encabezado del envio */}
							<div className="rounded-lg bg-muted/50 p-3 border border-border space-y-2">
								<div className="flex justify-between items-center text-xs">
									<span className="text-muted-foreground">Formulario:</span>
									<span className="font-semibold text-primary">{detailRow.formTitle}</span>
								</div>
								<div className="flex justify-between items-center text-xs">
									<span className="text-muted-foreground">Fecha y Hora:</span>
									<span className="font-mono text-foreground">
										{formatDateTime(detailRow.createdAt).date} {formatDateTime(detailRow.createdAt).time} hrs
									</span>
								</div>
								{detailRow.ipAddress && (
									<div className="flex justify-between items-center text-xs">
										<span className="text-muted-foreground">Dirección IP:</span>
										<span className="font-mono text-muted-foreground">{detailRow.ipAddress}</span>
									</div>
								)}
							</div>

							{/* Datos del Contacto */}
							<div className="space-y-1.5">
								<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
									Datos de Contacto
								</h4>
								<div className="grid grid-cols-2 gap-2 text-xs">
									<div className="flex items-center gap-1.5 p-2 rounded bg-card border border-border">
										<User className="h-3.5 w-3.5 text-muted-foreground" />
										<span className="truncate">{detailRow.contactName}</span>
									</div>
									<div className="flex items-center gap-1.5 p-2 rounded bg-card border border-border">
										<Phone className="h-3.5 w-3.5 text-muted-foreground" />
										<span className="font-mono truncate">{detailRow.contactPhone || "-"}</span>
									</div>
									{detailRow.contactEmail && (
										<div className="flex items-center gap-1.5 p-2 rounded bg-card border border-border col-span-2">
											<Mail className="h-3.5 w-3.5 text-muted-foreground" />
											<span className="truncate">{detailRow.contactEmail}</span>
										</div>
									)}
								</div>
							</div>

							{/* Respuestas enviadas */}
							<div className="space-y-1.5">
								<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
									Respuestas del Formulario
								</h4>
								<div className="rounded-lg border border-border divide-y divide-border bg-card">
									{detailRow.subject && (
										<div className="p-2.5">
											<span className="text-[11px] font-medium text-muted-foreground block">Asunto:</span>
											<span className="text-foreground font-medium">{detailRow.subject}</span>
										</div>
									)}
									{detailRow.message && (
										<div className="p-2.5">
											<span className="text-[11px] font-medium text-muted-foreground block">Mensaje:</span>
											<p className="text-foreground whitespace-pre-wrap text-xs mt-0.5">{detailRow.message}</p>
										</div>
									)}

									{/* Otros campos en el payload */}
									{Object.entries(detailRow.fullData || {}).map(([key, val]) => {
										if (["name", "nombre", "phone", "telefono", "email", "correo", "asunto", "subject", "mensaje", "message"].includes(key.toLowerCase())) {
											return null
										}
										const valStr = typeof val === "object" ? JSON.stringify(val) : String(val || "")
										if (!valStr.trim()) return null
										return (
											<div key={key} className="p-2.5">
												<span className="text-[11px] font-medium text-muted-foreground block capitalize">
													{key.replace(/_/g, " ")}:
												</span>
												<span className="text-foreground text-xs">{valStr}</span>
											</div>
										)
									})}
								</div>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	)
}
