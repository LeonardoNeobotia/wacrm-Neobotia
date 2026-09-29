"use client"

import { useState } from "react"
import { Loader2, CheckCircle2 } from "lucide-react"

export function WebFormClient({ form }: { form: any }) {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

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
      <div className="flex w-full flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in duration-500">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">¡Gracias!</h2>
        <p className="mt-2 text-gray-500">Tu mensaje ha sido recibido.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-xl bg-white p-6 shadow-sm sm:border sm:border-gray-100">
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

      <form onSubmit={handleSubmit} className="space-y-4">
        {fields.name?.enabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombre</label>
            <input
              type="text"
              name="name"
              required={fields.name.required}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {fields.email?.enabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              name="email"
              required={fields.email.required}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {fields.phone?.enabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Teléfono</label>
            <input
              type="tel"
              name="phone"
              required={fields.phone.required}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {fields.company?.enabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Empresa</label>
            <input
              type="text"
              name="company"
              required={fields.company.required}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {fields.custom?.map((cf: any) => (
          <div key={cf.id}>
            <label className="block text-sm font-medium text-gray-700">{cf.label}</label>
            <textarea
              name={cf.id}
              required={cf.required}
              rows={2}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
