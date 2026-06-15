"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { aprovarCard, reprovarCard } from "@/app/actions";
import type { EditorApi } from "@/components/body-editor";
import type { CardResumo } from "@/lib/notion";

// Editor e client-only (BlockNote acessa o DOM) — sem SSR.
const BodyEditor = dynamic(
  () => import("@/components/body-editor").then((m) => m.BodyEditor),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-muted-foreground">Carregando editor…</p>
    ),
  }
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Card = CardResumo & { blocks: any[] };

export function ApprovalBoard({ cards }: { cards: Card[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(
    cards[0]?.id ?? null
  );
  const [isPending, startTransition] = useTransition();

  // Estado de edicao do corpo (vindo do editor) e do alerta de bloqueio.
  const [dirty, setDirty] = useState(false);
  const [gate, setGate] = useState<null | "aprovar" | "reprovar">(null);
  const editorApi = useRef<EditorApi | null>(null);

  const selected = cards.find((c) => c.id === selectedId) ?? null;

  const handleDirty = useCallback((d: boolean) => setDirty(d), []);
  const handleReady = useCallback((api: EditorApi) => {
    editorApi.current = api;
  }, []);

  function doAprovar(card: Card) {
    startTransition(async () => {
      try {
        await aprovarCard(card.id);
        toast.success("Conteúdo aprovado.");
        setSelectedId(null);
      } catch {
        toast.error("Não foi possível aprovar. Tente novamente.");
      }
    });
  }

  function doReprovar(card: Card) {
    startTransition(async () => {
      try {
        await reprovarCard(card.id);
        toast("Conteúdo reprovado.", {
          description: "Marcamos o título com [REPROVADO].",
        });
        setSelectedId(null);
      } catch {
        toast.error("Não foi possível reprovar. Tente novamente.");
      }
    });
  }

  // Aprovar/Reprovar so prosseguem se nao houver alteracoes pendentes.
  function requestAprovar(card: Card) {
    if (dirty) return setGate("aprovar");
    doAprovar(card);
  }
  function requestReprovar(card: Card) {
    if (dirty) return setGate("reprovar");
    doReprovar(card);
  }

  function runGate(card: Card) {
    const action = gate;
    setGate(null);
    if (action === "aprovar") doAprovar(card);
    else if (action === "reprovar") doReprovar(card);
  }

  async function gateSalvar() {
    if (!selected) return;
    const ok = await editorApi.current?.save();
    if (ok) runGate(selected);
  }

  function gateDescartar() {
    if (!selected) return;
    editorApi.current?.discard();
    runGate(selected);
  }

  if (!cards.length) {
    return (
      <div className="rounded-lg border bg-muted/40 px-6 py-16 text-center">
        <p className="text-2xl font-semibold">Tudo em dia ✦</p>
        <p className="mt-2 text-muted-foreground">
          Nenhum conteúdo aguardando sua aprovação no momento.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 md:grid-cols-[300px_1fr]">
      {/* Lista de cards */}
      <aside className="space-y-2">
        <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {cards.length} para aprovar
        </p>
        {cards.map((card) => {
          const active = card.id === selectedId;
          return (
            <button
              key={card.id}
              onClick={() => {
                setGate(null);
                setSelectedId(card.id);
              }}
              className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                active
                  ? "border-primary bg-accent"
                  : "bg-card hover:bg-accent"
              }`}
            >
              {card.formato && (
                <Badge className="mb-1.5">{card.formato}</Badge>
              )}
              <p className="text-base font-medium leading-snug">
                {card.titulo}
              </p>
            </button>
          );
        })}
      </aside>

      {/* Detalhe */}
      <section>
        {!selected ? (
          <div className="flex h-full min-h-48 items-center justify-center rounded-lg border border-dashed text-muted-foreground">
            Selecione um conteúdo à esquerda.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
            {/* Conteúdo */}
            <article>
              <div className="flex flex-wrap items-center gap-2">
                {selected.formato && <Badge>{selected.formato}</Badge>}
                {selected.status && (
                  <Badge variant="outline" className="text-muted-foreground">
                    {selected.status}
                  </Badge>
                )}
              </div>
              <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight">
                {selected.titulo}
              </h2>
              <Separator className="my-5" />
              <BodyEditor
                key={selected.id}
                pageId={selected.id}
                blocks={selected.blocks}
                onDirtyChange={handleDirty}
                onReady={handleReady}
              />
            </article>

            {/* Ações (ao lado) */}
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Sua decisão
                </p>
                <Button
                  onClick={() => requestAprovar(selected)}
                  disabled={isPending}
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
                >
                  {isPending ? "Enviando…" : "Aprovar"}
                </Button>
                <Button
                  onClick={() => requestReprovar(selected)}
                  disabled={isPending}
                  variant="outline"
                  className="w-full text-muted-foreground hover:text-destructive"
                >
                  Reprovar
                </Button>
                {dirty && (
                  <p className="text-xs text-muted-foreground">
                    Você tem alterações não salvas no conteúdo.
                  </p>
                )}
              </div>
            </aside>
          </div>
        )}
      </section>

      {/* Alerta: bloqueia aprovar/reprovar com alteracoes pendentes */}
      <AlertDialog open={gate !== null} onOpenChange={(o) => !o && setGate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
            <AlertDialogDescription>
              Você editou o conteúdo e ainda não salvou. Salve as alterações ou
              descarte-as antes de {gate === "reprovar" ? "reprovar" : "aprovar"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="ghost"
              onClick={() => setGate(null)}
              className="text-muted-foreground"
            >
              Cancelar
            </Button>
            <Button
              variant="ghost"
              onClick={gateDescartar}
              className="text-muted-foreground hover:text-destructive"
            >
              Descartar
            </Button>
            <Button onClick={gateSalvar}>Salvar e continuar</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
