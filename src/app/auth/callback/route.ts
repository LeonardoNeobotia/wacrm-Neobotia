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

	// Resolver la URL publica base evitando 0.0.0.0 o puertos de contenedor interno
	const forwardedHost = request.headers.get('x-forwarded-host')
	const host = request.headers.get('host')
	const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
	const siteUrl = process.env.NEXT_PUBLIC_SITE_URL

	let baseUrl: string
	if (siteUrl && siteUrl.startsWith('http')) {
		baseUrl = siteUrl.replace(/\/$/, '')
	} else if (forwardedHost && !forwardedHost.includes('0.0.0.0')) {
		baseUrl = `${forwardedProto}://${forwardedHost}`
	} else if (host && !host.includes('0.0.0.0')) {
		baseUrl = `${forwardedProto}://${host}`
	} else {
		baseUrl = request.nextUrl.origin.includes('0.0.0.0') ? 'https://neowapp.neobotia.cl' : request.nextUrl.origin
	}

	const redirectUrl = new URL(next, baseUrl)

	const supabase = await createClient()

	// Flujo 1: PKCE code exchange
	if (code) {
		const { error } = await supabase.auth.exchangeCodeForSession(code)
		if (!error) {
			return NextResponse.redirect(redirectUrl)
		}
	}

	// Flujo 2: Token hash para reset password / signup / invite
	if (token_hash && type) {
		const { error } = await supabase.auth.verifyOtp({
			type,
			token_hash,
		})
		if (!error) {
			return NextResponse.redirect(redirectUrl)
		}
	}

	// Si falla la verificacion, redirige a login con mensaje descriptivo
	const loginUrl = new URL('/login', baseUrl)
	loginUrl.searchParams.set('error', 'El enlace de recuperacion es invalido o ha expirado')
	return NextResponse.redirect(loginUrl)
}
