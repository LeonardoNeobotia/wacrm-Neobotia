'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Contact, CustomField, MessageTemplate } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
	ArrowLeft,
	ArrowRight,
	Eye,
	ImageIcon,
	Loader2,
	CheckCheck,
	Film,
	FileText,
	ExternalLink,
	Phone,
	CornerDownLeft,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { extractTemplateVariables } from '@/lib/whatsapp/template-validators';

type VariableType = 'static' | 'field' | 'custom_field';

export interface VariableMapping {
	type: VariableType;
	value: string;
}

export interface AudienceConfig {
	type: 'all' | 'tags' | 'custom_field' | 'csv';
	tagIds?: string[];
	customField?: {
		fieldId: string;
		operator: 'is' | 'is_not' | 'contains';
		value: string;
	};
	csvContacts?: { phone: string; name?: string }[];
	excludeTagIds?: string[];
}

interface Step3Props {
	template: MessageTemplate;
	audience: AudienceConfig;
	variables: Record<string, VariableMapping>;
	onUpdate: (variables: Record<string, VariableMapping>) => void;
	/** URL de medios para encabezados IMAGE, VIDEO o DOCUMENT */
	headerMediaUrl: string;
	onHeaderMediaUrlChange: (url: string) => void;
	onNext: () => void;
	onBack: () => void;
}

const MEDIA_HEADER_TYPES = ['image', 'video', 'document'] as const;
type MediaHeaderType = (typeof MEDIA_HEADER_TYPES)[number];

function isMediaHeaderType(value: unknown): value is MediaHeaderType {
	return MEDIA_HEADER_TYPES.includes(value as MediaHeaderType);
}

function isValidHttpUrl(value: string): boolean {
	try {
		const u = new URL(value);
		return u.protocol === 'http:' || u.protocol === 'https:';
	} catch {
		return false;
	}
}

/** Contacto de muestra cuando la audiencia no tiene contactos registrados aun */
const SAMPLE_CONTACT: Contact = {
	id: 'sample',
	user_id: '',
	account_id: '',
	name: 'Juan Pérez',
	phone: '+5491112345678',
	email: 'juan@ejemplo.com',
	company: 'Mi Empresa',
	created_at: new Date().toISOString(),
	updated_at: new Date().toISOString(),
};

/**
 * Determina el valor combinado para el elemento <select>
 */
function getSelectedDropdownValue(mapping?: VariableMapping): string {
	if (!mapping) return 'field:name';
	if (mapping.type === 'static') return 'static';
	if (mapping.type === 'field') return `field:${mapping.value || 'name'}`;
	if (mapping.type === 'custom_field') return `custom_field:${mapping.value}`;
	return 'field:name';
}

export function Step3Personalize({
	template,
	audience,
	variables,
	onUpdate,
	headerMediaUrl,
	onHeaderMediaUrlChange,
	onNext,
	onBack,
}: Step3Props) {
	const t = useTranslations('Broadcasts.wizard');
	const [customFields, setCustomFields] = useState<CustomField[]>([]);
	const [firstContact, setFirstContact] = useState<Contact | null>(null);
	const [firstContactCustomValues, setFirstContactCustomValues] = useState<Map<string, string>>(new Map());
	const [loadingPreview, setLoadingPreview] = useState(true);

	// Extraer las variables del cuerpo de la plantilla (soporta {{1}} y {{nombre_cliente}})
	const placeholders = useMemo(() => {
		const varInfo = extractTemplateVariables(template.body_text);
		return varInfo.variables.map((v) => `{{${v}}}`);
	}, [template.body_text]);

	// Auto-asignar mapeos inteligentes por defecto para que el usuario no tenga que configurar todo desde cero
	useEffect(() => {
		let changed = false;
		const next = { ...variables };

		placeholders.forEach((placeholder, idx) => {
			const key = placeholder.replace(/^\{\{|\}\}$/g, '');
			if (!next[key]) {
				changed = true;
				const lower = key.toLowerCase();
				if (
					lower.includes('nombre') ||
					lower.includes('name') ||
					lower.includes('cliente') ||
					key === '1'
				) {
					next[key] = { type: 'field', value: 'name' };
				} else if (
					lower.includes('empresa') ||
					lower.includes('company') ||
					key === '2'
				) {
					next[key] = { type: 'field', value: 'company' };
				} else if (lower.includes('tel') || lower.includes('phone')) {
					next[key] = { type: 'field', value: 'phone' };
				} else if (lower.includes('email') || lower.includes('correo')) {
					next[key] = { type: 'field', value: 'email' };
				} else {
					next[key] = { type: 'field', value: idx === 0 ? 'name' : 'company' };
				}
			}
		});

		if (changed) {
			onUpdate(next);
		}
	}, [placeholders]);

	// Cargar campos personalizados y obtener un contacto representativo de la audiencia seleccionada
	useEffect(() => {
		let cancelled = false;
		setLoadingPreview(true);

		(async () => {
			const supabase = createClient();

			// Cargar campos personalizados de la cuenta
			const { data: fieldsData } = await supabase
				.from('custom_fields')
				.select('*')
				.order('field_name');

			if (cancelled) return;
			setCustomFields(fieldsData ?? []);

			let contact: Contact | null = null;
			const customValsMap = new Map<string, string>();

			try {
				if (audience.type === 'tags' && audience.tagIds && audience.tagIds.length > 0) {
					// Filtrar por etiquetas seleccionadas
					const { data: tagRows } = await supabase
						.from('contact_tags')
						.select('contact_id')
						.in('tag_id', audience.tagIds);

					let ids = Array.from(new Set((tagRows ?? []).map((r) => r.contact_id)));

					// Restar etiquetas excluidas si existen
					if (audience.excludeTagIds && audience.excludeTagIds.length > 0) {
						const { data: excRows } = await supabase
							.from('contact_tags')
							.select('contact_id')
							.in('tag_id', audience.excludeTagIds);
						const excSet = new Set((excRows ?? []).map((r) => r.contact_id));
						ids = ids.filter((id) => !excSet.has(id));
					}

					if (ids.length > 0) {
						const { data: c } = await supabase
							.from('contacts')
							.select('*')
							.in('id', ids)
							.order('updated_at', { ascending: false })
							.limit(1)
							.maybeSingle();
						contact = c ?? null;
					}
				} else if (
					audience.type === 'custom_field' &&
					audience.customField?.fieldId &&
					audience.customField.value
				) {
					// Filtrar por campo personalizado
					const { fieldId, operator, value } = audience.customField;
					let q = supabase
						.from('contact_custom_values')
						.select('contact_id')
						.eq('custom_field_id', fieldId);

					if (operator === 'is') q = q.eq('value', value);
					else if (operator === 'is_not') q = q.neq('value', value);
					else q = q.ilike('value', `%${value}%`);

					const { data: cvRows } = await q;
					let ids = Array.from(new Set((cvRows ?? []).map((r) => r.contact_id)));

					if (audience.excludeTagIds && audience.excludeTagIds.length > 0) {
						const { data: excRows } = await supabase
							.from('contact_tags')
							.select('contact_id')
							.in('tag_id', audience.excludeTagIds);
						const excSet = new Set((excRows ?? []).map((r) => r.contact_id));
						ids = ids.filter((id) => !excSet.has(id));
					}

					if (ids.length > 0) {
						const { data: c } = await supabase
							.from('contacts')
							.select('*')
							.in('id', ids)
							.limit(1)
							.maybeSingle();
						contact = c ?? null;
					}
				} else if (
					audience.type === 'csv' &&
					audience.csvContacts &&
					audience.csvContacts.length > 0
				) {
					// Usar el primer contacto de la lista CSV subida
					const first = audience.csvContacts[0];
					contact = {
						id: 'sample-csv',
						user_id: '',
						account_id: '',
						name: first.name || 'Contacto CSV',
						phone: first.phone,
						email: '',
						company: '',
						created_at: new Date().toISOString(),
						updated_at: new Date().toISOString(),
					};
				} else {
					// Audiencia 'all' (todos los contactos respetando exclusiones)
					let q = supabase.from('contacts').select('*');
					if (audience.excludeTagIds && audience.excludeTagIds.length > 0) {
						const { data: excRows } = await supabase
							.from('contact_tags')
							.select('contact_id')
							.in('tag_id', audience.excludeTagIds);
						const excIds = Array.from(new Set((excRows ?? []).map((r) => r.contact_id)));
						if (excIds.length > 0) {
							q = q.not('id', 'in', `(${excIds.join(',')})`);
						}
					}
					const { data: c } = await q
						.order('created_at', { ascending: false })
						.limit(1)
						.maybeSingle();
					contact = c ?? null;
				}

				// Cargar valores personalizados del contacto seleccionado si existe
				if (contact && contact.id !== 'sample-csv') {
					const { data: customVals } = await supabase
						.from('contact_custom_values')
						.select('custom_field_id, value')
						.eq('contact_id', contact.id);

					for (const row of customVals ?? []) {
						customValsMap.set(row.custom_field_id, row.value ?? '');
					}
				}
			} catch (err) {
				console.error('Error fetching preview contact for audience:', err);
			}

			if (!cancelled) {
				setFirstContact(contact);
				setFirstContactCustomValues(customValsMap);
				setLoadingPreview(false);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [
		audience.type,
		audience.tagIds,
		audience.customField,
		audience.csvContacts,
		audience.excludeTagIds,
	]);

	// Validacion de cabecera multimedia si la plantilla lo requiere
	const mediaHeaderType = isMediaHeaderType(template.header_type)
		? template.header_type
		: null;

	useEffect(() => {
		if (mediaHeaderType && !headerMediaUrl && template.header_media_url) {
			onHeaderMediaUrlChange(template.header_media_url);
		}
	}, [mediaHeaderType, template.header_media_url]);

	const headerMediaError = useMemo<'missing' | 'invalid' | null>(() => {
		if (!mediaHeaderType) return null;
		const value = headerMediaUrl.trim();
		if (!value) return 'missing';
		if (!isValidHttpUrl(value)) return 'invalid';
		return null;
	}, [mediaHeaderType, headerMediaUrl]);

	// Comprueba que todas las variables tengan un origen configurado
	const unmappedKeys = useMemo(() => {
		const missing: string[] = [];
		for (const placeholder of placeholders) {
			const key = placeholder.replace(/^\{\{|\}\}$/g, '');
			const mapping = variables[key];
			if (!mapping) {
				missing.push(placeholder);
			} else if (mapping.type === 'static' && !mapping.value?.trim()) {
				missing.push(placeholder);
			} else if ((mapping.type === 'field' || mapping.type === 'custom_field') && !mapping.value) {
				missing.push(placeholder);
			}
		}
		return missing;
	}, [placeholders, variables]);

	function handleDropdownChange(key: string, combinedVal: string) {
		if (combinedVal === 'static') {
			const current = variables[key];
			const prevVal = current?.type === 'static' ? current.value : '';
			onUpdate({
				...variables,
				[key]: { type: 'static', value: prevVal },
			});
		} else if (combinedVal.startsWith('field:')) {
			const fieldName = combinedVal.replace('field:', '');
			onUpdate({
				...variables,
				[key]: { type: 'field', value: fieldName },
			});
		} else if (combinedVal.startsWith('custom_field:')) {
			const fieldId = combinedVal.replace('custom_field:', '');
			onUpdate({
				...variables,
				[key]: { type: 'custom_field', value: fieldId },
			});
		}
	}

	function handleStaticValueChange(key: string, value: string) {
		onUpdate({
			...variables,
			[key]: { type: 'static', value },
		});
	}

	// Sustitucion en vivo de placeholders con los datos del contacto de la audiencia
	const previewText = useMemo(() => {
		const contact = firstContact ?? SAMPLE_CONTACT;
		const customValues = firstContact
			? firstContactCustomValues
			: new Map<string, string>();

		let text = template.body_text;
		for (const placeholder of placeholders) {
			const key = placeholder.replace(/^\{\{|\}\}$/g, '');
			const mapping = variables[key];
			let replacement = placeholder;

			if (mapping) {
				if (mapping.type === 'static' && mapping.value) {
					replacement = mapping.value;
				} else if (mapping.type === 'field' && mapping.value) {
					const fieldMap: Record<string, string | undefined> = {
						name: contact.name,
						phone: contact.phone,
						email: contact.email,
						company: contact.company,
					};
					replacement = fieldMap[mapping.value] || `[${mapping.value}]`;
				} else if (mapping.type === 'custom_field' && mapping.value) {
					replacement = customValues.get(mapping.value) || '[Campo personalizado]';
				}
			}
			text = text.replaceAll(placeholder, replacement);
		}
		return text;
	}, [
		template.body_text,
		variables,
		placeholders,
		firstContact,
		firstContactCustomValues,
	]);

	const previewLabel = firstContact
		? `${firstContact.name ? `${firstContact.name} • ` : ''}${firstContact.phone}`
		: 'Ejemplo demostrativo (sin contactos en la audiencia)';

	return (
		<div className="space-y-6">
			<div>
				<h2 className="text-lg font-semibold text-foreground">Personalizar Variables</h2>
				<p className="mt-1 text-sm text-muted-foreground">
					Asigna cada variable de tu plantilla a los datos de tus contactos o escribe un valor fijo.
				</p>
			</div>

			{/* Encabezado multimedia si la plantilla lo requiere */}
			{mediaHeaderType && (
				<div className="rounded-xl border border-border bg-card/50 p-4">
					<div className="mb-3 flex items-center gap-2">
						<ImageIcon className="h-4 w-4 text-primary" />
						<p className="text-sm font-medium text-foreground">Contenido del encabezado</p>
						<span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium uppercase text-primary">
							{mediaHeaderType}
						</span>
					</div>
					<label className="mb-1.5 block text-xs font-medium text-muted-foreground">
						URL del archivo multimedia
					</label>
					<Input
						type="url"
						value={headerMediaUrl}
						onChange={(e) => onHeaderMediaUrlChange(e.target.value)}
						placeholder="https://ejemplo.com/archivo.png"
						className="border-border bg-muted text-foreground placeholder:text-muted-foreground"
					/>
					<p className="mt-1.5 text-xs text-muted-foreground">
						Meta requiere un enlace directo al recurso multimedia para enviar esta plantilla.
					</p>
					{mediaHeaderType === 'image' &&
						headerMediaError === null &&
						headerMediaUrl.trim() && (
							// eslint-disable-next-line @next/next/no-img-element
							<img
								src={headerMediaUrl.trim()}
								alt="Vista previa del encabezado"
								className="mt-3 max-h-40 rounded-lg border border-border object-contain"
							/>
						)}
					{headerMediaError && (
						<p className="mt-1.5 text-xs text-amber-300">
							{headerMediaError === 'missing'
								? 'Se requiere una URL para enviar esta plantilla.'
								: 'Ingresa una URL http(s) válida.'}
						</p>
					)}
				</div>
			)}

			{/* Lista de variables a personalizar */}
			{placeholders.length === 0 && !mediaHeaderType ? (
				<div className="rounded-xl border border-border bg-card/50 p-6 text-center">
					<p className="text-sm text-muted-foreground">
						Esta plantilla no tiene variables ni archivos que personalizar. Puedes continuar directamente.
					</p>
				</div>
			) : placeholders.length === 0 ? null : (
				<div className="space-y-4">
					{placeholders.map((placeholder) => {
						const key = placeholder.replace(/^\{\{|\}\}$/g, '');
						const mapping = variables[key];
						const currentSelected = getSelectedDropdownValue(mapping);
						const isStatic = mapping?.type === 'static';

						return (
							<div
								key={placeholder}
								className="rounded-xl border border-border bg-card/50 p-4 transition-all"
							>
								<div className="mb-2 flex items-center gap-2">
									<span className="inline-flex items-center rounded-md bg-primary/10 px-2.5 py-1 text-xs font-mono font-semibold text-primary">
										{placeholder}
									</span>
									<span className="text-xs text-muted-foreground">
										obtener valor de:
									</span>
								</div>

								<div className="space-y-2">
									<select
										value={currentSelected}
										onChange={(e) => handleDropdownChange(key, e.target.value)}
										className="w-full h-9 rounded-lg border border-border bg-muted/80 px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer transition-colors"
									>
										<optgroup label="Datos del contacto">
											<option value="field:name">Nombre del contacto</option>
											<option value="field:company">Empresa del contacto</option>
											<option value="field:phone">Teléfono del contacto</option>
											<option value="field:email">Correo electrónico del contacto</option>
										</optgroup>
										{customFields.length > 0 && (
											<optgroup label="Campos personalizados del contacto">
												{customFields.map((f) => (
													<option key={f.id} value={`custom_field:${f.id}`}>
														{f.field_name}
													</option>
												))}
											</optgroup>
										)}
										<optgroup label="Texto fijo">
											<option value="static">Texto personalizado (fijo para todos)</option>
										</optgroup>
									</select>

									{isStatic && (
										<div className="pt-1.5">
											<label className="mb-1 block text-xs font-medium text-muted-foreground">
												Texto que reemplazará a {placeholder} para todos los destinatarios:
											</label>
											<Input
												type="text"
												value={mapping?.value ?? ''}
												onChange={(e) => handleStaticValueChange(key, e.target.value)}
												placeholder="Ejemplo: Promoción Especial"
												className="border-border bg-muted text-foreground placeholder:text-muted-foreground text-sm"
											/>
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			)}

			{/* Vista previa en vivo con burbuja auténtica de WhatsApp */}
			<div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
				<div className="flex items-center justify-between border-b border-border/70 px-4 py-3 bg-muted/30">
					<div className="flex items-center gap-2.5">
						<div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
							<Eye className="h-4 w-4" />
						</div>
						<div>
							<div className="flex items-center gap-2">
								<p className="text-sm font-semibold text-foreground">Vista Previa</p>
								<span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
									WhatsApp
								</span>
							</div>
							<p className="text-xs text-muted-foreground">
								Destinatario de muestra: <span className="font-medium text-foreground">{previewLabel}</span>
							</p>
						</div>
					</div>
					{loadingPreview && (
						<Loader2 className="h-4 w-4 animate-spin text-primary" />
					)}
				</div>

				{/* Lienzo estilo conversación de chat WhatsApp */}
				<div className="relative p-4 sm:p-6 bg-[#efeae2] dark:bg-[#0b141a] transition-colors">
					{/* Burbuja saliente con colores nativos de WhatsApp */}
					<div className="ml-auto max-w-[90%] sm:max-w-[78%] rounded-2xl rounded-tr-xs bg-[#d9fdd3] dark:bg-[#005c4b] p-3.5 shadow-sm text-[#111b21] dark:text-[#e9edef] transition-colors">
						{/* Encabezado multimedia si aplica */}
						{mediaHeaderType && (
							<div className="mb-2.5 overflow-hidden rounded-lg bg-black/5 dark:bg-black/20">
								{mediaHeaderType === 'image' && (
									headerMediaUrl && isValidHttpUrl(headerMediaUrl) ? (
										<img
											src={headerMediaUrl}
											alt="Encabezado"
											className="h-44 w-full object-cover rounded-lg"
										/>
									) : (
										<div className="flex h-32 w-full flex-col items-center justify-center gap-1.5 text-xs text-[#667781] dark:text-[#8696a0]">
											<ImageIcon className="h-6 w-6 opacity-70" />
											<span>Imagen de cabecera</span>
										</div>
									)
								)}
								{mediaHeaderType === 'video' && (
									<div className="flex h-28 w-full flex-col items-center justify-center gap-1.5 text-xs text-[#667781] dark:text-[#8696a0]">
										<Film className="h-6 w-6 opacity-70" />
										<span>Video de cabecera</span>
									</div>
								)}
								{mediaHeaderType === 'document' && (
									<div className="flex items-center gap-2 p-3 text-xs text-[#111b21] dark:text-[#e9edef]">
										<FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
										<span className="truncate font-medium">Documento adjunto</span>
									</div>
								)}
							</div>
						)}

						{/* Encabezado de texto si la plantilla tiene header_content */}
						{template.header_content && (
							<p className="mb-1.5 text-sm font-bold text-[#111b21] dark:text-[#e9edef]">
								{template.header_content}
							</p>
						)}

						{/* Cuerpo del mensaje con variables sustituidas */}
						<p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#111b21] dark:text-[#e9edef]">
							{previewText}
						</p>

						{/* Pie de página de la plantilla */}
						{template.footer_text && (
							<p className="mt-2 text-xs text-[#667781] dark:text-[#8696a0]">
								{template.footer_text}
							</p>
						)}

						{/* Hora y ticks de entrega */}
						<div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-[#667781] dark:text-[#8696a0]">
							<span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
							<CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
						</div>

						{/* Botones de plantilla si existen */}
						{template.buttons && template.buttons.length > 0 && (
							<div className="mt-2.5 -mx-3.5 -mb-3.5 divide-y divide-[#111b21]/10 border-t border-[#111b21]/10 dark:divide-white/10 dark:border-white/10">
								{template.buttons.map((btn, i) => (
									<div
										key={i}
										className="flex items-center justify-center gap-1.5 py-2 text-center text-xs font-semibold text-[#00a884] dark:text-[#25d366]"
									>
										{btn.type === 'URL' && <ExternalLink className="h-3.5 w-3.5" />}
										{btn.type === 'PHONE_NUMBER' && <Phone className="h-3.5 w-3.5" />}
										{btn.type === 'QUICK_REPLY' && <CornerDownLeft className="h-3.5 w-3.5" />}
										<span>{btn.text}</span>
									</div>
								))}
							</div>
						)}
					</div>
				</div>
			</div>

			{unmappedKeys.length > 0 && (
				<div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
					Por favor define un valor para las variables:{' '}
					<span className="font-mono font-semibold">
						{unmappedKeys.join(', ')}
					</span>
				</div>
			)}

			<div className="flex items-center justify-between border-t border-border pt-4">
				<Button
					variant="outline"
					onClick={onBack}
					className="border-border text-muted-foreground"
				>
					<ArrowLeft className="h-4 w-4" />
					{t('back')}
				</Button>
				<Button
					onClick={onNext}
					disabled={unmappedKeys.length > 0 || headerMediaError !== null}
					className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
				>
					{t('next')}
					<ArrowRight className="h-4 w-4" />
				</Button>
			</div>
		</div>
	);
}
