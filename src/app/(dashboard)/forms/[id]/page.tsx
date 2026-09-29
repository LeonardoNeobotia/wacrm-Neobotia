"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  Loader2,
  Save,
  Code,
  Copy,
  Plus,
  Trash2,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function FormEditorPage() {
  const router = useRouter()
  const params = useParams()
  const isNew = params.id === "new"
  const formId = isNew ? null : (params.id as string)

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [showEmbedCode, setShowEmbedCode] = useState(false)
  const [pipelines, setPipelines] = useState<any[]>([])
  
  const [formData, setFormData] = useState({
    name: "",
    title: "",
    description: "",
    theme_color: "#3b82f6",
    pipeline_id: "none",
    stage_id: "none",
    fields_config: {
      name: { enabled: true, required: true },
      email: { enabled: true, required: true },
      phone: { enabled: false, required: false },
      company: { enabled: false, required: false },
      custom: [] as { id: string, label: string, required: boolean }[]
    }
  })

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      
      // Load pipelines
      const { data: pipes } = await supabase.from("pipelines").select("*, pipeline_stages(*)")
      if (pipes) setPipelines(pipes)

      if (!isNew) {
        const { data, error } = await supabase
          .from("web_forms")
          .select("*")
          .eq("id", formId)
          .single()
          
        if (error || !data) {
          toast.error("Formulario no encontrado")
          router.push("/forms")
          return
        }
        
        setFormData({
          name: data.name,
          title: data.title,
          description: data.description || "",
          theme_color: data.theme_color,
          pipeline_id: data.pipeline_id || "none",
          stage_id: data.stage_id || "none",
          fields_config: {
            ...data.fields_config,
            custom: data.fields_config.custom || []
          },
        })
      }
      setLoading(false)
    }
    init()
  }, [isNew, formId, router])

  async function save() {
    if (!formData.name || !formData.title) {
      toast.error("El Nombre Interno y el Título Público son obligatorios")
      return
    }
    
    // Validate custom fields
    if (formData.fields_config.custom.some(cf => !cf.label.trim())) {
      toast.error("Todos los campos personalizados deben tener un nombre")
      return
    }

    setSaving(true)
    const supabase = createClient()
    const { data: userData } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from("profiles").select("account_id").eq("user_id", userData.user?.id).single()
    
    const payload = {
      account_id: profile?.account_id,
      name: formData.name,
      title: formData.title,
      description: formData.description,
      theme_color: formData.theme_color,
      pipeline_id: formData.pipeline_id === "none" ? null : formData.pipeline_id,
      stage_id: formData.stage_id === "none" ? null : formData.stage_id,
      fields_config: formData.fields_config
    }
    
    let result
    if (isNew) {
      result = await supabase.from("web_forms").insert(payload).select().single()
    } else {
      result = await supabase.from("web_forms").update(payload).eq("id", formId).select().single()
    }
    
    setSaving(false)
    
    if (result.error) {
      toast.error(result.error.message || "Error al guardar el formulario")
    } else {
      toast.success("Formulario guardado exitosamente")
      if (isNew && result.data) {
        router.replace(`/forms/${result.data.id}`)
      }
    }
  }

  function handleFieldToggle(field: string, prop: "enabled" | "required") {
    setFormData(prev => {
      const currentConfig = (prev.fields_config as any)[field]
      const updatedField = { ...currentConfig, [prop]: !currentConfig[prop] }
      
      // Si se activa 'required', también debe activarse 'enabled'
      if (prop === "required" && updatedField.required) {
        updatedField.enabled = true
      }
      // Si se desactiva 'enabled', también debe desactivarse 'required'
      if (prop === "enabled" && !updatedField.enabled) {
        updatedField.required = false
      }
      
      return { 
        ...prev, 
        fields_config: {
          ...prev.fields_config,
          [field]: updatedField
        } 
      }
    })
  }

  function addCustomField() {
    setFormData(prev => ({
      ...prev,
      fields_config: {
        ...prev.fields_config,
        custom: [
          ...prev.fields_config.custom,
          { id: `custom_${Date.now()}`, label: "", required: false }
        ]
      }
    }))
  }

  function updateCustomField(id: string, updates: Partial<{ label: string, required: boolean }>) {
    setFormData(prev => ({
      ...prev,
      fields_config: {
        ...prev.fields_config,
        custom: prev.fields_config.custom.map(cf => cf.id === id ? { ...cf, ...updates } : cf)
      }
    }))
  }

  function removeCustomField(id: string) {
    setFormData(prev => ({
      ...prev,
      fields_config: {
        ...prev.fields_config,
        custom: prev.fields_config.custom.filter(cf => cf.id !== id)
      }
    }))
  }

  const selectedPipeline = pipelines.find(p => p.id === formData.pipeline_id)

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  const embedCode = formId
    ? `<iframe src="${typeof window !== 'undefined' ? window.location.origin : process.env.NEXT_PUBLIC_APP_URL ?? ''}/f/${formId}" width="100%" height="600" frameborder="0" style="background: transparent; border: 1px solid #e5e7eb; border-radius: 8px;"></iframe>`
    : ""

  const fieldLabels: Record<string, string> = {
    name: "Nombre",
    email: "Email",
    phone: "Teléfono",
    company: "Empresa"
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/forms")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            {isNew ? "Crear Formulario Web" : "Editar Formulario Web"}
          </h1>
        </div>
        {!isNew && (
          <Button variant="outline" onClick={() => setShowEmbedCode(true)}>
            <Code className="mr-2 h-4 w-4" />
            Obtener Código Embed
          </Button>
        )}
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Guardar Formulario
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Left Column: Form Settings */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Ajustes Generales</h2>
            
            <div className="space-y-4">
              <div>
                <Label>Nombre Interno</Label>
                <Input 
                  placeholder="ej. Formulario de Contacto Web" 
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
                <p className="mt-1 text-xs text-muted-foreground">Solo visible para ti</p>
              </div>
              
              <div>
                <Label>Título Público</Label>
                <Input 
                  placeholder="ej. Contáctanos" 
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </div>

              <div>
                <Label>Descripción Pública</Label>
                <Textarea 
                  placeholder="Déjanos un mensaje..." 
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  rows={3}
                />
              </div>

              <div>
                <Label>Color de Tema</Label>
                <div className="flex gap-2">
                  <Input 
                    type="color" 
                    className="w-16 h-10 p-1"
                    value={formData.theme_color}
                    onChange={e => setFormData({...formData, theme_color: e.target.value})}
                  />
                  <Input 
                    type="text" 
                    value={formData.theme_color}
                    onChange={e => setFormData({...formData, theme_color: e.target.value})}
                    className="font-mono uppercase"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Integración CRM</h2>
            <p className="mb-4 text-sm text-muted-foreground">
              Cuando un visitante envía este formulario, se agrega automáticamente como un Contacto. Opcionalmente, puedes crear una Negociación (Deal).
            </p>

            <div className="space-y-4">
              <div>
                <Label>Crear Negociación en el Embudo (Pipeline)</Label>
                <select 
                  className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.pipeline_id}
                  onChange={e => {
                    const pid = e.target.value
                    setFormData({
                      ...formData, 
                      pipeline_id: pid,
                      stage_id: pid === "none" ? "none" : (pipelines.find(p => p.id === pid)?.pipeline_stages[0]?.id || "none")
                    })
                  }}
                >
                  <option value="none">No crear negociación</option>
                  {pipelines.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {formData.pipeline_id !== "none" && selectedPipeline && (
                <div>
                  <Label>Etapa Inicial</Label>
                  <select 
                    className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData.stage_id}
                    onChange={e => setFormData({...formData, stage_id: e.target.value})}
                  >
                    {selectedPipeline.pipeline_stages?.sort((a:any, b:any) => a.position - b.position).map((s:any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Fields & Preview */}
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <h2 className="mb-4 text-lg font-semibold">Campos Predeterminados</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Nota: Nombre y Email son obligatorios por defecto para asegurar la creación del contacto.
            </p>
            
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border pb-2 text-sm font-medium text-muted-foreground">
                <div>Campo</div>
                <div className="w-16 text-center">Activo</div>
                <div className="w-16 text-center">Requerido</div>
              </div>

              {['name', 'email', 'phone', 'company'].map(field => {
                const config = (formData.fields_config as any)[field]
                return (
                  <div key={field} className="grid grid-cols-[1fr_auto_auto] gap-4 items-center py-2">
                    <div className="capitalize">{fieldLabels[field]}</div>
                    <div className="w-16 flex justify-center">
                      <Switch 
                        checked={config.enabled} 
                        onCheckedChange={() => handleFieldToggle(field, "enabled")}
                        disabled={field === 'name' || field === 'email'} // name & email are always required
                      />
                    </div>
                    <div className="w-16 flex justify-center">
                      <Switch 
                        checked={config.required} 
                        onCheckedChange={() => handleFieldToggle(field, "required")}
                        disabled={field === 'name' || field === 'email' || !config.enabled} 
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Campos Personalizados</h2>
                <p className="text-xs text-muted-foreground">
                  Añade preguntas extra. Se guardarán como "Notas" en el perfil o en el negocio del contacto.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {formData.fields_config.custom.length > 0 && (
                <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-border pb-2 text-sm font-medium text-muted-foreground">
                  <div>Pregunta / Nombre del campo</div>
                  <div className="w-16 text-center">Requerido</div>
                  <div className="w-10"></div>
                </div>
              )}

              {formData.fields_config.custom.map(cf => (
                <div key={cf.id} className="grid grid-cols-[1fr_auto_auto] gap-4 items-center py-2">
                  <Input 
                    placeholder="ej. ¿A qué se dedica tu empresa?" 
                    value={cf.label}
                    onChange={e => updateCustomField(cf.id, { label: e.target.value })}
                  />
                  <div className="w-16 flex justify-center">
                    <Switch 
                      checked={cf.required} 
                      onCheckedChange={v => updateCustomField(cf.id, { required: v })}
                    />
                  </div>
                  <div className="w-10 flex justify-center">
                    <Button variant="ghost" size="icon" onClick={() => removeCustomField(cf.id)} className="h-8 w-8 text-muted-foreground hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}

              <Button variant="outline" size="sm" onClick={addCustomField} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Añadir Campo Personalizado
              </Button>
            </div>
          </div>

        </div>
      </div>

      <Dialog open={showEmbedCode} onOpenChange={setShowEmbedCode}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Incrustar Formulario</DialogTitle>
            <DialogDescription>
              Copia este código y pégalo en cualquier lugar del HTML de tu sitio web donde desees que aparezca el formulario.
            </DialogDescription>
          </DialogHeader>
          <div className="relative mt-4">
            <Textarea 
              className="font-mono text-xs min-h-[120px]" 
              readOnly 
              value={embedCode} 
            />
            <Button 
              size="sm" 
              className="absolute right-2 top-2"
              onClick={() => {
                navigator.clipboard.writeText(embedCode)
                toast.success("Código copiado al portapapeles")
              }}
            >
              <Copy className="mr-2 h-3 w-3" /> Copiar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
