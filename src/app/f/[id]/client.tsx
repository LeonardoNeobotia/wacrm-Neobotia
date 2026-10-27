"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { Loader2, CheckCircle2, ChevronDown, Search, ShieldCheck } from "lucide-react"

interface CountryConfig {
	code: string
	name: string
	dial: string // solo digitos
	maxLocalDigits: number
	placeholder: string
	format: (localDigits: string) => string
}

// Listado de paises con formato inteligente, limites de digitos y dial codes
const COUNTRY_CONFIGS: CountryConfig[] = [
	{
		code: "CL",
		name: "Chile",
		dial: "56",
		maxLocalDigits: 9,
		placeholder: "+56 9 1234 5678",
		format: (d: string) => {
			if (d.length <= 1) return d
			if (d.length <= 5) return `${d[0]} ${d.slice(1)}`
			return `${d[0]} ${d.slice(1, 5)} ${d.slice(5, 9)}`
		},
	},
	{
		code: "AR",
		name: "Argentina",
		dial: "54",
		maxLocalDigits: 11,
		placeholder: "+54 9 11 1234 5678",
		format: (d: string) => {
			if (d.startsWith("9")) {
				if (d.length <= 1) return d
				if (d.length <= 3) return `9 ${d.slice(1)}`
				if (d.length <= 7) return `9 ${d.slice(1, 3)} ${d.slice(3)}`
				return `9 ${d.slice(1, 3)} ${d.slice(3, 7)} ${d.slice(7, 11)}`
			}
			if (d.length <= 2) return d
			if (d.length <= 6) return `${d.slice(0, 2)} ${d.slice(2)}`
			return `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6, 10)}`
		},
	},
	{
		code: "CO",
		name: "Colombia",
		dial: "57",
		maxLocalDigits: 10,
		placeholder: "+57 300 123 4567",
		format: (d: string) => {
			if (d.length <= 3) return d
			if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`
			return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 10)}`
		},
	},
	{
		code: "MX",
		name: "México",
		dial: "52",
		maxLocalDigits: 10,
		placeholder: "+52 55 1234 5678",
		format: (d: string) => {
			if (d.length <= 2) return d
			if (d.length <= 6) return `${d.slice(0, 2)} ${d.slice(2)}`
			return `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6, 10)}`
		},
	},
	{
		code: "PE",
		name: "Perú",
		dial: "51",
		maxLocalDigits: 9,
		placeholder: "+51 912 345 678",
		format: (d: string) => {
			if (d.length <= 3) return d
			if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`
			return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)}`
		},
	},
	{
		code: "VE",
		name: "Venezuela",
		dial: "58",
		maxLocalDigits: 10,
		placeholder: "+58 412 123 4567",
		format: (d: string) => {
			if (d.length <= 3) return d
			if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`
			return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 10)}`
		},
	},
	{
		code: "EC",
		name: "Ecuador",
		dial: "593",
		maxLocalDigits: 9,
		placeholder: "+593 99 123 4567",
		format: (d: string) => {
			if (d.length <= 2) return d
			if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`
			return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 9)}`
		},
	},
	{
		code: "BO",
		name: "Bolivia",
		dial: "591",
		maxLocalDigits: 8,
		placeholder: "+591 7123 4567",
		format: (d: string) => (d.length <= 4 ? d : `${d.slice(0, 4)} ${d.slice(4, 8)}`),
	},
	{
		code: "PY",
		name: "Paraguay",
		dial: "595",
		maxLocalDigits: 9,
		placeholder: "+595 981 123 456",
		format: (d: string) => {
			if (d.length <= 3) return d
			if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`
			return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)}`
		},
	},
	{
		code: "UY",
		name: "Uruguay",
		dial: "598",
		maxLocalDigits: 8,
		placeholder: "+598 99 123 456",
		format: (d: string) => {
			if (d.length <= 2) return d
			if (d.length <= 5) return `${d.slice(0, 2)} ${d.slice(2)}`
			return `${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 8)}`
		},
	},
	{
		code: "BR",
		name: "Brasil",
		dial: "55",
		maxLocalDigits: 11,
		placeholder: "+55 11 91234 5678",
		format: (d: string) => {
			if (d.length <= 2) return d
			if (d.length <= 7) return `${d.slice(0, 2)} ${d.slice(2)}`
			return `${d.slice(0, 2)} ${d.slice(2, 7)} ${d.slice(7, 11)}`
		},
	},
	{
		code: "US",
		name: "Estados Unidos",
		dial: "1",
		maxLocalDigits: 10,
		placeholder: "+1 555 123 4567",
		format: (d: string) => {
			if (d.length <= 3) return d
			if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`
			return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 10)}`
		},
	},
	{
		code: "ES",
		name: "España",
		dial: "34",
		maxLocalDigits: 9,
		placeholder: "+34 612 34 56 78",
		format: (d: string) => {
			if (d.length <= 3) return d
			if (d.length <= 5) return `${d.slice(0, 3)} ${d.slice(3)}`
			if (d.length <= 7) return `${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5)}`
			return `${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`
		},
	},
	{
		code: "PA",
		name: "Panamá",
		dial: "507",
		maxLocalDigits: 8,
		placeholder: "+507 6123 4567",
		format: (d: string) => (d.length <= 4 ? d : `${d.slice(0, 4)} ${d.slice(4, 8)}`),
	},
	{
		code: "CR",
		name: "Costa Rica",
		dial: "506",
		maxLocalDigits: 8,
		placeholder: "+506 8123 4567",
		format: (d: string) => (d.length <= 4 ? d : `${d.slice(0, 4)} ${d.slice(4, 8)}`),
	},
	{
		code: "GT",
		name: "Guatemala",
		dial: "502",
		maxLocalDigits: 8,
		placeholder: "+502 5123 4567",
		format: (d: string) => (d.length <= 4 ? d : `${d.slice(0, 4)} ${d.slice(4, 8)}`),
	},
	{
		code: "HN",
		name: "Honduras",
		dial: "504",
		maxLocalDigits: 8,
		placeholder: "+504 9123 4567",
		format: (d: string) => (d.length <= 4 ? d : `${d.slice(0, 4)} ${d.slice(4, 8)}`),
	},
	{
		code: "SV",
		name: "El Salvador",
		dial: "503",
		maxLocalDigits: 8,
		placeholder: "+503 7123 4567",
		format: (d: string) => (d.length <= 4 ? d : `${d.slice(0, 4)} ${d.slice(4, 8)}`),
	},
	{
		code: "NI",
		name: "Nicaragua",
		dial: "505",
		maxLocalDigits: 8,
		placeholder: "+505 8123 4567",
		format: (d: string) => (d.length <= 4 ? d : `${d.slice(0, 4)} ${d.slice(4, 8)}`),
	},
	{
		code: "DO",
		name: "R. Dominicana",
		dial: "1809",
		maxLocalDigits: 7,
		placeholder: "+1809 123 4567",
		format: (d: string) => (d.length <= 3 ? d : `${d.slice(0, 3)} ${d.slice(3, 7)}`),
	},
	{
		code: "CU",
		name: "Cuba",
		dial: "53",
		maxLocalDigits: 8,
		placeholder: "+53 5123 4567",
		format: (d: string) => (d.length <= 4 ? d : `${d.slice(0, 4)} ${d.slice(4, 8)}`),
	},
	{
		code: "GB",
		name: "Reino Unido",
		dial: "44",
		maxLocalDigits: 10,
		placeholder: "+44 7123 456789",
		format: (d: string) => (d.length <= 4 ? d : `${d.slice(0, 4)} ${d.slice(4, 10)}`),
	},
	{
		code: "DE",
		name: "Alemania",
		dial: "49",
		maxLocalDigits: 11,
		placeholder: "+49 151 12345678",
		format: (d: string) => (d.length <= 3 ? d : `${d.slice(0, 3)} ${d.slice(3, 11)}`),
	},
	{
		code: "FR",
		name: "Francia",
		dial: "33",
		maxLocalDigits: 9,
		placeholder: "+33 6 12 34 56 78",
		format: (d: string) => {
			if (d.length <= 1) return d
			if (d.length <= 3) return `${d[0]} ${d.slice(1)}`
			if (d.length <= 5) return `${d[0]} ${d.slice(1, 3)} ${d.slice(3)}`
			if (d.length <= 7) return `${d[0]} ${d.slice(1, 3)} ${d.slice(3, 5)} ${d.slice(5)}`
			return `${d[0]} ${d.slice(1, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`
		},
	},
	{
		code: "IT",
		name: "Italia",
		dial: "39",
		maxLocalDigits: 10,
		placeholder: "+39 312 345 6789",
		format: (d: string) => (d.length <= 3 ? d : `${d.slice(0, 3)} ${d.slice(3, 10)}`),
	},
	{
		code: "CA",
		name: "Canadá",
		dial: "1",
		maxLocalDigits: 10,
		placeholder: "+1 555 123 4567",
		format: (d: string) => {
			if (d.length <= 3) return d
			if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`
			return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 10)}`
		},
	},
	{
		code: "PT",
		name: "Portugal",
		dial: "351",
		maxLocalDigits: 9,
		placeholder: "+351 912 345 678",
		format: (d: string) => {
			if (d.length <= 3) return d
			if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`
			return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)}`
		},
	},
]

// Ordenados por longitud de dial descendente para deteccion correcta
const COUNTRIES_BY_DIAL_LENGTH = [...COUNTRY_CONFIGS].sort(
	(a, b) => b.dial.length - a.dial.length
)

// Componente inteligente de telefono
function PhoneInput({
	id = "form-phone",
	name,
	required,
	themeColor,
}: {
	id?: string
	name: string
	required?: boolean
	themeColor?: string
}) {
	const [selectedCountry, setSelectedCountry] = useState<CountryConfig>(COUNTRY_CONFIGS[0])
	const [inputValue, setInputValue] = useState("")
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState("")
	const dropdownRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	// Cerrar dropdown al hacer click afuera
	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setOpen(false)
				setSearch("")
			}
		}
		document.addEventListener("mousedown", handleClickOutside)
		return () => document.removeEventListener("mousedown", handleClickOutside)
	}, [])

	// Manejo del cambio de texto con formateo inteligente y sin trampas de borrado
	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const raw = e.target.value

		// 1. Si el usuario borro todo, dejar el campo completamente vacio
		if (!raw) {
			setInputValue("")
			return
		}

		// 2. Si el usuario borro todo hasta dejar solo el '+', permitir que se vea y pueda borrarlo en el siguiente retroceso
		if (raw === "+") {
			setInputValue("+")
			return
		}

		// 3. Si el usuario escribio un digito sin el '+', anteponer el '+' automaticamente
		let text = raw.trim()
		if (!text.startsWith("+")) {
			text = "+" + text.replace(/^\+*/, "")
		}

		// 4. Extraer solo los digitos numericos
		const allDigits = text.slice(1).replace(/\D/g, "")
		if (!allDigits) {
			setInputValue("+")
			return
		}

		// 5. Buscar si coincide con algun prefijo de pais configurado (de mayor a menor longitud)
		const matched = COUNTRIES_BY_DIAL_LENGTH.find((c) => allDigits.startsWith(c.dial))

		if (matched) {
			setSelectedCountry(matched)

			// Si el usuario solo ha escrito el prefijo del pais o esta borrando digitos
			if (allDigits.length <= matched.dial.length) {
				const hasTrailingSpace = text.endsWith(" ")
				setInputValue(`+${allDigits}${hasTrailingSpace ? " " : ""}`)
				return
			}

			// Limitar a la cantidad maxima de digitos locales de ese pais
			const localDigits = allDigits.slice(
				matched.dial.length,
				matched.dial.length + matched.maxLocalDigits
			)

			const formattedLocal = matched.format(localDigits)
			setInputValue(`+${matched.dial} ${formattedLocal}`)
		} else {
			// Si todavia no coincide con un dial completo (ej: "+5" o prefijo no listado)
			const trimmed = allDigits.slice(0, 15)
			setInputValue(`+${trimmed}`)
		}
	}

	// Al enfocar, NO forzamos ningun texto para permitir borrar todo libremente
	const handleFocus = () => {
		// Permite que el input permanezca vacio con su placeholder visible
	}

	// Al desenfocar, si solo quedo '+' o espacios, limpiar para mostrar el placeholder
	const handleBlur = () => {
		if (inputValue === "+" || !inputValue.trim()) {
			setInputValue("")
		}
	}

	// Al seleccionar un pais desde la bandera
	const handleSelectCountry = (country: CountryConfig) => {
		setSelectedCountry(country)
		setOpen(false)
		setSearch("")

		// Si habia un valor previo con digitos, reformatear con el nuevo pais
		const allDigits = inputValue.slice(1).replace(/\D/g, "")
		if (allDigits) {
			let localDigits = allDigits
			if (selectedCountry && allDigits.startsWith(selectedCountry.dial)) {
				localDigits = allDigits.slice(selectedCountry.dial.length)
			}
			localDigits = localDigits.slice(0, country.maxLocalDigits)

			if (localDigits) {
				const formatted = country.format(localDigits)
				setInputValue(`+${country.dial} ${formatted}`)
			} else {
				setInputValue(`+${country.dial} `)
			}
		} else {
			// Si estaba vacio, dejar vacio y cambiar el placeholder para no forzar prefijo
			setInputValue("")
		}

		inputRef.current?.focus()
	}

	// Pegar numero completo
	const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
		e.preventDefault()
		const pasted = e.clipboardData.getData("text").trim()
		const digits = pasted.replace(/\D/g, "")
		if (!digits) return

		const matched = COUNTRIES_BY_DIAL_LENGTH.find((c) => digits.startsWith(c.dial))
		if (matched) {
			setSelectedCountry(matched)
			const local = digits.slice(matched.dial.length, matched.dial.length + matched.maxLocalDigits)
			setInputValue(`+${matched.dial} ${matched.format(local)}`)
		} else {
			const local = digits.slice(0, selectedCountry.maxLocalDigits)
			setInputValue(`+${selectedCountry.dial} ${selectedCountry.format(local)}`)
		}
	}

	// Valor normalizado limpio para enviar al backend (E.164: +56912345678)
	const normalizedValue = useMemo(() => {
		const digits = inputValue.replace(/[^\d+]/g, "")
		return digits.length > 2 ? (digits.startsWith("+") ? digits : `+${digits}`) : ""
	}, [inputValue])

	const filteredCountries = COUNTRY_CONFIGS.filter(
		(c) =>
			c.name.toLowerCase().includes(search.toLowerCase()) ||
			c.dial.includes(search) ||
			c.code.toLowerCase().includes(search.toLowerCase())
	)

	return (
		<div>
			{/* Valor normalizado para enviar en el formulario */}
			<input type="hidden" name={name} value={normalizedValue} />

			<div className="relative flex rounded-xl shadow-2xs">
				{/* Selector de pais con SOLO la bandera (sin prefijo al lado) */}
				<div className="relative shrink-0" ref={dropdownRef}>
					<button
						type="button"
						onClick={() => {
							setOpen((o) => !o)
							setSearch("")
						}}
						aria-label={`Seleccionar país. Actual: ${selectedCountry.name}`}
						className="flex h-full items-center gap-1.5 rounded-l-xl border border-r-0 border-slate-200 bg-slate-50/90 hover:bg-slate-100 transition-colors px-3 py-2.5 text-sm focus:outline-none focus:bg-slate-100 cursor-pointer"
					>
						<img
							src={`https://flagcdn.com/20x15/${selectedCountry.code.toLowerCase()}.png`}
							alt={selectedCountry.name}
							width={20}
							height={15}
							className="rounded-xs object-cover shadow-2xs shrink-0"
							onError={(e) => {
								;(e.target as HTMLImageElement).style.display = "none"
							}}
						/>
						<ChevronDown
							className={`h-3.5 w-3.5 text-slate-400 transition-transform ${
								open ? "rotate-180" : ""
							}`}
						/>
					</button>

					{open && (
						<div className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
							{/* Buscador de paises */}
							<div className="relative mb-1">
								<Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
								<input
									type="text"
									autoFocus
									placeholder="Buscar país o prefijo..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									className="w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none"
								/>
							</div>

							<div className="max-h-60 overflow-y-auto space-y-0.5">
								{filteredCountries.length === 0 ? (
									<p className="p-3 text-center text-xs text-slate-400">Sin resultados</p>
								) : (
									filteredCountries.map((c) => {
										const isSelected = c.code === selectedCountry.code
										return (
											<button
												key={c.code}
												type="button"
												onClick={() => handleSelectCountry(c)}
												className={`flex w-full items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
													isSelected
														? "bg-emerald-50 text-emerald-800 font-semibold"
														: "text-slate-700 hover:bg-slate-50"
												}`}
											>
												<img
													src={`https://flagcdn.com/20x15/${c.code.toLowerCase()}.png`}
													alt={c.name}
													width={20}
													height={15}
													className="rounded-xs object-cover shrink-0 shadow-2xs"
												/>
												<span className="flex-1 text-left truncate">{c.name}</span>
												<span className="text-[11px] font-mono text-slate-400 shrink-0">
													+{c.dial}
												</span>
											</button>
										)
									})
								)}
							</div>
						</div>
					)}
				</div>

				{/* Campo de texto de telefono inteligente */}
				<input
					ref={inputRef}
					id={id}
					type="tel"
					value={inputValue}
					onChange={handleInputChange}
					onFocus={handleFocus}
					onBlur={handleBlur}
					onPaste={handlePaste}
					required={required}
					maxLength={25}
					autoComplete="tel"
					placeholder={selectedCountry.placeholder}
					className="block flex-1 rounded-r-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs transition-all focus:bg-white focus:outline-none focus:ring-2 focus:border-transparent placeholder:text-slate-400 font-mono tracking-wide"
					style={{
						// @ts-ignore
						"--tw-ring-color": themeColor ? `${themeColor}33` : "rgba(16, 185, 129, 0.2)",
					}}
				/>
			</div>
			<p className="mt-1.5 text-[11px] text-slate-400">
				Formato sugerido para {selectedCountry.name}: <span className="font-mono">{selectedCountry.placeholder}</span>
			</p>
		</div>
	)
}

export function WebFormClient({ form }: { form: any }) {
	const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
	const [errorMsg, setErrorMsg] = useState("")
	const containerRef = useRef<HTMLDivElement>(null)

	// Reporta la altura del formulario al padre (embed iframe) para auto-resize responsivo
	useEffect(() => {
		function reportHeight() {
			if (window.parent === window) return
			const height = containerRef.current?.scrollHeight ?? document.body.scrollHeight
			window.parent.postMessage({ type: "nw-form-resize", formId: form.id, height }, "*")
		}

		reportHeight()
		const observer = new ResizeObserver(reportHeight)
		if (containerRef.current) observer.observe(containerRef.current)
		return () => observer.disconnect()
	}, [form.id, status])

	const fields = form.fields_config
	const themeColor = form.theme_color || "#3b82f6"

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault()
		setStatus("submitting")
		setErrorMsg("")

		const formEl = e.currentTarget
		const formData = new FormData(formEl)
		const payload = Object.fromEntries(formData.entries())

		try {
			const res = await fetch(`/api/forms/${form.id}/submit`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			})

			if (!res.ok) {
				const data = await res.json()
				throw new Error(data.error || "Error al enviar el formulario")
			}

			setStatus("success")
		} catch (err: any) {
			setStatus("error")
			setErrorMsg(err.message || "Error al enviar el formulario")
		}
	}

	if (status === "success") {
		return (
			<div
				ref={containerRef}
				className="mx-auto w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-slate-200/50 border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-400"
			>
				<div
					className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
					style={{ backgroundColor: `${themeColor}15` }}
				>
					<CheckCircle2 className="h-9 w-9" style={{ color: themeColor }} />
				</div>
				<h2 className="text-2xl font-bold text-slate-900">¡Mensaje Enviado!</h2>
				<p className="mt-2.5 text-sm text-slate-600 leading-relaxed">
					Muchas gracias por escribirnos. Nuestro equipo se pondrá en contacto contigo a la brevedad.
				</p>
				<button
					type="button"
					onClick={() => setStatus("idle")}
					className="mt-6 inline-flex items-center justify-center rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
				>
					Enviar otra respuesta
				</button>
			</div>
		)
	}

	return (
		<div className="flex min-h-screen w-full items-center justify-center p-4 sm:p-6">
			<div
				ref={containerRef}
				className="relative w-full max-w-lg rounded-2xl bg-white p-7 sm:p-9 shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden"
			>
				{/* Acento superior con el color del tema */}
				<div
					className="absolute top-0 left-0 right-0 h-1.5"
					style={{ backgroundColor: themeColor }}
				/>

				{/* Cabecera del formulario */}
				<div className="mb-7 text-center">
					<h1
						className="text-2xl sm:text-3xl font-extrabold tracking-tight"
						style={{ color: themeColor }}
					>
						{form.title}
					</h1>
					{form.description && (
						<p className="mt-2.5 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
							{form.description}
						</p>
					)}
				</div>

				{status === "error" && (
					<div className="mb-6 rounded-xl bg-rose-50 p-3.5 text-xs text-rose-700 border border-rose-200/60">
						{errorMsg}
					</div>
				)}

				<form onSubmit={handleSubmit} className="space-y-4.5" noValidate={false}>
					{/* Campo trampa Honeypot anti-spam (invisible para humanos, trampa para bots) */}
					<div
						className="absolute -left-[9999px] top-0 opacity-0 pointer-events-none h-0 w-0 overflow-hidden"
						aria-hidden="true"
						tabIndex={-1}
					>
						<input
							type="text"
							name="website_url_hp"
							tabIndex={-1}
							autoComplete="off"
						/>
					</div>

					{fields.name?.enabled && (
						<div>
							<label
								htmlFor="form-name"
								className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
							>
								Nombre Completo{" "}
								{fields.name.required && <span className="text-rose-500">*</span>}
							</label>
							<input
								id="form-name"
								type="text"
								name="name"
								required={fields.name.required}
								minLength={2}
								maxLength={80}
								autoComplete="name"
								placeholder="Tu nombre completo"
								className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs transition-all focus:bg-white focus:outline-none focus:ring-2 placeholder:text-slate-400"
								style={{
									// @ts-ignore
									"--tw-ring-color": `${themeColor}33`,
								}}
							/>
						</div>
					)}

					{fields.email?.enabled && (
						<div>
							<label
								htmlFor="form-email"
								className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
							>
								Correo Electrónico{" "}
								{fields.email.required && <span className="text-rose-500">*</span>}
							</label>
							<input
								id="form-email"
								type="email"
								name="email"
								required={fields.email.required}
								maxLength={120}
								autoComplete="email"
								placeholder="correo@ejemplo.com"
								pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
								title="Ingresa un correo electrónico válido (ej: nombre@dominio.com)"
								className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs transition-all focus:bg-white focus:outline-none focus:ring-2 placeholder:text-slate-400"
								style={{
									// @ts-ignore
									"--tw-ring-color": `${themeColor}33`,
								}}
							/>
						</div>
					)}

					{fields.phone?.enabled && (
						<div>
							<label
								htmlFor="form-phone"
								className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
							>
								Teléfono{" "}
								{fields.phone.required && <span className="text-rose-500">*</span>}
							</label>
							<PhoneInput
								id="form-phone"
								name="phone"
								required={fields.phone.required}
								themeColor={themeColor}
							/>
						</div>
					)}

					{fields.company?.enabled && (
						<div>
							<label
								htmlFor="form-company"
								className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
							>
								Empresa{" "}
								{fields.company.required && <span className="text-rose-500">*</span>}
							</label>
							<input
								id="form-company"
								type="text"
								name="company"
								required={fields.company.required}
								maxLength={100}
								autoComplete="organization"
								placeholder="Nombre de tu empresa u organización"
								className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs transition-all focus:bg-white focus:outline-none focus:ring-2 placeholder:text-slate-400"
								style={{
									// @ts-ignore
									"--tw-ring-color": `${themeColor}33`,
								}}
							/>
						</div>
					)}

					{fields.custom?.map((cf: any) => (
						<div key={cf.id}>
							<label
								htmlFor={`form-custom-${cf.id}`}
								className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
							>
								{cf.label} {cf.required && <span className="text-rose-500">*</span>}
							</label>
							<textarea
								id={`form-custom-${cf.id}`}
								name={cf.id}
								required={cf.required}
								maxLength={1500}
								rows={2}
								placeholder="Escribe tu respuesta aquí..."
								className="w-full rounded-xl border border-slate-200 bg-slate-50/40 px-3.5 py-2.5 text-sm text-slate-900 shadow-2xs transition-all focus:bg-white focus:outline-none focus:ring-2 placeholder:text-slate-400 resize-none"
								style={{
									// @ts-ignore
									"--tw-ring-color": `${themeColor}33`,
								}}
							/>
						</div>
					))}

					<button
						type="submit"
						disabled={status === "submitting"}
						className="mt-6 flex w-full items-center justify-center rounded-xl py-3 px-5 text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all active:scale-[0.99] disabled:opacity-50 cursor-pointer"
						style={{ backgroundColor: themeColor }}
					>
						{status === "submitting" ? (
							<Loader2 className="h-5 w-5 animate-spin" />
						) : (
							"Enviar Mensaje"
						)}
					</button>

					{/* Pie de seguridad sutil */}
					<div className="pt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400 font-medium">
						<ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
						<span>Formulario protegido contra spam y cifrado</span>
					</div>
				</form>
			</div>
		</div>
	)
}
