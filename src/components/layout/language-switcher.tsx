"use client";

import { Globe } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageSwitcher() {

  const switchLanguage = (locale: string) => {
    // Guardar la preferencia de idioma en una cookie persistente
    document.cookie = `NEXT_LOCALE=${locale}; path=/; max-age=31536000`;
    // Forzar recarga completa para que el servidor relea la cookie y
    // entregue el idioma correcto desde el layout raiz
    window.location.reload();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        aria-label="Switch Language"
      >
        <Globe className="size-[1.125rem]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 bg-popover border-border">
        <DropdownMenuItem
          onClick={() => switchLanguage("es")}
          className="cursor-pointer text-popover-foreground focus:bg-accent focus:text-accent-foreground"
        >
          Español
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => switchLanguage("en")}
          className="cursor-pointer text-popover-foreground focus:bg-accent focus:text-accent-foreground"
        >
          English
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
