import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const p = await params
    const id = p.id
    const body = await req.json()

    // We must use the service role key to insert records without being authenticated
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    }

    // 1. Get the form configuration
    const { data: form, error: formError } = await supabase
      .from("web_forms")
      .select("*")
      .eq("id", id)
      .eq("is_active", true)
      .single()

    if (formError || !form) {
      return NextResponse.json({ error: "Form not found or inactive" }, { status: 404, headers: corsHeaders })
    }

    const { account_id, pipeline_id, stage_id } = form
    const { name, email, phone, company } = body

    // 2. Try to find existing contact by email or phone
    let contactId = null
    let contactName = name || "Web Lead"

    if (email) {
      const { data: existEmail } = await supabase
        .from("contacts")
        .select("id, name")
        .eq("account_id", account_id)
        .eq("email", email)
        .limit(1)
      if (existEmail && existEmail.length > 0) {
        contactId = existEmail[0].id
        if (existEmail[0].name) contactName = existEmail[0].name
      }
    }

    if (!contactId && phone) {
      const { data: existPhone } = await supabase
        .from("contacts")
        .select("id, name")
        .eq("account_id", account_id)
        .eq("phone", phone)
        .limit(1)
      if (existPhone && existPhone.length > 0) {
        contactId = existPhone[0].id
        if (existPhone[0].name) contactName = existPhone[0].name
      }
    }

    // 3. Create or update contact
    if (contactId) {
      const updateData: any = {}
      if (name) updateData.name = name
      if (email) updateData.email = email
      if (phone) updateData.phone = phone
      if (company) updateData.company = company

      if (Object.keys(updateData).length > 0) {
        await supabase
          .from("contacts")
          .update(updateData)
          .eq("id", contactId)
      }
    } else {
      // Create new contact — phone is NOT NULL in contacts table,
      // so we use a placeholder if not provided by the form.
      const phoneValue = phone || `web_lead_${Date.now()}`
      const { data: newContact, error: insertError } = await supabase
        .from("contacts")
        .insert({
          account_id,
          name: name || "Web Lead",
          email: email || null,
          phone: phoneValue,
          company: company || null,
        })
        .select("id")
        .single()
        
      if (insertError) {
        return NextResponse.json({ error: "Could not save contact information" }, { status: 500, headers: corsHeaders })
      }
      contactId = newContact.id
    }

    // Format custom fields as a note
    let customNotes = ""
    if (form.fields_config?.custom?.length > 0) {
      customNotes = form.fields_config.custom.map((cf: any) => {
        return `${cf.label}: ${body[cf.id] || "No proporcionado"}`
      }).join("\n\n")
    }

    // 4. Create Deal if pipeline is configured
    if (pipeline_id && stage_id && contactId) {
      const title = `Web Lead - ${company || name || email || phone || "Unknown"}`
      
      await supabase
        .from("deals")
        .insert({
          account_id,
          title,
          contact_id: contactId,
          stage_id: stage_id,
          value: 0,
          currency: "USD",
          status: "open",
          notes: customNotes || null
        })
    } else if (customNotes && contactId) {
      // If no deal is created but we have custom notes, store them in contact_notes
      const { data: account } = await supabase.from("accounts").select("owner_user_id").eq("id", account_id).single()
      if (account?.owner_user_id) {
        await supabase.from("contact_notes").insert({
          contact_id: contactId,
          user_id: account.owner_user_id,
          note_text: customNotes
        })
      }
    }

    // Return success
    return NextResponse.json({ success: true }, { headers: corsHeaders })
    
  } catch (error: any) {
    console.error("Web form submission error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500, headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      } }
    )
  }
}

// Enable CORS for external websites
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
