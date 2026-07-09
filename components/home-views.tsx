"use client";

import { useCallback, useState } from "react";
import { LayoutGrid, CalendarDays } from "lucide-react";
import { ApprovalBoard, type Card } from "@/components/approval-board";
import { CalendarView } from "@/components/calendar-view";
import type { CardCalendario } from "@/lib/notion";

// Alterna as duas vistas da home: o QUADRO (principal, padrão) e o CALENDÁRIO.
// O quadro segue como está; o calendário é uma leitura complementar de todos os
// conteúdos do cliente. Abrir um card pela prévia do calendário volta ao quadro
// já com o card aberto (só para etapas visíveis ao cliente).

type View = "quadro" | "calendario";

function tabClass(active: boolean): string {
  return [
    "-mb-px inline-flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-sm transition-colors",
    active
      ? "border-brand font-semibold text-foreground"
      : "border-transparent font-medium text-muted-foreground hover:text-foreground",
  ].join(" ");
}

export function HomeViews({
  boardCards,
  calendarCards,
  sessionExpiresAt = null,
  initialView = "quadro",
}: {
  boardCards: Card[];
  calendarCards: CardCalendario[];
  sessionExpiresAt?: number | null;
  initialView?: View;
}) {
  const [view, setView] = useState<View>(initialView);
  // Pedido de abrir um card no quadro, vindo da prévia do calendário.
  const [requestOpenId, setRequestOpenId] = useState<string | null>(null);

  const trocar = useCallback((v: View) => {
    setView(v);
    // Reflete na URL sem criar entrada no histórico (não conflita com o
    // pushState que o quadro usa para abrir/fechar card).
    const url = new URL(window.location.href);
    if (v === "quadro") url.searchParams.delete("view");
    else url.searchParams.set("view", v);
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const abrirCardNoQuadro = useCallback(
    (id: string) => {
      setRequestOpenId(id);
      trocar("quadro");
    },
    [trocar]
  );

  return (
    <div>
      <div role="tablist" className="mb-6 flex gap-1 border-b">
        <button
          role="tab"
          type="button"
          aria-selected={view === "quadro"}
          onClick={() => trocar("quadro")}
          className={tabClass(view === "quadro")}
        >
          <LayoutGrid className="size-4" />
          Quadro
        </button>
        <button
          role="tab"
          type="button"
          aria-selected={view === "calendario"}
          onClick={() => trocar("calendario")}
          className={tabClass(view === "calendario")}
        >
          <CalendarDays className="size-4" />
          Calendário
        </button>
      </div>

      {/* O quadro fica sempre montado (togglado por `hidden`) para preservar
          estado (card aberto, edições) ao alternar de vista. */}
      <div className={view === "quadro" ? "" : "hidden"}>
        <ApprovalBoard
          cards={boardCards}
          sessionExpiresAt={sessionExpiresAt}
          requestOpenId={requestOpenId}
          onOpenHandled={() => setRequestOpenId(null)}
        />
      </div>
      {view === "calendario" && (
        <CalendarView cards={calendarCards} onOpenCard={abrirCardNoQuadro} />
      )}
    </div>
  );
}
