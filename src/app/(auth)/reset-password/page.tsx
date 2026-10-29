"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getAuthErrorMessage } from "@/lib/auth/error-messages";
import { validatePasswordStrength } from "@/lib/auth/password-validation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { CheckCircle, Lock, ArrowLeft, AlertCircle, Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const [checkingSession, setCheckingSession] = useState(true);
	const [hasSession, setHasSession] = useState(false);
	const supabase = createClient();

	// Verificar que el usuario cuente con una sesion valida generada por el enlace de recuperacion
	useEffect(() => {
		supabase.auth.getSession().then(({ data: { session } }) => {
			setHasSession(Boolean(session));
			setCheckingSession(false);
		});
	}, [supabase]);

	const handleUpdatePassword = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		const passwordValidation = validatePasswordStrength(password);
		if (!passwordValidation.isValid) {
			setError(passwordValidation.error);
			return;
		}

		if (password !== confirmPassword) {
			setError("Las contraseñas no coinciden");
			return;
		}

		setLoading(true);

		const { error: updateError } = await supabase.auth.updateUser({
			password,
		});

		if (updateError) {
			setError(getAuthErrorMessage(updateError));
			setLoading(false);
			return;
		}

		// Cerrar la sesion inmediatamente para que no ingrese automaticamente al dashboard
		// y deba autenticarse expresamente con su nueva clave en /login
		await supabase.auth.signOut();

		setSuccess(true);
		setLoading(false);
	};

	if (checkingSession) {
		return (
			<div className="w-full max-w-md px-4 sm:px-0">
				<Card className="w-full border-border/50 bg-card/80 backdrop-blur-md shadow-2xl">
					<CardContent className="flex flex-col items-center justify-center py-12 gap-3">
						<Loader2 className="h-8 w-8 animate-spin text-primary" />
						<p className="text-sm text-muted-foreground">Verificando enlace de seguridad...</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (!hasSession && !success) {
		return (
			<div className="w-full max-w-md px-4 sm:px-0">
				<Card className="w-full border-border/50 bg-card/80 backdrop-blur-md shadow-2xl">
					<CardHeader className="items-center text-center">
						<div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10">
							<AlertCircle className="h-6 w-6 text-red-500" />
						</div>
						<CardTitle className="text-xl text-foreground">
							Enlace no válido o expirado
						</CardTitle>
						<CardDescription className="text-muted-foreground">
							No se encontró una sesión activa de recuperación. Por seguridad, este enlace es de un solo uso.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-3">
						<Link href="/forgot-password">
							<Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
								Solicitar nuevo enlace
							</Button>
						</Link>
						<Link href="/login">
							<Button variant="outline" className="w-full">
								Volver al inicio de sesión
							</Button>
						</Link>
					</CardContent>
				</Card>
			</div>
		);
	}

	if (success) {
		return (
			<div className="w-full max-w-md px-4 sm:px-0">
				<Card className="w-full border-border/50 bg-card/80 backdrop-blur-md shadow-2xl">
					<CardHeader className="items-center text-center">
						<div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
							<CheckCircle className="h-6 w-6 text-primary" />
						</div>
						<CardTitle className="text-xl text-foreground">
							Contraseña actualizada
						</CardTitle>
						<CardDescription className="text-muted-foreground">
							Tu contraseña ha sido modificada con éxito. Por seguridad, tu sesión ha sido cerrada para que ingreses con tus nuevas credenciales.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							onClick={async () => {
								await supabase.auth.signOut();
								window.location.href = "/login?reset=success";
							}}
							className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
						>
							Ir al inicio de sesión
						</Button>
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="w-full max-w-md px-4 sm:px-0">
			<Card className="w-full border-border/50 bg-card/80 backdrop-blur-md shadow-2xl">
				<CardHeader className="items-center text-center">
					<div className="mb-4 flex items-center justify-center">
						<img
							src="/logo-neo-wa-dark.png"
							alt="Neo WA Logo"
							className="h-24 w-auto dark:hidden"
						/>
						<img
							src="/logo-neo-wa.png"
							alt="Neo WA Logo"
							className="hidden h-24 w-auto dark:block"
						/>
					</div>
					<CardTitle className="text-xl text-foreground">
						Nueva contraseña
					</CardTitle>
					<CardDescription className="text-muted-foreground">
						Ingresa tu nueva contraseña para acceder a Neowapp CRM
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleUpdatePassword} className="flex flex-col gap-4">
						{error && (
							<div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
								{error}
							</div>
						)}

						<div className="flex flex-col gap-2">
							<Label htmlFor="password" className="text-muted-foreground">
								Nueva contraseña
							</Label>
							<Input
								id="password"
								type="password"
								placeholder="••••••••"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								minLength={8}
								className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
							/>
							<p className="text-xs text-muted-foreground">
								Mínimo 8 caracteres, con mayúsculas, minúsculas y números.
							</p>
						</div>

						<div className="flex flex-col gap-2">
							<Label htmlFor="confirmPassword" className="text-muted-foreground">
								Confirmar nueva contraseña
							</Label>
							<Input
								id="confirmPassword"
								type="password"
								placeholder="••••••••"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								required
								minLength={8}
								className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
							/>
						</div>

						<Button
							type="submit"
							disabled={loading}
							className="mt-2 h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
						>
							{loading ? "Actualizando..." : "Actualizar contraseña"}
						</Button>
					</form>

					<Link
						href="/login"
						className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
					>
						<ArrowLeft className="h-4 w-4" />
						Volver al inicio de sesión
					</Link>
				</CardContent>
			</Card>
		</div>
	);
}
