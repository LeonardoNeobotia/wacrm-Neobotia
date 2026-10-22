"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { Contact, Deal, ContactNote, Tag } from "@/types";
import {
	Phone,
	Mail,
	Copy,
	Check,
	User,
	Tag as TagIcon,
	DollarSign,
	StickyNote,
	Plus,
	X,
	Search,
	Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { addContactTag, deleteContactTag } from "@/lib/contacts/tag-api";
import { toast } from "sonner";
import { format } from "date-fns";
import { useTranslations } from "next-intl";
import { CreateDealDialog } from "@/components/inbox/create-deal-dialog";
import { formatCurrency } from "@/lib/currency";

const PRESET_COLORS = [
	"#3b82f6",
	"#10b981",
	"#f59e0b",
	"#ef4444",
	"#8b5cf6",
	"#ec4899",
	"#06b6d4",
	"#f97316",
];

interface ContactSidebarProps {
	contact: Contact | null;
	conversationId?: string;
	onTagsChange?: (tags: Tag[]) => void;
}

export function ContactSidebar({
	contact,
	conversationId,
	onTagsChange,
}: ContactSidebarProps) {
	const tSidebar = useTranslations("Inbox.sidebar");
	const tThread = useTranslations("Inbox.messageThread");

	const { accountId } = useAuth();
	const contactId = contact?.id;
	const [copied, setCopied] = useState(false);
	const [deals, setDeals] = useState<Deal[]>([]);
	const [createDealOpen, setCreateDealOpen] = useState(false);
	const [notes, setNotes] = useState<ContactNote[]>([]);
	const [tags, setTags] = useState<(Tag & { contact_tag_id: string })[]>([]);
	const tagsRef = useRef(tags);
	tagsRef.current = tags;
	const [allTags, setAllTags] = useState<Tag[]>([]);
	const [tagSearch, setTagSearch] = useState("");
	const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0]);
	const [creatingTag, setCreatingTag] = useState(false);
	const [newNote, setNewNote] = useState("");
	const [addingNote, setAddingNote] = useState(false);

	const fetchContactData = useCallback(async () => {
		if (!contactId) return;

		const supabase = createClient();

		// Cargar tratos, notas, etiquetas del contacto y el catálogo completo de etiquetas
		const [dealsRes, notesRes, tagsRes, allTagsRes] = await Promise.all([
			supabase
				.from("deals")
				.select("*, stage:pipeline_stages(*)")
				.eq("contact_id", contactId)
				.order("created_at", { ascending: false }),
			supabase
				.from("contact_notes")
				.select("*")
				.eq("contact_id", contactId)
				.order("created_at", { ascending: false }),
			supabase
				.from("contact_tags")
				.select("id, tag_id, tags(*)")
				.eq("contact_id", contactId),
			supabase
				.from("tags")
				.select("*")
				.order("name", { ascending: true }),
		]);

		if (dealsRes.data) setDeals(dealsRes.data);
		if (notesRes.data) setNotes(notesRes.data);
		if (allTagsRes.data) setAllTags(allTagsRes.data);
		if (tagsRes.data) {
			const mapped = tagsRes.data
				.filter((ct: Record<string, unknown>) => ct.tags)
				.map((ct: Record<string, unknown>) => ({
					...(ct.tags as Tag),
					contact_tag_id: ct.id as string,
				}));
			setTags(mapped);
		}
	}, [contactId]);

	// Asignar o remover una etiqueta de forma optimista e inmediata
	const handleToggleTag = useCallback(
		async (tag: Tag) => {
			if (!contactId) return;
			const currentTags = tagsRef.current;
			const isAssigned = currentTags.some((t) => t.id === tag.id);

			if (isAssigned) {
				// Remover etiqueta inmediatamente (optimistic UI)
				const nextTags = currentTags.filter((t) => t.id !== tag.id);
				tagsRef.current = nextTags;
				setTags(nextTags);
				onTagsChange?.(nextTags);

				try {
					await deleteContactTag(contactId, tag.id);
				} catch (err) {
					console.error("Error al quitar etiqueta:", err);
					toast.error("Error al desasignar la etiqueta");
					// Revertir
					tagsRef.current = currentTags;
					setTags(currentTags);
					onTagsChange?.(currentTags);
				}
			} else {
				// Asignar etiqueta inmediatamente (optimistic UI)
				const tempAssigned = {
					...tag,
					contact_tag_id: `temp-${Date.now()}`,
				};
				const nextTags = [...currentTags, tempAssigned];
				tagsRef.current = nextTags;
				setTags(nextTags);
				onTagsChange?.(nextTags);

				try {
					await addContactTag(contactId, tag.id);
				} catch (err) {
					console.error("Error al asignar etiqueta:", err);
					toast.error("Error al asignar la etiqueta");
					// Revertir
					tagsRef.current = currentTags;
					setTags(currentTags);
					onTagsChange?.(currentTags);
				}
			}
		},
		[contactId, onTagsChange]
	);

	// Crear nueva etiqueta y asignarla de inmediato al contacto
	const handleCreateAndAssignTag = useCallback(
		async (name: string) => {
			if (!contactId || !name.trim()) return;
			if (!accountId) return;
			setCreatingTag(true);

			const supabase = createClient();
			const {
				data: { session },
			} = await supabase.auth.getSession();
			const user = session?.user;

			if (!user) {
				toast.error("Sesión no encontrada");
				setCreatingTag(false);
				return;
			}

			try {
				const trimmedName = name.trim();
				const { data: createdTag, error: createError } = await supabase
					.from("tags")
					.insert({
						user_id: user.id,
						account_id: accountId,
						name: trimmedName,
						color: newTagColor,
					})
					.select()
					.single();

				if (createError || !createdTag) {
					throw createError || new Error("No se pudo crear la etiqueta");
				}

				setAllTags((prev) => [...prev, createdTag].sort((a, b) => a.name.localeCompare(b.name)));
				setTagSearch("");

				await handleToggleTag(createdTag);
				toast.success(`Etiqueta "${trimmedName}" creada y asignada`);
			} catch (err: any) {
				console.error("Error al crear etiqueta:", err);
				toast.error(err?.message || "Error al crear etiqueta");
			} finally {
				setCreatingTag(false);
			}
		},
		[contactId, accountId, newTagColor, handleToggleTag]
	);

	const filteredAvailableTags = useMemo(() => {
		if (!tagSearch.trim()) return allTags;
		const query = tagSearch.toLowerCase().trim();
		return allTags.filter((t) => t.name.toLowerCase().includes(query));
	}, [allTags, tagSearch]);

  // Load on contact change. setContactData/setTags run inside async
  // Supabase callbacks, not synchronously in the effect body.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContactData();
  }, [fetchContactData]);

  const handleCopyPhone = useCallback(async () => {
    if (!contact?.phone) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Dep is the whole `contact` object (not `contact?.phone`) so the
    // React Compiler's inference agrees with the manual dep list —
    // fixes the `preserve-manual-memoization` lint error.
  }, [contact]);

  const handleAddNote = useCallback(async () => {
    if (!contact || !newNote.trim()) return;
    if (!accountId) return;
    setAddingNote(true);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    const { data, error } = await supabase
      .from("contact_notes")
      .insert({
        contact_id: contact.id,
        account_id: accountId,
        user_id: user?.id,
        note_text: newNote.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setNewNote("");
    }
    setAddingNote(false);
  }, [contact, newNote, accountId]);

  if (!contact) {
    return (
      <div className="flex h-full w-70 items-center justify-center border-l border-border bg-card">
        <p className="text-sm text-muted-foreground">{tThread("selectConversation")}</p>
      </div>
    );
  }

  const displayName = contact.name || contact.phone;
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <div className="flex h-full w-70 flex-col border-l border-border bg-card">
      <ScrollArea className="flex-1">
        <div className="p-4">
          {/* Contact Info */}
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-foreground">
              {contact.avatar_url ? (
                <img
                  src={contact.avatar_url}
                  alt={displayName}
                  className="h-16 w-16 rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <h3 className="mt-3 text-sm font-semibold text-foreground">
              {displayName}
            </h3>
            {contact.company && (
              <p className="text-xs text-muted-foreground">{contact.company}</p>
            )}
          </div>

          {/* Phone */}
          <div className="mt-4 space-y-2">
            <button
              onClick={handleCopyPhone}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="flex-1 text-left">{contact.phone}</span>
              {copied ? (
                <Check className="h-3 w-3 text-primary" />
              ) : (
                <Copy className="h-3 w-3 text-muted-foreground" />
              )}
            </button>

            {contact.email && (
              <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{contact.email}</span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

					{/* Tags */}
					<div>
						<div className="flex items-center justify-between px-1">
							<div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
								<TagIcon className="h-3 w-3" />
								{tSidebar("tags")}
							</div>
							<Popover>
								<PopoverTrigger
									render={
										<button
											type="button"
											className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
											title="Gestionar etiquetas"
										/>
									}
								>
									<Plus className="h-3.5 w-3.5" />
								</PopoverTrigger>
								<PopoverContent align="end" className="w-64 p-2 bg-popover border-border">
									<div className="space-y-2">
										<div className="relative">
											<Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
											<Input
												placeholder="Buscar o crear..."
												value={tagSearch}
												onChange={(e) => setTagSearch(e.target.value)}
												className="h-8 pl-7 text-xs bg-muted/50 border-border"
											/>
										</div>

										<div className="max-h-48 overflow-y-auto space-y-0.5">
											{filteredAvailableTags.length === 0 && !tagSearch.trim() && (
												<p className="px-2 py-3 text-center text-xs text-muted-foreground">
													No hay etiquetas creadas
												</p>
											)}

											{filteredAvailableTags.map((tag) => {
												const isAssigned = tags.some((t) => t.id === tag.id);
												return (
													<button
														key={tag.id}
														type="button"
														onClick={() => handleToggleTag(tag)}
														className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-foreground hover:bg-muted transition-colors text-left cursor-pointer"
													>
														<span
															className="h-2.5 w-2.5 rounded-full shrink-0"
															style={{ backgroundColor: tag.color }}
														/>
														<span className="flex-1 truncate">{tag.name}</span>
														{isAssigned && (
															<Check className="h-3.5 w-3.5 text-primary shrink-0" />
														)}
													</button>
												);
											})}
										</div>

										{/* Opcion para crear nueva etiqueta si no existe coincidencia exacta */}
										{tagSearch.trim() &&
											!allTags.some(
												(t) => t.name.toLowerCase() === tagSearch.trim().toLowerCase()
											) && (
												<div className="border-t border-border pt-2 space-y-2">
													<div className="flex items-center gap-1.5 px-1">
														<span className="text-[11px] text-muted-foreground">Color:</span>
														<div className="flex items-center gap-1">
															{PRESET_COLORS.map((c) => (
																<button
																	key={c}
																	type="button"
																	onClick={() => setNewTagColor(c)}
																	className={cn(
																		"h-4 w-4 rounded-full transition-transform cursor-pointer",
																		newTagColor === c && "ring-2 ring-primary ring-offset-1 scale-110"
																	)}
																	style={{ backgroundColor: c }}
																/>
															))}
														</div>
													</div>
													<Button
														size="sm"
														variant="secondary"
														className="w-full h-7 text-xs justify-start cursor-pointer"
														disabled={creatingTag}
														onClick={() => handleCreateAndAssignTag(tagSearch)}
													>
														{creatingTag ? (
															<Loader2 className="h-3 w-3 animate-spin mr-1.5" />
														) : (
															<Plus className="h-3 w-3 mr-1.5" />
														)}
														Crear "{tagSearch.trim()}"
													</Button>
												</div>
											)}
									</div>
								</PopoverContent>
							</Popover>
						</div>
						<div className="mt-2 flex flex-wrap gap-1">
							{tags.length === 0 ? (
								<p className="px-1 text-xs text-muted-foreground">{tSidebar("noTags")}</p>
							) : (
								tags.map((tag) => (
									<span
										key={tag.contact_tag_id || tag.id}
										className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
										style={{
											backgroundColor: `${tag.color}20`,
											color: tag.color,
										}}
									>
										{tag.name}
										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												handleToggleTag(tag);
											}}
											className="inline-flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/20 p-0.5 transition-colors cursor-pointer"
											title="Quitar etiqueta"
										>
											<X className="h-2.5 w-2.5" />
										</button>
									</span>
								))
							)}
						</div>
					</div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

					{/* Active Deals */}
					<div>
						<div className="flex items-center justify-between px-1">
							<div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
								<DollarSign className="h-3 w-3" />
								{tSidebar("deals")}
							</div>
							<Button
								variant="ghost"
								size="icon"
								className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-muted"
								onClick={() => setCreateDealOpen(true)}
								title="Crear negocio"
							>
								<Plus className="h-3.5 w-3.5" />
							</Button>
						</div>
						<div className="mt-2 space-y-2">
							{deals.length === 0 ? (
								<div className="rounded-lg border border-dashed border-border p-3 text-center">
									<p className="text-xs text-muted-foreground">{tSidebar("noDeals")}</p>
									<Button
										variant="outline"
										size="sm"
										className="mt-2 h-7 text-xs border-border bg-muted/50 hover:bg-muted"
										onClick={() => setCreateDealOpen(true)}
									>
										<Plus className="mr-1.5 h-3 w-3" />
										Crear negocio
									</Button>
								</div>
							) : (
								deals.map((deal) => (
									<div
										key={deal.id}
										className="rounded-lg bg-muted px-3 py-2"
									>
										<p className="text-sm font-medium text-foreground">
											{deal.title}
										</p>
										<div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
											<span>
												{formatCurrency(deal.value, deal.currency)}
											</span>
											{deal.stage && (
												<span
													className="rounded-full px-1.5 py-0.5 text-[10px]"
													style={{
														backgroundColor: `${deal.stage.color}20`,
														color: deal.stage.color,
													}}
												>
													{deal.stage.name}
												</span>
											)}
										</div>
									</div>
								))
							)}
						</div>
					</div>

          {/* Divider */}
          <div className="my-4 border-t border-border" />

          {/* Notes */}
          <div>
            <div className="flex items-center gap-2 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <StickyNote className="h-3 w-3" />
              {tSidebar("notes")}
            </div>
            <div className="mt-2">
              <div className="flex gap-2">
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder={tSidebar("addNotePlaceholder")}
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground placeholder-muted-foreground outline-none focus:border-primary/50"
                />
                <Button
                  size="sm"
                  className="h-auto bg-primary px-2 hover:bg-primary/90"
                  onClick={handleAddNote}
                  disabled={!newNote.trim() || addingNote}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="mt-2 space-y-2">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-lg bg-muted px-3 py-2"
                  >
                    <p className="whitespace-pre-wrap text-xs text-muted-foreground">
                      {note.note_text}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {format(new Date(note.created_at), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
				</div>
			</ScrollArea>

			{contact && (
				<CreateDealDialog
					open={createDealOpen}
					onOpenChange={setCreateDealOpen}
					contact={contact}
					conversationId={conversationId}
					onDealCreated={fetchContactData}
				/>
			)}
		</div>
	);
}
