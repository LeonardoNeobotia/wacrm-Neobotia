"use client"

import { useState, useEffect, useRef } from "react"
import { Loader2, CheckCircle2, ChevronDown } from "lucide-react"

// Listado de paises con su prefijo internacional
// Ordenados por popularidad para latinoamerica primero
const COUNTRY_CODES = [
  { code: "CL", name: "Chile",         dial: "+56"  },
  { code: "AR", name: "Argentina",     dial: "+54"  },
  { code: "CO", name: "Colombia",      dial: "+57"  },
  { code: "MX", name: "México",        dial: "+52"  },
  { code: "PE", name: "Perú",          dial: "+51"  },
  { code: "VE", name: "Venezuela",     dial: "+58"  },
  { code: "EC", name: "Ecuador",       dial: "+593" },
  { code: "BO", name: "Bolivia",       dial: "+591" },
  { code: "PY", name: "Paraguay",      dial: "+595" },
  { code: "UY", name: "Uruguay",       dial: "+598" },
  { code: "BR", name: "Brasil",        dial: "+55"  },
  { code: "US", name: "Estados Unidos",dial: "+1"   },
  { code: "ES", name: "España",        dial: "+34"  },
  { code: "PA", name: "Panamá",        dial: "+507" },
  { code: "CR", name: "Costa Rica",    dial: "+506" },
  { code: "GT", name: "Guatemala",     dial: "+502" },
  { code: "HN", name: "Honduras",      dial: "+504" },
  { code: "SV", name: "El Salvador",   dial: "+503" },
  { code: "NI", name: "Nicaragua",     dial: "+505" },
  { code: "DO", name: "R. Dominicana", dial: "+1809"},
  { code: "CU", name: "Cuba",          dial: "+53"  },
  { code: "GB", name: "Reino Unido",   dial: "+44"  },
  { code: "DE", name: "Alemania",      dial: "+49"  },
  { code: "FR", name: "Francia",       dial: "+33"  },
  { code: "IT", name: "Italia",        dial: "+39"  },
  { code: "CA", name: "Canadá",        dial: "+1"   },
  { code: "PT", name: "Portugal",      dial: "+351" },
]

const BASE_INPUT_CLASS = "mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"

// Componente de input de telefono con selector de pais
function PhoneInput({ name, required }: { name: string; required?: boolean }) {
  const [selectedCode, setSelectedCode] = useState(COUNTRY_CODES[0]) // Chile por defecto
  const [rawInput, setRawInput] = useState("") // lo que escribe el usuario, puede incluir +
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Cierra el dropdown si el usuario hace click afuera
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

  // Detecta el pais en tiempo real cuando el input empieza con +
  function detectCountry(digits: string) {
    const sorted = [...COUNTRY_CODES].sort(
      (a, b) => b.dial.replace(/\D/g, "").length - a.dial.replace(/\D/g, "").length
    )
    return sorted.find(c => {
      const prefix = c.dial.replace(/\D/g, "")
      return digits.startsWith(prefix)
    }) ?? null
  }

  function handleNumberChange(raw: string) {
    // Permitimos solo +, digitos, espacios y guiones
    const cleaned = raw.replace(/[^\d+\s\-]/g, "")
    setRawInput(cleaned)

    // Auto-deteccion en tiempo real cuando el usuario escribe con + al inicio
    if (cleaned.startsWith("+")) {
      const digits = cleaned.replace(/\D/g, "")
      const match = detectCountry(digits)
      if (match) setSelectedCode(match)
    }
  }

  // Cuando el usuario pega un numero completo
  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").trim()
    setRawInput(pasted)

    if (pasted.startsWith("+") || pasted.startsWith("00")) {
      const digits = pasted.replace(/\D/g, "")
      const match = detectCountry(digits)
      if (match) {
        setSelectedCode(match)
        // Dejamos solo la parte local (sin el prefijo)
        const localPart = digits.slice(match.dial.replace(/\D/g, "").length)
        setRawInput(localPart)
      }
    }
  }

  // Valor final: si el usuario escribio con +, usamos su input completo normalizado
  // Si escribio sin +, anteponemos el codigo del pais seleccionado
  const localDigits = rawInput.replace(/\D/g, "")
  const fullValue = rawInput.startsWith("+")
    ? `+${rawInput.replace(/\D/g, "")}`
    : `${selectedCode.dial}${localDigits}`

  const filteredCountries = COUNTRY_CODES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dial.includes(search)
  )

  return (
    <div>
      {/* Campo oculto con el valor final */}
      <input type="hidden" name={name} value={fullValue} />

      <div className="mt-1 flex">
        {/* Selector de pais */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => { setOpen(o => !o); setSearch("") }}
            className="flex h-full items-center gap-1.5 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 px-2.5 py-2 text-sm hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {/* Imagen de bandera real — renderiza en Windows */}
            <img
              src={`https://flagcdn.com/20x15/${selectedCode.code.toLowerCase()}.png`}
              alt={selectedCode.name}
              width={20}
              height={15}
              className="rounded-sm object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
            />
            <span className="text-xs font-mono text-gray-700">{selectedCode.dial}</span>
            <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

          {open && (
            <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-md border border-gray-200 bg-white shadow-lg">
              {/* Buscador */}
              <div className="border-b border-gray-100 p-2">
                <input
                  type="text"
                  autoFocus
                  placeholder="Buscar país o código..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full rounded border border-gray-200 px-2 py-1 text-sm focus:border-blue-400 focus:outline-none"
                />
              </div>
              <div className="max-h-56 overflow-y-auto">
                {filteredCountries.length === 0 ? (
                  <p className="p-3 text-center text-sm text-gray-400">Sin resultados</p>
                ) : (
                  filteredCountries.map(c => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => { setSelectedCode(c); setOpen(false); setSearch("") }}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 ${c.code === selectedCode.code ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700"}`}
                    >
                      <img
                        src={`https://flagcdn.com/20x15/${c.code.toLowerCase()}.png`}
                        alt={c.name}
                        width={20}
                        height={15}
                        className="rounded-sm object-cover flex-shrink-0"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
                      />
                      <span className="flex-1 text-left">{c.name}</span>
                      <span className="text-xs font-mono text-gray-400">{c.dial}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Numero local: acepta digitos, + y guiones */}
        <input
          type="tel"
          value={rawInput}
          onChange={e => handleNumberChange(e.target.value)}
          onPaste={handlePaste}
          required={required}
          placeholder="Ej: 912345678 o +56912345678"
          title="Escribe el numero local o el numero completo con + (ej: +56912345678). El pais se detecta automaticamente."
          className="block flex-1 rounded-r-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <p className="mt-1 text-xs text-gray-400">
        Selecciona tu país o escribe el número completo con + (ej: +56912345678)
      </p>
    </div>
  )
}

export function WebFormClient({ form }: { form: any }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  // Reporta la altura del formulario al padre (embed iframe) para auto-resize
  useEffect(() => {
    function reportHeight() {
      if (window.parent === window) return // No está en un iframe
      const height = containerRef.current?.scrollHeight ?? document.body.scrollHeight
      window.parent.postMessage(
        { type: "nw-form-resize", formId: form.id, height },
        "*"
      )
    }

    reportHeight()

    // Observa cambios de tamaño (ej: pantalla de éxito vs. formulario)
    const observer = new ResizeObserver(reportHeight)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [form.id, status])

  const fields = form.fields_config

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus("submitting")
    setErrorMsg("")

    const formData = new FormData(e.currentTarget)
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
      setErrorMsg(err.message)
    }
  }

  if (status === "success") {
    return (
      <div ref={containerRef} className="flex w-full flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">¡Gracias!</h2>
        <p className="mt-2 text-gray-500">Tu mensaje ha sido recibido. Pronto nos pondremos en contacto.</p>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-md rounded-xl bg-white p-6 shadow-sm sm:border sm:border-gray-100">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900" style={{ color: form.theme_color }}>
          {form.title}
        </h1>
        {form.description && (
          <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{form.description}</p>
        )}
      </div>

      {status === "error" && (
        <div className="mb-6 rounded-md bg-red-50 p-3 text-sm text-red-600 border border-red-100">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
        {fields.name?.enabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Nombre {fields.name.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              name="name"
              required={fields.name.required}
              minLength={2}
              autoComplete="name"
              placeholder="Tu nombre completo"
              className={BASE_INPUT_CLASS}
            />
          </div>
        )}

        {fields.email?.enabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email {fields.email.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type="email"
              name="email"
              required={fields.email.required}
              autoComplete="email"
              placeholder="correo@ejemplo.com"
              // Patron adicional para forzar el formato en navegadores que no validan type=email
              pattern="[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}"
              title="Ingresa un correo electrónico válido (ej: nombre@dominio.com)"
              className={BASE_INPUT_CLASS}
            />
          </div>
        )}

        {fields.phone?.enabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Teléfono {fields.phone.required && <span className="text-red-500">*</span>}
            </label>
            <PhoneInput
              name="phone"
              required={fields.phone.required}
            />
          </div>
        )}

        {fields.company?.enabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Empresa {fields.company.required && <span className="text-red-500">*</span>}
            </label>
            <input
              type="text"
              name="company"
              required={fields.company.required}
              autoComplete="organization"
              placeholder="Nombre de tu empresa"
              className={BASE_INPUT_CLASS}
            />
          </div>
        )}

        {fields.custom?.map((cf: any) => (
          <div key={cf.id}>
            <label className="block text-sm font-medium text-gray-700">
              {cf.label} {cf.required && <span className="text-red-500">*</span>}
            </label>
            <textarea
              name={cf.id}
              required={cf.required}
              rows={2}
              className={BASE_INPUT_CLASS}
            />
          </div>
        ))}

        <button
          type="submit"
          disabled={status === "submitting"}
          className="mt-6 flex w-full items-center justify-center rounded-md px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 transition-opacity"
          style={{ backgroundColor: form.theme_color }}
        >
          {status === "submitting" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            "Enviar"
          )}
        </button>
      </form>
    </div>
  )
}
