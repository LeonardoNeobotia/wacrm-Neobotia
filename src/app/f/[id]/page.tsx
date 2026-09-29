import { createClient as createServiceClient } from "@supabase/supabase-js"
import { WebFormClient } from "./client"

export const metadata = {
  title: "Contact Form",
  robots: {
    index: false,
    follow: false,
  },
}

export default async function PublicWebFormPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  // Usamos service role para que los visitantes externos puedan cargar el formulario sin autenticación
  const supabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: form } = await supabase
    .from("web_forms")
    .select("*")
    .eq("id", params.id)
    .single()

  if (!form || !form.is_active) {
    return (
      <div className="flex h-screen w-full items-center justify-center p-4 text-center font-sans">
        <div className="max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Formulario no disponible</h2>
          <p className="mt-2 text-sm text-gray-500">
            Este formulario ha sido desactivado o no existe.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-transparent font-sans">
      <WebFormClient form={form} />
    </div>
  )
}
