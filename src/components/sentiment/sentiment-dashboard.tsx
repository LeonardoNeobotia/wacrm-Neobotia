"use client";

import React, { useState, useMemo, Fragment } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
	PieChart,
	Pie,
	Cell,
	ResponsiveContainer,
	Tooltip,
	Legend,
} from "recharts";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
	Smile,
	Frown,
	Meh,
	Search,
	ExternalLink,
	Sparkles,
	TrendingUp,
	AlertTriangle,
	Tag,
	X,
	CheckCircle2,
	ArrowUpRight,
	HeartHandshake,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SentimentStats {
	positive: number;
	neutral: number;
	negative: number;
}

interface WordCount {
	text: string;
	value: number;
}

interface ClientMessage {
	id: string;
	text: string;
	sentiment: string;
	created_at: string;
	sender_type: string;
}

interface ClientData {
	contact: {
		id: string;
		name: string;
		phone: string;
	};
	conversation_id: string;
	stats: SentimentStats;
	recent_messages: ClientMessage[];
}

interface SentimentDashboardProps {
	stats: SentimentStats;
	wordCloud: WordCount[];
	clients: ClientData[];
}

const SENTIMENT_COLORS = {
	positive: "#10b981", // Emerald 500
	neutral: "#94a3b8", // Slate 400
	negative: "#f43f5e", // Rose 500
};

// Generador de color de avatar consistente a partir del identificador
function getAvatarColor(identifier: string) {
	const colors = [
		"#0284c7",
		"#0d9488",
		"#16a34a",
		"#d97706",
		"#9333ea",
		"#e11d48",
		"#4f46e5",
	];
	let hash = 0;
	for (let i = 0; i < identifier.length; i++) {
		hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
	}
	return colors[Math.abs(hash) % colors.length];
}

export default function SentimentDashboard({
	stats,
	wordCloud,
	clients,
}: SentimentDashboardProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState<"all" | "negative" | "positive" | "neutral">("all");
	const [selectedWord, setSelectedWord] = useState<string | null>(null);

	const totalMessages = stats.positive + stats.neutral + stats.negative;

	// Cálculo del índice de satisfacción del cliente (CSAT / Sentimiento Neto)
	const csatScore = totalMessages > 0
		? Math.round((stats.positive / totalMessages) * 100)
		: 0;

	const positivePct = totalMessages > 0
		? Math.round((stats.positive / totalMessages) * 100)
		: 0;
	const neutralPct = totalMessages > 0
		? Math.round((stats.neutral / totalMessages) * 100)
		: 0;
	const negativePct = totalMessages > 0
		? Math.round((stats.negative / totalMessages) * 100)
		: 0;

	// Datos para el gráfico de dona
	const pieData = [
		{ name: "Positivos", value: stats.positive, color: SENTIMENT_COLORS.positive },
		{ name: "Neutros", value: stats.neutral, color: SENTIMENT_COLORS.neutral },
		{ name: "Negativos", value: stats.negative, color: SENTIMENT_COLORS.negative },
	].filter((d) => d.value > 0);

	// Normalización para visualización de palabras clave
	const maxWordVal = Math.max(...wordCloud.map((w) => w.value), 1);
	const minWordVal = Math.min(...wordCloud.map((w) => w.value), 0);

	// Filtrado reactivo de clientes según búsqueda, filtro de estado y palabra clave
	const filteredClients = useMemo(() => {
		return clients.filter((c) => {
			const nameMatch = (c.contact.name || "").toLowerCase().includes(searchQuery.toLowerCase());
			const phoneMatch = (c.contact.phone || "").toLowerCase().includes(searchQuery.toLowerCase());
			const matchesSearch = !searchQuery.trim() || nameMatch || phoneMatch;

			if (!matchesSearch) return false;

			// Filtro por palabra clave seleccionada
			if (selectedWord) {
				const hasWord = c.recent_messages.some((m) =>
					(m.text || "").toLowerCase().includes(selectedWord.toLowerCase())
				);
				if (!hasWord) return false;
			}

			// Filtro por sentimiento predominante o en riesgo
			if (statusFilter === "negative") {
				return c.stats.negative > 0 && c.stats.negative >= c.stats.positive;
			}
			if (statusFilter === "positive") {
				return c.stats.positive >= c.stats.neutral && c.stats.positive >= c.stats.negative;
			}
			if (statusFilter === "neutral") {
				return c.stats.neutral > c.stats.positive && c.stats.neutral > c.stats.negative;
			}

			return true;
		});
	}, [clients, searchQuery, statusFilter, selectedWord]);

	// Conteo de clientes en riesgo (aquellos con negatividad superior a positividad)
	const clientsAtRiskCount = useMemo(() => {
		return clients.filter((c) => c.stats.negative > 0 && c.stats.negative >= c.stats.positive).length;
	}, [clients]);

	return (
		<div className="space-y-6">
			{/* Tarjetas de Métricas Principales (KPIs) */}
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{/* CSAT / Índice de Satisfacción General */}
				<Card className="relative overflow-hidden border border-border/60 bg-gradient-to-br from-card to-card/50 shadow-xs hover:shadow-md transition-all">
					<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-600" />
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Satisfacción Neta (CSAT)
						</CardTitle>
						<div className="rounded-full bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
							<HeartHandshake className="h-4 w-4" />
						</div>
					</CardHeader>
					<CardContent>
						<div className="flex items-baseline gap-2">
							<span className="text-3xl font-extrabold tracking-tight text-foreground">
								{csatScore}%
							</span>
							<Badge
								variant="outline"
								className={cn(
									"text-[10px] font-semibold border-none px-2 py-0.5",
									csatScore >= 70
										? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
										: csatScore >= 40
										? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
										: "bg-rose-500/10 text-rose-600 dark:text-rose-400"
								)}
							>
								{csatScore >= 70 ? "Excelente" : csatScore >= 40 ? "Moderado" : "Bajo"}
							</Badge>
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							{totalMessages} interacciones evaluadas en total
						</p>
					</CardContent>
				</Card>

				{/* Sentimientos Positivos */}
				<Card className="relative overflow-hidden border border-border/60 bg-gradient-to-br from-card to-card/50 shadow-xs hover:shadow-md transition-all">
					<div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500" />
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Clientes Satisfechos
						</CardTitle>
						<div className="rounded-full bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
							<Smile className="h-4 w-4" />
						</div>
					</CardHeader>
					<CardContent>
						<div className="flex items-baseline gap-2">
							<span className="text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
								{stats.positive}
							</span>
							<span className="text-xs font-semibold text-muted-foreground">
								({positivePct}%)
							</span>
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							Mensajes con satisfacción y gratitud
						</p>
					</CardContent>
				</Card>

				{/* Sentimientos Neutros */}
				<Card className="relative overflow-hidden border border-border/60 bg-gradient-to-br from-card to-card/50 shadow-xs hover:shadow-md transition-all">
					<div className="absolute top-0 left-0 right-0 h-1 bg-slate-400" />
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Interacciones Neutras
						</CardTitle>
						<div className="rounded-full bg-slate-500/10 p-2 text-slate-500 dark:text-slate-400">
							<Meh className="h-4 w-4" />
						</div>
					</CardHeader>
					<CardContent>
						<div className="flex items-baseline gap-2">
							<span className="text-3xl font-extrabold tracking-tight text-foreground">
								{stats.neutral}
							</span>
							<span className="text-xs font-semibold text-muted-foreground">
								({neutralPct}%)
							</span>
						</div>
						<p className="mt-1 text-xs text-muted-foreground">
							Consultas operativas e informativas
						</p>
					</CardContent>
				</Card>

				{/* Sentimientos Negativos / En Riesgo */}
				<Card className="relative overflow-hidden border border-border/60 bg-gradient-to-br from-card to-card/50 shadow-xs hover:shadow-md transition-all">
					<div className="absolute top-0 left-0 right-0 h-1 bg-rose-500" />
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Clientes en Riesgo
						</CardTitle>
						<div className="rounded-full bg-rose-500/10 p-2 text-rose-600 dark:text-rose-400">
							<Frown className="h-4 w-4" />
						</div>
					</CardHeader>
					<CardContent>
						<div className="flex items-baseline gap-2">
							<span className="text-3xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400">
								{stats.negative}
							</span>
							<span className="text-xs font-semibold text-muted-foreground">
								({negativePct}%)
							</span>
						</div>
						<div className="mt-1 flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
							<AlertTriangle className="h-3 w-3 shrink-0" />
							<span>{clientsAtRiskCount} clientes requieren atención</span>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Fila Central: Gráfico de Distribución y Palabras Clave */}
			<div className="grid gap-6 lg:grid-cols-12">
				{/* Gráfico Donut de Distribución */}
				<Card className="lg:col-span-5 border border-border/60 shadow-xs">
					<CardHeader className="pb-2">
						<CardTitle className="text-base font-bold text-foreground flex items-center justify-between">
							<span>Distribución de Sentimientos</span>
							<span className="text-xs font-normal text-muted-foreground">
								Proporción global
							</span>
						</CardTitle>
						<CardDescription className="text-xs">
							Porcentaje representativo de estados de ánimo detectados.
						</CardDescription>
					</CardHeader>
					<CardContent className="h-[310px] flex flex-col justify-center">
						{totalMessages > 0 ? (
							<div className="relative h-full w-full">
								<ResponsiveContainer width="100%" height="100%">
									<PieChart>
										<Pie
											data={pieData}
											cx="50%"
											cy="44%"
											innerRadius={68}
											outerRadius={96}
											paddingAngle={4}
											dataKey="value"
											stroke="hsl(var(--card))"
											strokeWidth={3}
										>
											{pieData.map((entry, index) => (
												<Cell key={`cell-${index}`} fill={entry.color} />
											))}
										</Pie>
										<Tooltip
											content={({ active, payload }) => {
												if (active && payload && payload.length) {
													const item = payload[0].payload;
													const pct = totalMessages > 0 ? ((item.value / totalMessages) * 100).toFixed(1) : "0";
													return (
														<div className="rounded-xl border border-border bg-popover/95 backdrop-blur-md px-3.5 py-2.5 text-xs shadow-lg">
															<div className="flex items-center gap-2 font-bold text-popover-foreground">
																<span
																	className="h-2.5 w-2.5 rounded-full shrink-0"
																	style={{ backgroundColor: item.color }}
																/>
																<span>{item.name}</span>
															</div>
															<p className="mt-1 text-muted-foreground">
																<span className="font-bold text-foreground">{item.value}</span> mensajes ({pct}%)
															</p>
														</div>
													);
												}
												return null;
											}}
										/>
										<Legend
											verticalAlign="bottom"
											iconType="circle"
											formatter={(value) => {
												const item = pieData.find((d) => d.name === value);
												const pct = item && totalMessages > 0 ? ` (${Math.round((item.value / totalMessages) * 100)}%)` : "";
												return (
													<span className="text-xs font-medium text-foreground">
														{value} <span className="text-muted-foreground font-normal">{item?.value ?? 0}{pct}</span>
													</span>
												);
											}}
										/>
									</PieChart>
								</ResponsiveContainer>
								{/* Conteo central integrado */}
								<div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center -translate-y-5">
									<span className="text-2xl font-black text-foreground tracking-tight">
										{totalMessages}
									</span>
									<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
										Interacciones
									</span>
								</div>
							</div>
						) : (
							<div className="flex h-full items-center justify-center text-xs text-muted-foreground">
								No hay datos suficientes para generar el gráfico.
							</div>
						)}
					</CardContent>
				</Card>

				{/* Palabras Clave y Temas Recurrentes */}
				<Card className="lg:col-span-7 border border-border/60 shadow-xs flex flex-col">
					<CardHeader className="pb-3 flex flex-row items-start justify-between">
						<div>
							<CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
								<Tag className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
								<span>Términos y Palabras Clave de Clientes</span>
							</CardTitle>
							<CardDescription className="text-xs mt-0.5">
								Temas más mencionados en conversaciones. Haz clic en un término para filtrar clientes.
							</CardDescription>
						</div>
						{selectedWord && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setSelectedWord(null)}
								className="h-7 text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1"
							>
								<X className="h-3 w-3" />
								Limpiar filtro
							</Button>
						)}
					</CardHeader>
					<CardContent className="flex-1 flex flex-col justify-center">
						{wordCloud.length > 0 ? (
							<div className="flex flex-wrap items-center justify-center gap-2.5 p-2 max-h-[250px] overflow-y-auto">
								{wordCloud.map((word) => {
									const isSelected = selectedWord === word.text;
									const weightRatio = (word.value - minWordVal) / (maxWordVal - minWordVal || 1);

									return (
										<button
											key={word.text}
											type="button"
											onClick={() => setSelectedWord(isSelected ? null : word.text)}
											className={cn(
												"inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border",
												isSelected
													? "bg-emerald-600 text-white border-emerald-600 shadow-sm scale-105"
													: weightRatio > 0.6
													? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20"
													: weightRatio > 0.3
													? "bg-muted/70 text-foreground border-border hover:bg-muted"
													: "bg-background text-muted-foreground border-border/60 hover:bg-muted/50"
											)}
											title={`${word.text}: ${word.value} apariciones`}
										>
											<span className="capitalize font-semibold">{word.text}</span>
											<span
												className={cn(
													"text-[10px] px-1.5 py-0.2 rounded-full font-mono",
													isSelected
														? "bg-emerald-800 text-white"
														: "bg-muted text-muted-foreground"
												)}
											>
												{word.value}
											</span>
										</button>
									);
								})}
							</div>
						) : (
							<div className="flex h-full items-center justify-center text-xs text-muted-foreground">
								No hay suficientes palabras clave recopiladas.
							</div>
						)}
					</CardContent>
				</Card>
			</div>

			{/* Caja de Recomendación e Insights de Inteligencia Artificial */}
			<div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-transparent p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
				<div className="flex items-start gap-3">
					<div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400 shrink-0">
						<Sparkles className="h-5 w-5" />
					</div>
					<div>
						<h4 className="text-sm font-bold text-foreground flex items-center gap-2">
							<span>Diagnóstico de Satisfacción del Equipo</span>
							<Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none">
								Inteligencia en Vivo
							</Badge>
						</h4>
						<p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
							{negativePct > 15
								? `Se detectó un ${negativePct}% de mensajes con sentimiento negativo. Se recomienda contactar prioritariamente a los clientes listados en riesgo para evitar bajas de servicio.`
								: `Excelente índice de satisfacción: ${positivePct}% de los mensajes reflejan gratitud y conformidad. Tu equipo y el agente IA están manteniendo interacciones altamente efectivas.`}
						</p>
					</div>
				</div>

				{clientsAtRiskCount > 0 && (
					<Button
						size="sm"
						onClick={() => setStatusFilter("negative")}
						className="shrink-0 text-xs bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-xs gap-1.5 h-8"
					>
						<AlertTriangle className="h-3.5 w-3.5" />
						Ver {clientsAtRiskCount} clientes en riesgo
					</Button>
				)}
			</div>

			{/* Directorio de Historial de Clientes */}
			<Card className="border border-border/60 shadow-xs">
				<CardHeader className="p-4 sm:p-5 border-b border-border/50">
					<div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
						<div>
							<CardTitle className="text-base font-bold text-foreground">
								Historial y Diagnóstico por Cliente
							</CardTitle>
							<CardDescription className="text-xs mt-0.5">
								Revisa las interacciones y estados emocionales de tus contactos.
							</CardDescription>
						</div>

						{/* Filtros rápidos y Barra de Búsqueda */}
						<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
							{/* Selector de filtros de estado */}
							<div className="flex rounded-lg bg-muted/60 p-0.5 border border-border/60 text-xs">
								<button
									type="button"
									onClick={() => setStatusFilter("all")}
									className={cn(
										"px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer",
										statusFilter === "all"
											? "bg-card text-foreground shadow-xs"
											: "text-muted-foreground hover:text-foreground"
									)}
								>
									Todos ({clients.length})
								</button>
								<button
									type="button"
									onClick={() => setStatusFilter("negative")}
									className={cn(
										"px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center gap-1",
										statusFilter === "negative"
											? "bg-rose-600 text-white shadow-xs"
											: "text-muted-foreground hover:text-rose-500"
									)}
								>
									En Riesgo ({clientsAtRiskCount})
								</button>
								<button
									type="button"
									onClick={() => setStatusFilter("positive")}
									className={cn(
										"px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer",
										statusFilter === "positive"
											? "bg-emerald-600 text-white shadow-xs"
											: "text-muted-foreground hover:text-emerald-500"
									)}
								>
									Satisfechos
								</button>
							</div>

							{/* Buscador por Nombre o Teléfono */}
							<div className="relative w-full sm:w-64">
								<Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
								<Input
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder="Buscar por cliente o teléfono..."
									className="h-8 pl-8 text-xs bg-muted/40 border-border"
								/>
								{searchQuery && (
									<button
										type="button"
										onClick={() => setSearchQuery("")}
										className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
									>
										<X className="h-3 w-3" />
									</button>
								)}
							</div>
						</div>
					</div>

					{selectedWord && (
						<div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
							<span>Filtrando por mención de:</span>
							<Badge variant="secondary" className="font-semibold gap-1">
								{selectedWord}
								<X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedWord(null)} />
							</Badge>
						</div>
					)}
				</CardHeader>

				<CardContent className="p-0">
					{filteredClients.length === 0 ? (
						<div className="p-12 text-center text-xs text-muted-foreground">
							No se encontraron clientes que coincidan con los criterios seleccionados.
						</div>
					) : (
						<div className="divide-y divide-border/40">
							{filteredClients.map((c) => {
								const total = c.stats.positive + c.stats.neutral + c.stats.negative;
								const posPct = total > 0 ? (c.stats.positive / total) * 100 : 0;
								const neuPct = total > 0 ? (c.stats.neutral / total) * 100 : 0;
								const negPct = total > 0 ? (c.stats.negative / total) * 100 : 0;

								const isAtRisk = c.stats.negative > 0 && c.stats.negative >= c.stats.positive;
								const isSatisfied = c.stats.positive >= c.stats.neutral && c.stats.positive >= c.stats.negative;

								const avatarColor = getAvatarColor(c.contact.name || c.contact.phone || c.contact.id);
								const initials = (c.contact.name || "C")
									.split(" ")
									.filter(Boolean)
									.slice(0, 2)
									.map((w) => w[0].toUpperCase())
									.join("") || "C";

								return (
									<div key={c.contact.id} className="transition-colors hover:bg-muted/30">
										{/* Fila Principal de Resumen del Cliente */}
										<div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
											{/* Datos del Contacto */}
											<div className="flex items-center gap-3 min-w-[240px]">
												<div
													className="h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-xs"
													style={{ backgroundColor: avatarColor }}
												>
													{initials}
												</div>
												<div className="min-w-0">
													<div className="flex items-center gap-2">
														<h4 className="text-sm font-bold text-foreground truncate">
															{c.contact.name || "Cliente sin nombre"}
														</h4>
														{isAtRisk && (
															<Badge variant="outline" className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-semibold px-1.5 py-0">
																En Riesgo
															</Badge>
														)}
														{isSatisfied && total > 2 && (
															<Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-semibold px-1.5 py-0">
																Satisfecho
															</Badge>
														)}
													</div>
													<p className="text-xs text-muted-foreground truncate">
														{c.contact.phone || "Sin teléfono registrado"}
													</p>
												</div>
											</div>

											{/* Progresión de Sentimientos y Conteo */}
											<div className="flex-1 max-w-md">
												<div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground mb-1.5">
													<span>{total} mensajes analizados</span>
													<div className="flex items-center gap-2 font-mono">
														<span className="text-emerald-600 dark:text-emerald-400 font-semibold">
															{c.stats.positive} pos
														</span>
														<span>·</span>
														<span className="text-slate-500 dark:text-slate-400">
															{c.stats.neutral} neu
														</span>
														<span>·</span>
														<span className="text-rose-600 dark:text-rose-400 font-semibold">
															{c.stats.negative} neg
														</span>
													</div>
												</div>

												{/* Barra Segmentada de Salud de Conversación */}
												<div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted border border-border/40">
													<div
														className="bg-emerald-500 transition-all"
														style={{ width: `${posPct}%` }}
														title={`Positivos: ${c.stats.positive} (${Math.round(posPct)}%)`}
													/>
													<div
														className="bg-slate-400 transition-all"
														style={{ width: `${neuPct}%` }}
														title={`Neutros: ${c.stats.neutral} (${Math.round(neuPct)}%)`}
													/>
													<div
														className="bg-rose-500 transition-all"
														style={{ width: `${negPct}%` }}
														title={`Negativos: ${c.stats.negative} (${Math.round(negPct)}%)`}
													/>
												</div>
											</div>

											{/* Botones de Acción */}
											<div className="flex items-center gap-2 shrink-0 justify-end">
												{/* Enlace directo a la conversación en Bandeja */}
												{c.conversation_id && (
													<Link
														href={`/inbox?c=${c.conversation_id}`}
														title="Abrir conversación en Bandeja"
														className={cn(
															buttonVariants({ variant: "outline", size: "sm" }),
															"h-8 text-xs gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
														)}
													>
														<span>Ver en Bandeja</span>
														<ExternalLink className="h-3 w-3 opacity-70" />
													</Link>
												)}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
