import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { sendWebLeadEmail } from "@/lib/email/resend"
import { checkRateLimit } from "@/lib/rate-limit"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

/**
 * Normaliza un numero telefonico eliminando duplicaciones de codigo de pais
 * (como +56569... generado al concatenar el prefijo dos veces) y dandole formato internacional E.164 (+...).
 */
function sanitizeAndNormalizePhone(rawPhone?: string | null): string {
	if (!rawPhone) return ""
	const cleaned = rawPhone.trim().replace(/[^\d+]/g, "")
	if (!cleaned) return ""

	let digits = cleaned.replace(/\D/g, "")

	// Caso especifico de duplicacion de prefijo Chile (+56569... o 56569...)
	if (digits.startsWith("5656")) {
		digits = digits.slice(2) // Removemos el 56 redundante
	}

	// Caso general: duplicacion de codigo de pais comun
	for (const cc of ["56", "54", "57", "52", "51", "58", "55", "593", "591", "595", "598"]) {
		if (digits.startsWith(cc + cc) && digits.length >= cc.length * 2 + 7) {
			digits = digits.slice(cc.length)
			break
		}
	}

	// Si es un numero celular chileno de 9 digitos sin codigo de pais (ej: 912345678)
	if (digits.length === 9 && digits.startsWith("9")) {
		return `+56${digits}`
	}

	// Si es un numero fijo chileno de 8 digitos
	if (digits.length === 8 && /^[2-8]/.test(digits)) {
		return `+56${digits}`
	}

	return `+${digits}`
}

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const p = await params
		const id = p.id
		const body = await req.json()

		// 0. Verificacion Honeypot anti-spam: Si un bot lleno este campo oculto, respondemos exito falso silencioso
		if (body.website_url_hp || body._hp_website_confirm) {
			console.warn("[forms/submit] Spam bot bloqueado exitosamente via honeypot")
			return NextResponse.json({ success: true }, { headers: corsHeaders })
		}

		// 0.1 Proteccion Rate Limit: Maximo 10 envios por minuto por IP para evitar bombardeo de correos y saturacion de cuota
		const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown"
		const rateLimit = checkRateLimit(`form_submit:${id}:${clientIp}`, { limit: 10, windowMs: 60_000 })
		if (!rateLimit.success) {
			console.warn(`[forms/submit] Rate limit excedido para IP ${clientIp} en formulario ${id}`)
			return NextResponse.json(
				{ error: "Has superado el límite de envíos. Por favor espera un momento antes de volver a intentar." },
				{ status: 429, headers: corsHeaders }
			)
		}

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

		// Mapeo flexible de datos principales para soportar espanol, ingles o formularios externos
		// Limpieza de caracteres nulos y limites de longitud razonables
		const cleanStr = (val: any, maxLen: number) =>
			String(val || "")
				.replace(/\0/g, "")
				.trim()
				.slice(0, maxLen)

		const name = cleanStr(body.name || body.nombre || body.full_name || body.fullName, 100)
		const email = cleanStr(body.email || body.correo || body.mail, 150).toLowerCase()
		const rawPhone = cleanStr(body.phone || body.telefono || body.phone_number || body.celular || body.tel, 40)
		const company = cleanStr(body.company || body.empresa || body.organization, 120)

		// Validacion de formato de email si fue ingresado
		if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
			return NextResponse.json(
				{ error: "El formato de correo electrónico es inválido." },
				{ status: 400, headers: corsHeaders }
			)
		}

		// Normalizacion del telefono evitando prefijos duplicados (+56569... -> +569...)
		const normalizedPhone = sanitizeAndNormalizePhone(rawPhone)
		const digitsOnlyPhone = normalizedPhone.replace(/\D/g, "")

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

		if (!contactId && digitsOnlyPhone) {
			const suffix = digitsOnlyPhone.length >= 8 ? digitsOnlyPhone.slice(-8) : digitsOnlyPhone
			const { data: existPhone } = await supabase
				.from("contacts")
				.select("id, name, phone")
				.eq("account_id", account_id)
				.or(`phone_normalized.eq.${digitsOnlyPhone},phone.like.%${suffix}`)
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
			if (normalizedPhone) updateData.phone = normalizedPhone
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
			// phone es NOT NULL en la tabla: usamos marcador si no vino en el formulario
			const phoneValue = normalizedPhone || `nw_form_${Date.now()}`

			const { data: newContact, error: insertError } = await supabase
				.from("contacts")
				.insert({
					account_id,
					user_id: ownerUserId,
					name: name || "Web Lead",
					email: email || null,
					phone: phoneValue,
					company: company || null,
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

		// 5. Captura exhaustiva de campos personalizados (Asunto, Mensaje y otros)
		let asunto = (body.asunto || body.subject || body.motivo || "").trim()
		let mensaje = (body.mensaje || body.message || body.comentario || body.comments || body.consulta || "").trim()

		// Si no vinieron con nombres directos, buscar en fields_config.custom por label
		if (Array.isArray(form.fields_config?.custom)) {
			for (const cf of form.fields_config.custom) {
				const cfLabelLower = (cf.label || "").toLowerCase().trim()
				const val = (body[cf.id] ?? body[cf.label] ?? "")
				const valStr = String(val).trim()
				if (!asunto && (cfLabelLower === "asunto" || cfLabelLower === "subject" || cfLabelLower.includes("asunto"))) {
					asunto = valStr
				}
				if (!mensaje && (cfLabelLower === "mensaje" || cfLabelLower === "message" || cfLabelLower.includes("mensaje") || cfLabelLower.includes("consulta"))) {
					mensaje = valStr
				}
			}
		}

		const customEntries: { label: string; value: string }[] = []

		if (asunto) {
			customEntries.push({ label: "Asunto", value: asunto })
		}
		if (mensaje) {
			customEntries.push({ label: "Mensaje", value: mensaje })
		}

		// Campos estandar para descartar al capturar campos adicionales
		const standardKeys = new Set([
			"name", "nombre", "full_name", "fullName",
			"email", "correo", "mail",
			"phone", "telefono", "phone_number", "celular", "tel",
			"company", "empresa", "organization",
			"asunto", "subject", "motivo",
			"mensaje", "message", "comentario", "comments", "consulta",
			"cf-turnstile-response", "turnstile", "token", "formId", "g-recaptcha-response"
		])

		// Evaluar otros campos configurados en form.fields_config.custom
		if (Array.isArray(form.fields_config?.custom)) {
			for (const cf of form.fields_config.custom) {
				const cfLabelLower = (cf.label || "").toLowerCase().trim()
				if (cfLabelLower === "asunto" || cfLabelLower === "subject" || cfLabelLower.includes("asunto")) continue
				if (cfLabelLower === "mensaje" || cfLabelLower === "message" || cfLabelLower.includes("mensaje") || cfLabelLower.includes("consulta")) continue

				const val = (body[cf.id] ?? body[cf.label] ?? body[cfLabelLower] ?? "")
				const valStr = String(val).trim()
				if (valStr) {
					customEntries.push({ label: cf.label || cf.id, value: valStr })
				}
			}
		}

		// Capturar otros campos dinamicos adicionales no estandar enviados por el frontend
		for (const [key, rawVal] of Object.entries(body)) {
			if (standardKeys.has(key)) continue
			if (Array.isArray(form.fields_config?.custom) && form.fields_config.custom.some((cf: any) => cf.id === key)) {
				continue
			}
			const valStr = String(rawVal ?? "").trim()
			if (valStr) {
				const formattedLabel = key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())
				customEntries.push({ label: formattedLabel, value: valStr })
			}
		}

		// Formatear resumen para notas y negociacion
		let customNotes = ""
		if (customEntries.length > 0) {
			customNotes = customEntries
				.map(entry => `${entry.label}: ${entry.value}`)
				.join("\n\n")
		}

		// 6. Crear negociacion (Deal) si hay pipeline configurado
		let createdDealId: string | null = null
		let generatedDealTitle: string | undefined = undefined
		if (pipeline_id && stage_id && contactId) {
			const dealTitle = asunto
				? `${asunto} - ${company || name || "Lead Web"}`
				: `Web Lead - ${company || name || email || normalizedPhone || "Sin nombre"}`
			generatedDealTitle = dealTitle

			// Calcular fecha estimada de cierre a 3 meses desde hoy (YYYY-MM-DD)
			const closeDate = new Date()
			closeDate.setMonth(closeDate.getMonth() + 3)
			const expectedCloseDate = closeDate.toISOString().split("T")[0]

			const { data: newDeal, error: dealError } = await supabase.from("deals").insert({
				account_id,
				user_id: ownerUserId,
				pipeline_id,
				stage_id,
				contact_id: contactId,
				title: dealTitle,
				value: 0,
				currency: "CLP",
				expected_close_date: expectedCloseDate,
				status: "open",
				notes: customNotes || null,
			}).select("id").single()

			if (dealError) {
				console.error("[forms/submit] Error al crear deal:", JSON.stringify(dealError))
			} else if (newDeal) {
				createdDealId = newDeal.id
			}
		}

		// 7. Guardar SIEMPRE en contact_notes para visibilidad inmediata en el CRM (Ficha de contacto e Inbox)
		if (customNotes && contactId) {
			const formTitle = form.title || form.name || "Contacto Web"
			const fullNoteText = `[Formulario: ${formTitle}]\n\n${customNotes}`

			const { error: noteError } = await supabase.from("contact_notes").insert({
				account_id,
				contact_id: contactId,
				user_id: ownerUserId,
				note_text: fullNoteText,
			})
			if (noteError) {
				console.error("[forms/submit] Error al insertar nota en contacto:", JSON.stringify(noteError))
			}
		}

		// 8. Registrar envio en web_form_submissions para auditoria y trazabilidad de eventos
		try {
			const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || null
			const userAgent = req.headers.get("user-agent") || null

			const { error: subError } = await supabase.from("web_form_submissions").insert({
				account_id,
				form_id: id,
				contact_id: contactId || null,
				deal_id: createdDealId || null,
				data: body,
				ip_address: clientIp,
				user_agent: userAgent,
			})
			if (subError) {
				console.warn("[forms/submit] Advertencia al registrar submission en BD:", subError.message)
			}
		} catch (subErr) {
			console.warn("[forms/submit] Excepcion al registrar submission:", subErr)
		}

		// 9. Enviar correo consolidado con lead y negociacion a los miembros del equipo
		try {
			// Obtener correos de los miembros del espacio de trabajo respetando preferencias
			let memberProfiles: any[] | null = null
			const queryWithPrefs = await supabase
				.from("profiles")
				.select("email, notification_preferences")
				.eq("account_id", account_id)
				.not("email", "is", null)

			if (queryWithPrefs.error) {
				const fallbackQuery = await supabase
					.from("profiles")
					.select("email")
					.eq("account_id", account_id)
					.not("email", "is", null)
				memberProfiles = fallbackQuery.data
			} else {
				memberProfiles = queryWithPrefs.data
			}

			const memberEmails = (memberProfiles || [])
				.filter((p: any) => p.notification_preferences?.email_web_lead !== false)
				.map((p: any) => p.email)
				.filter((e: any): e is string => Boolean(e) && e.includes("@"))

			// Fallback al owner_user_id solo si no hay miembros vinculados por account_id
			let targetEmails = memberEmails
			if (targetEmails.length === 0 && (!memberProfiles || memberProfiles.length === 0)) {
				const { data: ownerProfile } = await supabase
					.from("profiles")
					.select("email, notification_preferences")
					.eq("user_id", ownerUserId)
					.single()
				if (ownerProfile?.email && ownerProfile.notification_preferences?.email_web_lead !== false) {
					targetEmails = [ownerProfile.email]
				}
			}

			// 9.1 Asegurar que exista una conversacion para que el lead sea accesible en el Inbox
			let conversationId: string | undefined = undefined
			if (contactId) {
				try {
					const { data: existingConv } = await supabase
						.from("conversations")
						.select("id")
						.eq("account_id", account_id)
						.eq("contact_id", contactId)
						.order("created_at", { ascending: false })
						.limit(1)

					if (existingConv && existingConv.length > 0) {
						conversationId = existingConv[0].id
					} else {
						const { data: newConv } = await supabase
							.from("conversations")
							.insert({
								account_id,
								user_id: ownerUserId,
								contact_id: contactId,
								status: "open",
							})
							.select("id")
							.single()

						if (newConv) {
							conversationId = newConv.id
						}
					}
				} catch {
					// Falla silenciosa si no se puede inicializar conversacion anticipadamente
				}
			}

			if (targetEmails.length > 0) {
				const emailResult = await sendWebLeadEmail({
					toEmail: targetEmails,
					formName: form.title || form.name || "Formulario Web",
					contactName: name || email || normalizedPhone || "Nuevo contacto",
					contactEmail: email || undefined,
					contactPhone: normalizedPhone || undefined,
					company: company || undefined,
					dealTitle: generatedDealTitle,
					customFields: customEntries.map((e) => ({ label: e.label, value: e.value })),
					contactId: contactId || undefined,
					conversationId: conversationId || undefined,
				})
				if (!emailResult.success) {
					console.warn("[forms/submit] No se pudo despachar la notificacion por correo interno.")
				}
			}
		} catch {
			// Silencioso por seguridad: previene fuga de PII y trazabilidad externa
		}

		return NextResponse.json({ success: true }, { headers: corsHeaders })

	} catch (error: any) {
		console.error("[forms/submit] Error inesperado:", error)
		return NextResponse.json(
			{ error: error?.message || "Ocurrió un error inesperado.", stack: error?.stack },
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
