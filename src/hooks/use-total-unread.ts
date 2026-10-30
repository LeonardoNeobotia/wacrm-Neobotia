"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Conversation } from "@/types";
import { playInboxSound } from "@/lib/sound/notification";
import { getActiveInboxConversationId } from "@/lib/sound/active-presence";

/**
 * Hook para contabilizar conversaciones de WhatsApp con mensajes no leidos
 * y reproducir el sonido suave de bandeja de entrada cuando llega un mensaje de cliente.
 */
export function useTotalUnread(): number {
	const [total, setTotal] = useState(0);

	// Espejo local de {id: unread_count} para calcular cambios en O(1)
	const countsRef = useRef<Map<string, number>>(new Map());
	const initialLoadDoneRef = useRef(false);

	useEffect(() => {
		const supabase = createClient();
		let cancelled = false;

		// Carga inicial de conversaciones no leidas
		(async () => {
			const { data, error } = await supabase
				.from("conversations")
				.select("id, unread_count");
			if (cancelled || error || !data) return;

			const map = new Map<string, number>();
			let sum = 0;
			for (const row of data as { id: string; unread_count: number }[]) {
				const n = row.unread_count ?? 0;
				map.set(row.id, n);
				if (n > 0) sum += 1;
			}
			countsRef.current = map;
			initialLoadDoneRef.current = true;
			setTotal(sum);
		})();

		const channel = supabase
			.channel("total-unread-realtime")
			.on(
				"postgres_changes",
				{ event: "*", schema: "public", table: "conversations" },
				(payload) => {
					const map = countsRef.current;
					if (payload.eventType === "DELETE") {
						const oldRow = payload.old as Partial<Conversation>;
						if (oldRow.id) map.delete(oldRow.id);
					} else {
						const row = payload.new as Conversation;
						const prev = map.get(row.id) ?? 0;
						const next = row.unread_count ?? 0;
						map.set(row.id, next);

						// Si el contador aumenta debido a un nuevo mensaje entrante de WhatsApp:
						if (initialLoadDoneRef.current && next > prev) {
							// 1. Verificar si la pestaña tiene foco y no está oculta / en segundo plano
							const isHidden = typeof document !== "undefined" ? document.hidden : false;
							const hasFocus =
								typeof document !== "undefined" && typeof document.hasFocus === "function"
									? document.hasFocus()
									: true;
							const isTabFocused = !isHidden && hasFocus;

							// 2. Verificar si el usuario está en la ruta de bandeja de entrada
							const isInboxRoute =
								typeof window !== "undefined" &&
								window.location.pathname.startsWith("/inbox");

							// 3. Obtener la conversación actualmente abierta en pantalla
							const activeConvId =
								getActiveInboxConversationId() ||
								(typeof window !== "undefined"
									? new URLSearchParams(window.location.search).get("c")
									: null);

							// El usuario sólo se considera "presente y activo en esta conversación" si
							// la pestaña está enfocada, está en /inbox y tiene esta misma conversación abierta
							const isActivelyViewingThisConv =
								isTabFocused &&
								isInboxRoute &&
								Boolean(activeConvId && activeConvId === row.id);

							// Reproducir sonido si está en otra sección (ej. chat interno), en otra pestaña, o en otra conversación
							if (!isActivelyViewingThisConv) {
								playInboxSound();
							}
						}
					}

					// Recalcular total de conversaciones con mensajes no leidos
					let sum = 0;
					for (const n of map.values()) if (n > 0) sum += 1;
					setTotal(sum);
				}
			)
			.subscribe();

		return () => {
			cancelled = true;
			supabase.removeChannel(channel);
		};
	}, []);

	return total;
}
