"use client";

import type { Deal, PipelineStage } from "@/types";
import { Calendar, Check, X, FileText } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { useTranslations } from "next-intl";

interface DealCardProps {
	deal: Deal;
	stage: PipelineStage | null;
	onEdit: (deal: Deal) => void;
	isOverlay?: boolean;
	isSelected?: boolean;
	onToggleSelect?: (dealId: string) => void;
	selectionMode?: boolean;
}

function formatDate(dateStr: string) {
	if (!dateStr) return "";
	const parts = dateStr.split("T")[0].split("-");
	if (parts.length === 3) {
		const [year, month, day] = parts.map(Number);
		return new Date(year, month - 1, day).toLocaleDateString("es-CL", {
			day: "numeric",
			month: "short",
			year: "numeric",
		});
	}
	return new Date(dateStr).toLocaleDateString("es-CL", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

function initials(name?: string, fallback?: string) {
	const source = (name || fallback || "?").trim();
	if (!source) return "?";
	return source.charAt(0).toUpperCase();
}

export function DealCard({
	deal,
	stage,
	onEdit,
	isOverlay,
	isSelected,
	onToggleSelect,
	selectionMode,
}: DealCardProps) {
	const t = useTranslations("Pipelines.card");
	const contactLabel = deal.contact?.name || deal.contact?.phone || t("noContact");
	const assigneeLabel = deal.assignee?.full_name || null;

	return (
		<div
			onClick={(e) => {
				if (isOverlay) return;
				e.stopPropagation();
				onEdit(deal);
			}}
			className={`group relative w-full cursor-pointer rounded-xl border pl-4 pr-3 py-3 text-left shadow-sm transition-all ${
				isSelected
					? "border-primary bg-primary/10 shadow-md ring-1 ring-primary"
					: "border-border/50 bg-muted/70 hover:-translate-y-0.5 hover:border-border hover:bg-muted hover:shadow-lg"
			} ${isOverlay ? "shadow-xl" : ""}`}
		>
			{/* 4px left accent bar using stage color */}
			<span
				aria-hidden
				className="absolute left-0 top-0 h-full w-1 rounded-l-xl"
				style={{ backgroundColor: stage?.color ?? "#94a3b8" }}
			/>

			<div className="flex items-start justify-between gap-2">
				{/* Checkbox de seleccion individual */}
				{onToggleSelect && (
					<div
						className={`mr-1 pt-0.5 ${
							selectionMode || isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
						} transition-opacity`}
						onClick={(e) => e.stopPropagation()}
					>
						<input
							type="checkbox"
							checked={!!isSelected}
							onChange={() => onToggleSelect(deal.id)}
							aria-label={`Seleccionar ${deal.title}`}
							className="h-4 w-4 rounded border-border text-primary accent-primary cursor-pointer transition-transform active:scale-95"
						/>
					</div>
				)}

				<h4 className="flex-1 text-sm font-semibold leading-snug text-foreground break-words">
					{deal.title}
				</h4>

				{deal.status === "won" && (
					<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
						<Check className="h-3 w-3" />
						{t("won")}
					</span>
				)}
				{deal.status === "lost" && (
					<span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400">
						<X className="h-3 w-3" />
						{t("lost")}
					</span>
				)}
			</div>

			{/* Contact row */}
			<div className="mt-2 flex items-center gap-2">
				<span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground">
					{initials(deal.contact?.name, deal.contact?.phone)}
				</span>
				<span className="truncate text-xs text-muted-foreground">{contactLabel}</span>
			</div>

			{/* Indicador de notas / campos personalizados si existen */}
			{deal.notes && (
				<div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground/90 bg-background/50 rounded px-1.5 py-0.5 line-clamp-1 border border-border/30" title={deal.notes}>
					<FileText className="h-3 w-3 shrink-0 text-primary/70" />
					<span className="truncate">{deal.notes.split("\n")[0]}</span>
				</div>
			)}

			<div className="mt-2 flex items-center justify-between gap-1">
				<div className="flex items-baseline gap-1">
					<span className="text-sm font-bold text-primary">
						{formatCurrency(deal.value, deal.currency)}
					</span>
					<span className="text-[10px] font-semibold text-muted-foreground uppercase">
						{deal.currency || "CLP"}
					</span>
				</div>
				{deal.expected_close_date && (
					<span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded border border-border/40 shrink-0" title={`Cierre esperado: ${formatDate(deal.expected_close_date)}`}>
						<Calendar className="h-3 w-3 text-primary/70" />
						{formatDate(deal.expected_close_date)}
					</span>
				)}
			</div>

			{assigneeLabel && (
				<div className="mt-2 flex items-center justify-end">
					<span
						title={assigneeLabel}
						className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary"
					>
						{initials(assigneeLabel)}
					</span>
				</div>
			)}
		</div>
	);
}
