"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";
import {
	X,
	StickyNote,
	CheckSquare,
	Plus,
	Trash2,
	Pin,
	Loader2,
	Calendar,
	User,
	AlertCircle,
	Check,
	Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import type { InternalChat, InternalChatNote, InternalChatTask } from "@/types";

interface InternalChatSidePanelProps {
	chat: InternalChat;
	onClose: () => void;
	onTasksCountChange?: (count: number) => void;
}

const NOTE_COLORS = [
	{ id: "amber", bg: "bg-amber-50 dark:bg-amber-950/30", border: "border-amber-200 dark:border-amber-800/40", text: "text-amber-900 dark:text-amber-100", dot: "bg-amber-400" },
	{ id: "emerald", bg: "bg-emerald-50 dark:bg-emerald-950/30", border: "border-emerald-200 dark:border-emerald-800/40", text: "text-emerald-900 dark:text-emerald-100", dot: "bg-emerald-400" },
	{ id: "blue", bg: "bg-blue-50 dark:bg-blue-950/30", border: "border-blue-200 dark:border-blue-800/40", text: "text-blue-900 dark:text-blue-100", dot: "bg-blue-400" },
	{ id: "rose", bg: "bg-rose-50 dark:bg-rose-950/30", border: "border-rose-200 dark:border-rose-800/40", text: "text-rose-900 dark:text-rose-100", dot: "bg-rose-400" },
	{ id: "slate", bg: "bg-slate-50 dark:bg-slate-900/40", border: "border-slate-200 dark:border-slate-800/50", text: "text-slate-900 dark:text-slate-100", dot: "bg-slate-400" },
];

const PRIORITY_BADGES = {
	low: { label: "Baja", bg: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
	medium: { label: "Media", bg: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
	high: { label: "Alta", bg: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
	urgent: { label: "Urgente", bg: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
};

/**
 * Parsea con seguridad la respuesta de error de la API evitando que fallen errores HTML (como 404/500)
 */
async function parseErrorResponse(res: Response, fallbackMessage: string): Promise<string> {
	try {
		const contentType = res.headers.get("content-type");
		if (contentType && contentType.includes("application/json")) {
			const errData = await res.json();
			return errData.error || fallbackMessage;
		}
		return `${fallbackMessage} (${res.status} ${res.statusText})`;
	} catch {
		return `${fallbackMessage} (${res.status} ${res.statusText})`;
	}
}

export function InternalChatSidePanel({
	chat,
	onClose,
	onTasksCountChange,
}: InternalChatSidePanelProps) {
	const [activeTab, setActiveTab] = useState<"notes" | "tasks">("tasks");

	// Estados de Notas
	const [notes, setNotes] = useState<InternalChatNote[]>([]);
	const [loadingNotes, setLoadingNotes] = useState(true);
	const [newNoteOpen, setNewNoteOpen] = useState(false);
	const [noteTitle, setNoteTitle] = useState("");
	const [noteContent, setNoteContent] = useState("");
	const [noteColor, setNoteColor] = useState("amber");
	const [savingNote, setSavingNote] = useState(false);

	// Estados de Tareas
	const [tasks, setTasks] = useState<InternalChatTask[]>([]);
	const [loadingTasks, setLoadingTasks] = useState(true);
	const [taskFilter, setTaskFilter] = useState<"all" | "pending" | "completed">("all");
	const [newTaskOpen, setNewTaskOpen] = useState(false);
	const [taskTitle, setTaskTitle] = useState("");
	const [taskDesc, setTaskDesc] = useState("");
	const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
	const [taskAssignee, setTaskAssignee] = useState<string>("none");
	const [taskDueDate, setTaskDueDate] = useState("");
	const [savingTask, setSavingTask] = useState(false);

	const [migrationNotice, setMigrationNotice] = useState(false);

	// Notificar conteo de tareas pendientes de forma sincronizada tras el renderizado
	const onTasksCountChangeRef = useRef(onTasksCountChange);
	useEffect(() => {
		onTasksCountChangeRef.current = onTasksCountChange;
	}, [onTasksCountChange]);

	useEffect(() => {
		const pending = tasks.filter((t) => t.status === "pending").length;
		onTasksCountChangeRef.current?.(pending);
	}, [tasks]);

	// Cargar notas con indicador opcional y bypass de caché
	const fetchNotes = useCallback(async (showLoading = false) => {
		try {
			if (showLoading) setLoadingNotes(true);
			const res = await fetch(`/api/internal-chat/${chat.id}/notes?_t=${Date.now()}`, {
				cache: "no-store",
				headers: {
					"Cache-Control": "no-cache, no-store, must-revalidate",
					Pragma: "no-cache",
				},
			});
			if (res.ok) {
				const data = await res.json();
				setNotes(data.notes || []);
				if (data.pendingMigration) setMigrationNotice(true);
			}
		} catch (err) {
			console.error("Error al cargar notas:", err);
		} finally {
			if (showLoading) setLoadingNotes(false);
		}
	}, [chat.id]);

	// Cargar tareas con indicador opcional y bypass de caché
	const fetchTasks = useCallback(async (showLoading = false) => {
		try {
			if (showLoading) setLoadingTasks(true);
			const res = await fetch(`/api/internal-chat/${chat.id}/tasks?_t=${Date.now()}`, {
				cache: "no-store",
				headers: {
					"Cache-Control": "no-cache, no-store, must-revalidate",
					Pragma: "no-cache",
				},
			});
			if (res.ok) {
				const data = await res.json();
				const fetchedTasks: InternalChatTask[] = data.tasks || [];
				setTasks(fetchedTasks);
				if (data.pendingMigration) setMigrationNotice(true);
			}
		} catch (err) {
			console.error("Error al cargar tareas:", err);
		} finally {
			if (showLoading) setLoadingTasks(false);
		}
	}, [chat.id]);

	useEffect(() => {
		fetchNotes(true);
		fetchTasks(true);
	}, [fetchNotes, fetchTasks]);

	// Crear nueva nota
	const handleCreateNote = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!noteContent.trim()) {
			toast.error("El contenido de la nota no puede estar vacío");
			return;
		}

		setSavingNote(true);
		try {
			const res = await fetch(`/api/internal-chat/${chat.id}/notes`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: noteTitle.trim() || null,
					content: noteContent.trim(),
					color: noteColor,
				}),
			});

			if (!res.ok) {
				const errMsg = await parseErrorResponse(res, "Error al crear la nota");
				throw new Error(errMsg);
			}

			toast.success("Nota agregada");
			setNoteTitle("");
			setNoteContent("");
			setNewNoteOpen(false);
			fetchNotes(false);
		} catch (err: any) {
			toast.error(err.message || "Error al crear nota");
		} finally {
			setSavingNote(false);
		}
	};

	// Fijar/Desfijar nota de forma optimista inmediata sin parpadeo de carga
	const handleTogglePinNote = async (note: InternalChatNote) => {
		const newPin = !note.is_pinned;
		// Actualización de estado local inmediata reordenando
		setNotes((prev) => {
			const updated = prev.map((n) => (n.id === note.id ? { ...n, is_pinned: newPin } : n));
			return updated.sort((a, b) => {
				if (a.is_pinned === b.is_pinned) {
					return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
				}
				return a.is_pinned ? -1 : 1;
			});
		});

		try {
			const res = await fetch(`/api/internal-chat/${chat.id}/notes/${note.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ is_pinned: newPin }),
			});
			if (!res.ok) {
				toast.error("No se pudo actualizar la nota");
				fetchNotes(false);
			}
		} catch {
			toast.error("Error de conexión al actualizar nota");
			fetchNotes(false);
		}
	};

	// Eliminar nota
	const handleDeleteNote = async (noteId: string) => {
		try {
			setNotes((prev) => prev.filter((n) => n.id !== noteId));
			await fetch(`/api/internal-chat/${chat.id}/notes/${noteId}`, {
				method: "DELETE",
			});
			toast.success("Nota eliminada");
			fetchNotes(false);
		} catch {
			fetchNotes(false);
		}
	};

	// Crear nueva tarea
	const handleCreateTask = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!taskTitle.trim()) {
			toast.error("El título de la tarea es obligatorio");
			return;
		}

		setSavingTask(true);
		try {
			const res = await fetch(`/api/internal-chat/${chat.id}/tasks`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: taskTitle.trim(),
					description: taskDesc.trim() || null,
					priority: taskPriority,
					assigned_to: taskAssignee === "none" ? null : taskAssignee,
					due_date: taskDueDate || null,
				}),
			});

			if (!res.ok) {
				const errMsg = await parseErrorResponse(res, "Error al crear la tarea");
				throw new Error(errMsg);
			}

			toast.success("Tarea añadida");
			setTaskTitle("");
			setTaskDesc("");
			setTaskDueDate("");
			setNewTaskOpen(false);
			fetchTasks(false);
		} catch (err: any) {
			toast.error(err.message || "Error al crear tarea");
		} finally {
			setSavingTask(false);
		}
	};

	// Alternar estado completado de tarea de forma optimista inmediata sin parpadeo de carga
	const handleToggleTaskStatus = async (task: InternalChatTask) => {
		const newStatus: "pending" | "completed" = task.status === "completed" ? "pending" : "completed";
		setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t)));

		try {
			const res = await fetch(`/api/internal-chat/${chat.id}/tasks/${task.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ status: newStatus }),
			});
			if (!res.ok) {
				toast.error("No se pudo actualizar el estado de la tarea");
				fetchTasks(false);
			}
		} catch {
			toast.error("Error de conexión al actualizar tarea");
			fetchTasks(false);
		}
	};

	// Eliminar tarea
	const handleDeleteTask = async (taskId: string) => {
		try {
			setTasks((prev) => prev.filter((t) => t.id !== taskId));
			await fetch(`/api/internal-chat/${chat.id}/tasks/${taskId}`, {
				method: "DELETE",
			});
			toast.success("Tarea eliminada");
			fetchTasks(false);
		} catch {
			fetchTasks(false);
		}
	};

	const completedCount = tasks.filter((t) => t.status === "completed").length;
	const pendingCount = tasks.filter((t) => t.status === "pending").length;
	const progressPct = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

	const filteredTasks = tasks.filter((t) => {
		if (taskFilter === "pending") return t.status === "pending";
		if (taskFilter === "completed") return t.status === "completed";
		return true;
	});

	return (
		<div className="flex h-full w-80 sm:w-96 flex-col border-l border-border bg-card/95 backdrop-blur-xs shadow-xl animate-in slide-in-from-right-4 duration-200 overflow-hidden">
			{/* Encabezado del Panel */}
			<div className="flex items-center justify-between border-b border-border/60 p-3.5 shrink-0">
				<div>
					<h3 className="text-sm font-bold text-foreground flex items-center gap-2">
						<span>Notas y Tareas</span>
					</h3>
					<p className="text-[11px] text-muted-foreground truncate max-w-[240px]">
						{chat.name || "Chat directo"}
					</p>
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={onClose}
					className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>

			{/* Selector de Pestañas Segmentadas */}
			<div className="p-2 border-b border-border/40 shrink-0">
				<div className="flex rounded-xl bg-muted/60 p-1">
					<button
						type="button"
						onClick={() => setActiveTab("tasks")}
						className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
							activeTab === "tasks"
								? "bg-card text-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						<CheckSquare className="h-3.5 w-3.5 text-blue-600" />
						<span>Tareas</span>
						{pendingCount > 0 && (
							<span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-bold">
								{pendingCount}
							</span>
						)}
					</button>

					<button
						type="button"
						onClick={() => setActiveTab("notes")}
						className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
							activeTab === "notes"
								? "bg-card text-foreground shadow-xs"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						<StickyNote className="h-3.5 w-3.5 text-amber-600" />
						<span>Notas</span>
						{notes.length > 0 && (
							<span className="text-[10px] px-1.5 py-0.2 rounded-full bg-muted text-muted-foreground font-mono">
								{notes.length}
							</span>
						)}
					</button>
				</div>
			</div>

			{/* Aviso si la tabla no está creada aún en Supabase */}
			{migrationNotice && (
				<div className="m-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-xs text-amber-900 dark:text-amber-200">
					<div className="flex items-center gap-1.5 font-bold mb-1">
						<AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
						<span>Activación requerida</span>
					</div>
					<p className="text-[11px] leading-relaxed opacity-90">
						Ejecuta el archivo de migración <code className="font-mono bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">045_internal_chat_notes_tasks.sql</code> en tu Supabase SQL Editor para persistir notas y tareas.
					</p>
				</div>
			)}

			{/* ========================================= */}
			{/* PESTAÑA: TAREAS (TO-DO)                   */}
			{/* ========================================= */}
			{activeTab === "tasks" && (
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
					{/* Barra de Progreso y Filtros */}
					<div className="p-3 border-b border-border/40 space-y-2.5 shrink-0 bg-muted/10">
						{tasks.length > 0 && (
							<div className="space-y-1">
								<div className="flex justify-between text-[11px] font-medium text-muted-foreground">
									<span>Progreso del equipo</span>
									<span className="font-bold text-foreground">
										{completedCount} de {tasks.length} ({progressPct}%)
									</span>
								</div>
								<div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
									<div
										className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
										style={{ width: `${progressPct}%` }}
									/>
								</div>
							</div>
						)}

						<div className="flex items-center justify-between gap-1">
							<div className="flex items-center gap-1">
								{(["all", "pending", "completed"] as const).map((f) => (
									<button
										key={f}
										type="button"
										onClick={() => setTaskFilter(f)}
										className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
											taskFilter === f
												? "bg-foreground text-background font-bold shadow-2xs"
												: "text-muted-foreground hover:bg-muted"
										}`}
									>
										{f === "all" ? "Todas" : f === "pending" ? "Pendientes" : "Listas"}
									</button>
								))}
							</div>

							<Button
								size="sm"
								onClick={() => setNewTaskOpen((o) => !o)}
								className="h-7 text-xs bg-primary text-primary-foreground gap-1 cursor-pointer shadow-xs"
							>
								<Plus className="h-3 w-3" />
								<span>Nueva Tarea</span>
							</Button>
						</div>
					</div>

					{/* Formulario para Crear Tarea */}
					{newTaskOpen && (
						<form
							onSubmit={handleCreateTask}
							className="p-3 border-b border-border/60 bg-muted/20 space-y-2.5 animate-in fade-in duration-150 shrink-0"
						>
							<Input
								autoFocus
								placeholder="Título de la tarea (ej. Enviar propuesta)"
								value={taskTitle}
								onChange={(e) => setTaskTitle(e.target.value)}
								className="h-8 text-xs bg-background"
							/>
							<Input
								placeholder="Detalles adicionales (opcional)"
								value={taskDesc}
								onChange={(e) => setTaskDesc(e.target.value)}
								className="h-8 text-xs bg-background"
							/>
							<div className="grid grid-cols-2 gap-2 text-xs">
								<div>
									<label className="text-[10px] text-muted-foreground block mb-0.5">Prioridad</label>
									<select
										value={taskPriority}
										onChange={(e: any) => setTaskPriority(e.target.value)}
										className="w-full h-7 rounded-md border border-input bg-background px-2 text-[11px]"
									>
										<option value="low">Baja</option>
										<option value="medium">Media</option>
										<option value="high">Alta</option>
										<option value="urgent">Urgente</option>
									</select>
								</div>
								<div>
									<label className="text-[10px] text-muted-foreground block mb-0.5">Fecha límite</label>
									<DatePicker
										value={taskDueDate}
										onChange={setTaskDueDate}
										placeholder="Seleccionar fecha"
									/>
								</div>
							</div>

							{chat.members && chat.members.length > 0 && (
								<div>
									<label className="text-[10px] text-muted-foreground block mb-0.5">Asignar a</label>
									<select
										value={taskAssignee}
										onChange={(e) => setTaskAssignee(e.target.value)}
										className="w-full h-7 rounded-md border border-input bg-background px-2 text-[11px]"
									>
										<option value="none">Sin asignar (equipo)</option>
										{chat.members.map((m) => (
											<option key={m.user_id} value={m.user_id}>
												{m.profile?.full_name || m.profile?.email || "Miembro"}
											</option>
										))}
									</select>
								</div>
							)}

							<div className="flex items-center justify-end gap-1.5 pt-1">
								<Button
									type="button"
									variant="ghost"
									size="sm"
									onClick={() => setNewTaskOpen(false)}
									className="h-7 text-xs"
								>
									Cancelar
								</Button>
								<Button
									type="submit"
									size="sm"
									disabled={savingTask}
									className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
								>
									{savingTask ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
								</Button>
							</div>
						</form>
					)}

					{/* Lista de Tareas */}
					<div className="flex-1 overflow-y-auto p-3 space-y-2">
						{loadingTasks ? (
							<div className="flex h-32 items-center justify-center">
								<Loader2 className="h-5 w-5 animate-spin text-primary" />
							</div>
						) : filteredTasks.length === 0 ? (
							<div className="text-center py-10 text-muted-foreground space-y-2">
								<CheckSquare className="h-8 w-8 mx-auto opacity-30" />
								<p className="text-xs">
									{taskFilter === "all"
										? "No hay tareas anotadas en este chat."
										: taskFilter === "pending"
										? "¡No hay tareas pendientes!"
										: "No hay tareas completadas."}
								</p>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setNewTaskOpen(true)}
									className="h-7 text-xs cursor-pointer gap-1"
								>
									<Plus className="h-3 w-3" /> Añadir tarea
								</Button>
							</div>
						) : (
							filteredTasks.map((task) => {
								const isDone = task.status === "completed";
								const priorityConfig = PRIORITY_BADGES[task.priority] || PRIORITY_BADGES.medium;

								return (
									<div
										key={task.id}
										className={`group flex items-start gap-2.5 p-2.5 rounded-xl border transition-all ${
											isDone
												? "bg-muted/30 border-border/40 opacity-70"
												: "bg-card border-border/70 hover:border-border shadow-2xs"
										}`}
									>
										{/* Checkbox interactivo */}
										<button
											type="button"
											onClick={() => handleToggleTaskStatus(task)}
											className={`mt-0.5 h-4.5 w-4.5 rounded-md border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
												isDone
													? "bg-emerald-600 border-emerald-600 text-white"
													: "border-muted-foreground/40 hover:border-foreground bg-background"
											}`}
										>
											{isDone && <Check className="h-3 w-3 stroke-[3]" />}
										</button>

										{/* Contenido de la tarea */}
										<div className="flex-1 min-w-0">
											<p
												className={`text-xs font-semibold leading-snug break-words ${
													isDone ? "line-through text-muted-foreground" : "text-foreground"
												}`}
											>
												{task.title}
											</p>
											{task.description && (
												<p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
													{task.description}
												</p>
											)}

											<div className="flex flex-wrap items-center gap-1.5 mt-2">
												{/* Badge Prioridad */}
												<span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${priorityConfig.bg}`}>
													{priorityConfig.label}
												</span>

												{/* Asignado */}
												{task.assignee_profile && (
													<span className="text-[10px] text-muted-foreground flex items-center gap-1 bg-muted/60 px-1.5 py-0.2 rounded truncate max-w-[120px]">
														<User className="h-2.5 w-2.5" />
														<span className="truncate">{task.assignee_profile.full_name?.split(" ")[0]}</span>
													</span>
												)}

												{/* Fecha límite */}
												{task.due_date && (
													<span className="text-[10px] text-muted-foreground flex items-center gap-1 bg-muted/60 px-1.5 py-0.2 rounded">
														<Calendar className="h-2.5 w-2.5" />
														<span>{format(new Date(task.due_date), "d MMM", { locale: es })}</span>
													</span>
												)}
											</div>
										</div>

										{/* Eliminar tarea */}
										<button
											type="button"
											onClick={() => handleDeleteTask(task.id)}
											className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-rose-500 cursor-pointer shrink-0"
											title="Eliminar tarea"
										>
											<Trash2 className="h-3.5 w-3.5" />
										</button>
									</div>
								);
							})
						)}
					</div>
				</div>
			)}

			{/* ========================================= */}
			{/* PESTAÑA: NOTAS RÁPIDAS                    */}
			{/* ========================================= */}
			{activeTab === "notes" && (
				<div className="flex-1 flex flex-col min-h-0 overflow-hidden">
					{/* Barra superior de notas */}
					<div className="p-3 border-b border-border/40 flex items-center justify-between shrink-0 bg-muted/10">
						<span className="text-xs font-semibold text-muted-foreground">
							Notas fijadas y acuerdos
						</span>
						<Button
							size="sm"
							onClick={() => setNewNoteOpen((o) => !o)}
							className="h-7 text-xs bg-primary text-primary-foreground gap-1 cursor-pointer shadow-xs"
						>
							<Plus className="h-3 w-3" />
							<span>Nueva Nota</span>
						</Button>
					</div>

					{/* Formulario para Crear Nota */}
					{newNoteOpen && (
						<form
							onSubmit={handleCreateNote}
							className="p-3 border-b border-border/60 bg-muted/20 space-y-2.5 animate-in fade-in duration-150 shrink-0"
						>
							<Input
								autoFocus
								placeholder="Título de la nota (opcional)"
								value={noteTitle}
								onChange={(e) => setNoteTitle(e.target.value)}
								className="h-8 text-xs bg-background"
							/>
							<Textarea
								placeholder="Escribe la nota, detalles del cliente, acuerdos del equipo..."
								value={noteContent}
								onChange={(e) => setNoteContent(e.target.value)}
								rows={3}
								className="text-xs bg-background resize-none leading-relaxed"
							/>

							{/* Selector de color de nota adhesiva */}
							<div className="flex items-center justify-between pt-1">
								<div className="flex items-center gap-1.5">
									{NOTE_COLORS.map((c) => (
										<button
											key={c.id}
											type="button"
											onClick={() => setNoteColor(c.id)}
											className={`h-5 w-5 rounded-full ${c.dot} transition-transform hover:scale-110 cursor-pointer ${
												noteColor === c.id ? "ring-2 ring-foreground" : ""
											}`}
										/>
									))}
								</div>

								<div className="flex items-center gap-1.5">
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onClick={() => setNewNoteOpen(false)}
										className="h-7 text-xs"
									>
										Cancelar
									</Button>
									<Button
										type="submit"
										size="sm"
										disabled={savingNote}
										className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
									>
										{savingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
									</Button>
								</div>
							</div>
						</form>
					)}

					{/* Lista de Notas */}
					<div className="flex-1 overflow-y-auto p-3 space-y-2.5">
						{loadingNotes ? (
							<div className="flex h-32 items-center justify-center">
								<Loader2 className="h-5 w-5 animate-spin text-primary" />
							</div>
						) : notes.length === 0 ? (
							<div className="text-center py-10 text-muted-foreground space-y-2">
								<StickyNote className="h-8 w-8 mx-auto opacity-30" />
								<p className="text-xs">No hay notas en este chat todavía.</p>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setNewNoteOpen(true)}
									className="h-7 text-xs cursor-pointer gap-1"
								>
									<Plus className="h-3 w-3" /> Crear primera nota
								</Button>
							</div>
						) : (
							notes.map((note) => {
								const colorConfig =
									NOTE_COLORS.find((c) => c.id === note.color) || NOTE_COLORS[0];

								return (
									<div
										key={note.id}
										className={`group relative p-3 rounded-2xl border transition-all shadow-xs ${colorConfig.bg} ${colorConfig.border}`}
									>
										{/* Encabezado de la nota */}
										<div className="flex items-start justify-between gap-2 mb-1.5">
											<div className="min-w-0 flex-1">
												{note.title && (
													<h4 className={`text-xs font-bold truncate ${colorConfig.text}`}>
														{note.title}
													</h4>
												)}
												<p className="text-[10px] text-muted-foreground">
													{note.author_profile?.full_name?.split(" ")[0] || "Miembro"} ·{" "}
													{format(new Date(note.created_at), "d MMM HH:mm", { locale: es })}
												</p>
											</div>

											<div className="flex items-center gap-1 shrink-0">
												<button
													type="button"
													onClick={() => handleTogglePinNote(note)}
													className={`p-1 rounded-md transition-colors cursor-pointer ${
														note.is_pinned
															? "text-amber-600 dark:text-amber-400"
															: "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
													}`}
													title={note.is_pinned ? "Desfijar nota" : "Fijar al inicio"}
												>
													<Pin className={`h-3 w-3 ${note.is_pinned ? "fill-current" : ""}`} />
												</button>

												<button
													type="button"
													onClick={() => handleDeleteNote(note.id)}
													className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-rose-500 transition-opacity cursor-pointer"
													title="Eliminar nota"
												>
													<Trash2 className="h-3 w-3" />
												</button>
											</div>
										</div>

										{/* Contenido de la nota */}
										<p className="text-xs leading-relaxed whitespace-pre-wrap break-words text-foreground/90">
											{note.content}
										</p>
									</div>
								);
							})
						)}
					</div>
				</div>
			)}
		</div>
	);
}
