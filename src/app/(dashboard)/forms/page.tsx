"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ClipboardList,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  ExternalLink,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { useCan } from "@/hooks/use-can"
import { Button } from "@/components/ui/button"
import { GatedButton } from "@/components/ui/gated-button"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function WebFormsPage() {
  const router = useRouter()
  const canCreate = useCan("send-messages") // using this as a proxy for admin
  const [forms, setForms] = useState<any[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<any | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function load() {
    try {
      const supabase = createClient()
      const { data, error: fetchErr } = await supabase
        .from("web_forms")
        .select("*")
        .order("created_at", { ascending: false })
      if (fetchErr) throw fetchErr
      setForms(data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load forms")
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function toggleActive(form: any, next: boolean) {
    setForms((prev) =>
      prev?.map((x) => (x.id === form.id ? { ...x, is_active: next } : x)) ?? prev,
    )
    const supabase = createClient()
    const { error } = await supabase
      .from("web_forms")
      .update({ is_active: next })
      .eq("id", form.id)
      
    if (error) {
      setForms((prev) =>
        prev?.map((x) => (x.id === form.id ? { ...x, is_active: !next } : x)) ?? prev,
      )
      toast.error("Error al actualizar el estado del formulario")
      return
    }
    toast.success(next ? "Formulario activado" : "Formulario pausado")
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("web_forms")
      .delete()
      .eq("id", pendingDelete.id)
      
    setDeleting(false)
    if (error) {
      toast.error("Error al eliminar el formulario")
      return
    }
    toast.success("Formulario eliminado")
    setPendingDelete(null)
    load()
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2">
        <p className="text-sm text-red-400">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reintentar
        </Button>
      </div>
    )
  }

  if (forms === null) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Formularios Web</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Crea formularios web incrustables para capturar leads desde cualquier lugar.
          </p>
        </div>
        <GatedButton
          canAct={canCreate}
          gateReason="create forms"
          onClick={() => router.push("/forms/new")}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Crear Formulario
        </GatedButton>
      </div>

      {forms.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/40">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <ClipboardList className="h-6 w-6 text-primary" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">Aún no hay formularios</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Crea tu primer formulario para empezar a capturar leads.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {forms.map((f) => (
            <FormCard
              key={f.id}
              form={f}
              onToggle={(next) => toggleActive(f, next)}
              onEdit={() => router.push(`/forms/${f.id}`)}
              onPreview={() => window.open(`/f/${f.id}`, "_blank")}
              onDelete={() => setPendingDelete(f)}
            />
          ))}
        </ul>
      )}

      <Dialog open={!!pendingDelete} onOpenChange={(v) => !v && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Formulario</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar el formulario "{pendingDelete?.name}"? Cualquier sitio web que use este código embed dejará de funcionar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPendingDelete(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FormCard({
  form,
  onToggle,
  onEdit,
  onPreview,
  onDelete,
}: {
  form: any
  onToggle: (next: boolean) => void
  onEdit: () => void
  onPreview: () => void
  onDelete: () => void
}) {
  return (
    <li className="rounded-xl border border-border bg-card transition-colors hover:border-border">
      <div className="flex items-center gap-4 p-4">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10"
          aria-hidden
        >
          <ClipboardList className="h-5 w-5 text-primary" />
        </div>

        <button
          type="button"
          onClick={onEdit}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">
              {form.name}
            </span>
            {form.is_active && (
              <span className="relative flex h-2 w-2" aria-label="active">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
            )}
          </div>
          {form.title && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{form.title}</p>
          )}
        </button>

        <div className="flex items-center gap-3">
          <Switch
            checked={form.is_active}
            onCheckedChange={(v) => onToggle(!!v)}
            aria-label={form.is_active ? "Desactivar" : "Activar"}
          />

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Abrir menú"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[popup-open]:bg-muted"
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4" />
                Editar / Código Embed
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onPreview}>
                <ExternalLink className="h-4 w-4" />
                Vista Previa
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  )
}
