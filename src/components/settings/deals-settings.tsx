"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Coins, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CURRENCIES } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { useTranslations } from "next-intl";
import { SettingsPanelHead } from "./settings-panel-head";

/**
 * Deals settings — account-wide default currency.
 *
 * One currency per account (issue #218): the chosen code seeds new
 * deals and formats every aggregated total. Existing deals keep their
 * own saved currency. Writes go straight to `accounts.default_currency`;
 * the `accounts_update` RLS policy (017) already restricts that to
 * admins+, so non-admins see a disabled, read-only control.
 */
export function DealsSettings() {
  const supabase = createClient();
  const {
    accountId,
    defaultCurrency,
    canEditSettings,
    profileLoading,
    refreshProfile,
  } = useAuth();

  const [selected, setSelected] = useState(defaultCurrency);
  const [convertExisting, setConvertExisting] = useState(true);
  const [saving, setSaving] = useState(false);
  const t = useTranslations("Settings.deals");

  // Keep the select in sync once the profile (and its account default)
  // resolves, and after a save round-trips through refreshProfile.
  useEffect(() => {
    setSelected(defaultCurrency);
  }, [defaultCurrency]);

  const dirty = selected !== defaultCurrency;

  async function handleSave() {
    if (!accountId || !dirty) return;
    setSaving(true);
    
    let rate = 1;
    let convertedCount = 0;
    
    // Si se activó la conversión, consultamos la API de tipo de cambio
    if (convertExisting) {
      try {
        const res = await fetch(`https://open.er-api.com/v6/latest/${defaultCurrency}`);
        const data = await res.json();
        if (data.rates && data.rates[selected]) {
          rate = data.rates[selected];
        }
      } catch (err) {
        console.error("Failed to fetch exchange rates:", err);
        toast.error(t("conversionApiFailed"));
        setSaving(false);
        return;
      }
    }

    const { error } = await supabase
      .from("accounts")
      .update({ default_currency: selected })
      .eq("id", accountId);
      
    if (error) {
      toast.error(t("saveFailed"));
      setSaving(false);
      return;
    }

    // Convertir deals existentes si hay una tasa válida diferente a 1
    if (convertExisting && rate !== 1) {
      const { data: deals } = await supabase
        .from("deals")
        .select("id, value")
        .eq("account_id", accountId);

      if (deals && deals.length > 0) {
        // Enviar actualizaciones en lotes pequeños
        const chunkSize = 20;
        for (let i = 0; i < deals.length; i += chunkSize) {
          const chunk = deals.slice(i, i + chunkSize);
          await Promise.all(
            chunk.map(async (d) => {
              const newValue = Math.round((d.value || 0) * rate);
              await supabase.from("deals").update({ value: newValue, currency: selected }).eq("id", d.id);
            })
          );
        }
        convertedCount = deals.length;
      }
    }

    // Pull the new value back into the auth context so the deal form
    // and every total pick it up without a full reload.
    await refreshProfile();
    setSaving(false);
    if (convertedCount > 0) {
      toast.success(t("saveAndConverted", { count: convertedCount }));
    } else {
      toast.success(t("saveSuccess"));
    }
  }

  return (
    <section className="max-w-2xl animate-in fade-in-50 duration-200">
      <SettingsPanelHead
        title={t("title")}
        description={t("description")}
      />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Coins className="size-4 text-primary" />
            {t("defaultCurrency")}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {t("defaultCurrencyDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:max-w-xs">
            <Label className="text-muted-foreground">{t("currencyLabel")}</Label>
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              disabled={!canEditSettings || profileLoading}
              className="h-9 w-full rounded-lg border border-border bg-muted px-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.label}
                </option>
              ))}
            </select>
            {!canEditSettings && (
              <p className="text-xs text-muted-foreground">
                {t("adminOnlyHint")}
              </p>
            )}
          </div>

          {canEditSettings && dirty && (
            <div className="flex items-center space-x-2 pt-2 pb-2">
              <Checkbox
                id="convert-existing"
                checked={convertExisting}
                onCheckedChange={(val) => setConvertExisting(val === true)}
              />
              <Label htmlFor="convert-existing" className="font-normal leading-snug cursor-pointer">
                {t("convertExistingLabel")}
              </Label>
            </div>
          )}

          {canEditSettings && (
            <Button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {t("saving")}
                </>
              ) : (
                t("save")
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
