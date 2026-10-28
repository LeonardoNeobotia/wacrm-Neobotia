"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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
import { CheckCircle, Lock, ArrowLeft } from "lucide-react";

export default function ResetPasswordPage() {
	const router = useRouter();
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState(false);
	const supabase = createClient();

	const handleUpdatePassword = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		if (password.length < 6) {
			setError("La contraseña debe tener al menos 6 caracteres");
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
			setError(updateError.message);
			setLoading(false);
			return;
		}

		setSuccess(true);
		setLoading(false);
	};

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
							Tu contraseña ha sido modificada con éxito. Ya puedes iniciar sesión con tu nueva clave.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							onClick={() => router.push("/login")}
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
								minLength={6}
								className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
							/>
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
								minLength={6}
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
