import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Endpoint de intercambio de tokens y autenticación de Supabase (auth/callback).
 * Procesa enlaces mágicos, confirmaciones de correo y reseteo de contraseña.
 */
export async function GET(request: NextRequest) {
	const { searchParams } = new URL(request.url)
	const token_hash = searchParams.get('token_hash')
	const type = searchParams.get('type') as EmailOtpType | null
	const next = searchParams.get('next') ?? '/'
	const code = searchParams.get('code')

	const redirectTo = request.nextUrl.clone()
	redirectTo.pathname = next
	redirectTo.searchParams.delete('token_hash')
	redirectTo.searchParams.delete('type')
	redirectTo.searchParams.delete('code')
	redirectTo.searchParams.delete('next')

	const supabase = await createClient()

	// Flujo 1: PKCE code exchange
	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code)
		if (!error) {
			return NextResponse.redirect(redirectTo)
		}
	}

	// Flujo 2: Token hash para reset password / signup / invite
	if (token_hash && type) {
		const { error } = await supabase.auth.verifyOtp({
			type,
			token_hash,
		})
		if (!error) {
			return NextResponse.redirect(redirectTo)
		}
	}

	// Si falla la verificación, redirige a login con mensaje descriptivo
	redirectTo.pathname = '/login'
	redirectTo.searchParams.set('error', 'El enlace de recuperación es inválido o ha expirado')
	return NextResponse.redirect(redirectTo)
}
