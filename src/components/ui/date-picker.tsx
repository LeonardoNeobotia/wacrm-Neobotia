"use client";

import * as React from "react";
import {
	format,
	addMonths,
	subMonths,
	startOfMonth,
	endOfMonth,
	startOfWeek,
	endOfWeek,
	eachDayOfInterval,
	isSameMonth,
	isSameDay,
	isToday,
	isValid,
	addDays,
} from "date-fns";
import { es } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface DatePickerProps {
	/** Valor en formato YYYY-MM-DD */
	value?: string | null;
	/** Callback cuando cambia la fecha seleccionada */
	onChange: (date: string) => void;
	/** Texto cuando no hay fecha seleccionada */
	placeholder?: string;
	/** Clases CSS adicionales para el disparador */
	className?: string;
	/** Deshabilitar la seleccion */
	disabled?: boolean;
}

/**
 * Parsea una cadena YYYY-MM-DD a un objeto Date local evitando desfases horarios de UTC
 */
function parseLocalDate(dateStr?: string | null): Date | null {
	if (!dateStr) return null;
	const parts = dateStr.split("-");
	if (parts.length !== 3) return null;
	const y = parseInt(parts[0], 10);
	const m = parseInt(parts[1], 10) - 1;
	const d = parseInt(parts[2], 10);
	const date = new Date(y, m, d);
	return isValid(date) ? date : null;
}

export function DatePicker({
	value,
	onChange,
	placeholder = "Seleccionar fecha",
	className,
	disabled = false,
}: DatePickerProps) {
	const [open, setOpen] = React.useState(false);
	const selectedDate = React.useMemo(() => parseLocalDate(value), [value]);

	// Mes visible en el calendario
	const [viewDate, setViewDate] = React.useState<Date>(() => selectedDate || new Date());

	// Sincronizar el mes visible cuando se abre o cambia el valor
	React.useEffect(() => {
		if (selectedDate) {
			setViewDate(selectedDate);
		}
	}, [selectedDate, open]);

	// Dias de la semana abreviados (iniciando lunes)
	const weekDays = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

	// Generacion de dias para el mes actual incluyendo relleno de semana
	const calendarDays = React.useMemo(() => {
		const monthStart = startOfMonth(viewDate);
		const monthEnd = endOfMonth(viewDate);
		const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
		const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
		return eachDayOfInterval({ start: startDate, end: endDate });
	}, [viewDate]);

	const monthLabel = format(viewDate, "MMMM yyyy", { locale: es });
	const capitalizedMonth = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

	const handleSelectDate = (date: Date) => {
		onChange(format(date, "yyyy-MM-dd"));
		setOpen(false);
	};

	const handleQuickPreset = (preset: "today" | "tomorrow" | "next_week" | "clear") => {
		if (preset === "clear") {
			onChange("");
		} else if (preset === "today") {
			onChange(format(new Date(), "yyyy-MM-dd"));
		} else if (preset === "tomorrow") {
			onChange(format(addDays(new Date(), 1), "yyyy-MM-dd"));
		} else if (preset === "next_week") {
			onChange(format(addDays(new Date(), 7), "yyyy-MM-dd"));
		}
		setOpen(false);
	};

	return (
		<div className="relative flex items-center w-full">
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger
					render={
						<button
							type="button"
							disabled={disabled}
							className={cn(
								"w-full h-7 rounded-md border border-input bg-background px-2 text-[11px] flex items-center justify-between text-left font-normal transition-colors hover:bg-muted/50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
								!selectedDate && "text-muted-foreground",
								selectedDate && "pr-6",
								className
							)}
						/>
					}
				>
					<div className="flex items-center gap-1.5 truncate">
						<CalendarIcon className="h-3 w-3 shrink-0 text-muted-foreground" />
						<span className="truncate">
							{selectedDate
								? format(selectedDate, "d 'de' MMMM, yyyy", { locale: es })
								: placeholder}
						</span>
					</div>
				</PopoverTrigger>

				<PopoverContent align="start" className="w-64 p-2.5 bg-popover border border-border rounded-xl shadow-lg z-50">
					{/* Encabezado del mes y controles de navegacion */}
					<div className="flex items-center justify-between mb-2">
						<button
							type="button"
							onClick={() => setViewDate((prev) => subMonths(prev, 1))}
							className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
							title="Mes anterior"
						>
							<ChevronLeft className="h-3.5 w-3.5" />
						</button>
						<span className="text-xs font-semibold text-foreground">
							{capitalizedMonth}
						</span>
						<button
							type="button"
							onClick={() => setViewDate((prev) => addMonths(prev, 1))}
							className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
							title="Mes siguiente"
						>
							<ChevronRight className="h-3.5 w-3.5" />
						</button>
					</div>

					{/* Fila de nombres de dias */}
					<div className="grid grid-cols-7 gap-1 text-center mb-1">
						{weekDays.map((day) => (
							<span key={day} className="text-[10px] font-medium text-muted-foreground py-0.5">
								{day}
							</span>
						))}
					</div>

					{/* Cuadricula de dias */}
					<div className="grid grid-cols-7 gap-1 text-center">
						{calendarDays.map((day) => {
							const isCurrentMonth = isSameMonth(day, viewDate);
							const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
							const isCurrentToday = isToday(day);

							return (
								<button
									key={day.toISOString()}
									type="button"
									onClick={() => handleSelectDate(day)}
									className={cn(
										"h-6 w-full text-[11px] rounded flex items-center justify-center transition-colors cursor-pointer",
										isSelected
											? "bg-primary text-primary-foreground font-semibold"
											: isCurrentToday
												? "border border-primary/50 text-primary font-medium hover:bg-muted"
												: !isCurrentMonth
													? "text-muted-foreground/30 hover:bg-muted/40"
													: "text-foreground hover:bg-muted"
									)}
								>
									{format(day, "d")}
								</button>
							);
						})}
					</div>

					{/* Presets rapidos y boton limpiar */}
					<div className="flex items-center justify-between gap-1 pt-2 mt-2 border-t border-border/60 text-[10px]">
						<div className="flex items-center gap-1">
							<button
								type="button"
								onClick={() => handleQuickPreset("today")}
								className="px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
							>
								Hoy
							</button>
							<button
								type="button"
								onClick={() => handleQuickPreset("tomorrow")}
								className="px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
							>
								Mañana
							</button>
							<button
								type="button"
								onClick={() => handleQuickPreset("next_week")}
								className="px-1.5 py-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
							>
								+7 días
							</button>
						</div>
						{selectedDate && (
							<button
								type="button"
								onClick={() => handleQuickPreset("clear")}
								className="px-1.5 py-0.5 rounded text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer transition-colors"
							>
								Limpiar
							</button>
						)}
					</div>
				</PopoverContent>
			</Popover>

			{/* Boton X para limpiar directamente desde el disparador */}
			{selectedDate && !disabled && (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onChange("");
					}}
					className="absolute right-1.5 p-0.5 rounded-sm hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer z-10"
					title="Quitar fecha"
				>
					<X className="h-3 w-3" />
				</button>
			)}
		</div>
	);
}
