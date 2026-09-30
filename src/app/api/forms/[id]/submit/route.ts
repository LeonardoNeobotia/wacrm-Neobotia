import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const p = await params
    const id = p.id
    const body = await req.json()

    // Service role para escribir sin autenticacion del visitante
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 1. Obtener configuracion del formulario
    const { data: form, error: formError } = await supabase
      .from("web_forms")
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .single()

    if (formError || !form) {
      console.error("[forms/submit] Formulario no encontrado:", formError)
      return NextResponse.json(
        { error: "Formulario no encontrado o inactivo" },
        { status: 404, headers: corsHeaders }
      )
    }

    const { account_id, pipeline_id, stage_id } = form
    const { name, email, phone, company } = body

    // 2. Buscar contacto existente por email o telefono
    let contactId: string | null = null

    if (email) {
      const { data: existEmail } = await supabase
        .from("contacts")
        .select("id, name")
        .eq("account_id", account_id)
        .eq("email", email)
        .limit(1)
      if (existEmail && existEmail.length > 0) {
        contactId = existEmail[0].id
      }
    }

    if (!contactId && phone) {
      const normalizedPhone = phone.replace(/\D/g, "")
      const { data: existPhone } = await supabase
        .from("contacts")
        .select("id, name")
        .eq("account_id", account_id)
        .eq("phone_normalized", normalizedPhone)
        .limit(1)
      if (existPhone && existPhone.length > 0) {
        contactId = existPhone[0].id
      }
    }

    // 3. Obtener el owner de la cuenta (contacts.user_id es NOT NULL)
    const { data: account, error: accountError } = await supabase
      .from("accounts")
      .select("owner_user_id")
      .eq("id", account_id)
      .single()

    if (accountError || !account?.owner_user_id) {
      console.error("[forms/submit] No se encontro owner_user_id:", accountError)
      return NextResponse.json(
        { error: "No pudimos procesar tu solicitud. Por favor intenta nuevamente." },
        { status: 500, headers: corsHeaders }
      )
    }

    const ownerUserId = account.owner_user_id

    // 4. Crear o actualizar contacto
    if (contactId) {
      // Contacto ya existe: actualizamos solo los campos presentes
      const updateData: Record<string, string> = {}
      if (name) updateData.name = name
      if (email) updateData.email = email
      if (phone) updateData.phone = phone
      if (company) updateData.company = company

      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from("contacts")
          .update(updateData)
          .eq("id", contactId)
        if (updateError) {
          console.error("[forms/submit] Error al actualizar contacto:", updateError)
        }
      }
    } else {
      // Crear nuevo contacto
      // phone es NOT NULL en la tabla — usamos marcador si no vino en el formulario
      const phoneValue = phone?.trim() || `nw_form_${Date.now()}`

      const { data: newContact, error: insertError } = await supabase
        .from("contacts")
        .insert({
          account_id,
          user_id: ownerUserId,
          name: name?.trim() || "Web Lead",
          email: email?.trim() || null,
          phone: phoneValue,
          company: company?.trim() || null,
        })
        .select("id")
        .single()

      if (insertError) {
        console.error("[forms/submit] Error al insertar contacto:", JSON.stringify(insertError))
        return NextResponse.json(
          { error: "No pudimos guardar tu información. Por favor intenta nuevamente." },
          { status: 500, headers: corsHeaders }
        )
      }

      contactId = newContact.id
    }

    // 4. Formatear campos personalizados como texto de nota
    let customNotes = ""
    if (form.fields_config?.custom?.length > 0) {
      customNotes = form.fields_config.custom
        .map((cf: { id: string; label: string }) =>
          `${cf.label}: ${(body[cf.id] as string)?.trim() || "No proporcionado"}`
        )
        .join("\n\n")
    }

    // 5. Crear negociacion (Deal) si hay pipeline configurado
    if (pipeline_id && stage_id && contactId) {
      const dealTitle = `Web Lead - ${company || name || email || phone || "Sin nombre"}`

      const { error: dealError } = await supabase.from("deals").insert({
        account_id,
        user_id: ownerUserId,
        pipeline_id,
        stage_id,
        contact_id: contactId,
        title: dealTitle,
        value: 0,
        currency: "USD",
        status: "open",
        notes: customNotes || null,
      })

      if (dealError) {
        // No es error critico: el contacto ya fue creado, solo registramos
        console.error("[forms/submit] Error al crear deal:", JSON.stringify(dealError))
      }
    } else if (customNotes && contactId) {
      // Sin pipeline: guardamos las respuestas como nota del contacto
      const { error: noteError } = await supabase.from("contact_notes").insert({
        contact_id: contactId,
        user_id: ownerUserId,
        note_text: customNotes,
      })
      if (noteError) {
        console.error("[forms/submit] Error al insertar nota:", JSON.stringify(noteError))
      }
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders })

  } catch (error: any) {
    console.error("[forms/submit] Error inesperado:", error)
    return NextResponse.json(
      { error: "Ocurrió un error inesperado. Por favor intenta más tarde." },
      { status: 500, headers: corsHeaders }
    )
  }
}

// Soporte CORS para sitios externos
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  })
}
