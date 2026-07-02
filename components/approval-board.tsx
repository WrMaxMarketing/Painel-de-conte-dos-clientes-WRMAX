"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { ChevronLeft } from "lucide-react";
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
import { aprovarCard, aprovarArteCard, reprovarCard } from "@/app/actions";
import { ActionNotices } from "@/components/action-notices";
import { MediaGallery } from "@/components/media-gallery";
import { RequestChange } from "@/components/request-change";
import { VerAjustes } from "@/components/ver-ajustes";
import { SessionExpiryGuard } from "@/components/session-expiry-guard";
import { COLUNAS, midiaDoStatus, modoDoStatus, type ColunaModo } from "@/lib/board";
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

// O badge "Alteração solicitada" vale 24h a partir do pedido do cliente.
const VINTE_QUATRO_H = 24 * 60 * 60 * 1000;
function alteracaoRecente(iso: string | null): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && Date.now() - t < VINTE_QUATRO_H;
}

// Badge laranja (permanente) com o Nº de Ajustes: aparece em todas as etapas
// menos a primeira ("Conteúdo para aprovar", modo "aprovar"), quando ha ajustes.
function mostraAjustes(card: Card): boolean {
  return card.ajustes > 0 && modoDoStatus(card.status) !== "aprovar";
}

export function ApprovalBoard({
  cards,
  sessionExpiresAt = null,
}: {
  cards: Card[];
  // Timestamp (ms) em que a sessao de 1h expira; null se desconhecido.
  sessionExpiresAt?: number | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Estado de edicao do corpo (vindo do editor) e do alerta de bloqueio.
  // So importa na etapa editavel ("Conteúdo para aprovação").
  const [dirty, setDirty] = useState(false);
  const [gate, setGate] = useState<null | "aprovar" | "reprovar">(null);
  const editorApi = useRef<EditorApi | null>(null);
  // Espelho do `dirty` em ref: o timer de expiracao le o valor atual sem
  // depender do closure do render em que foi agendado.
  const dirtyRef = useRef(false);

  const selected = cards.find((c) => c.id === selectedId) ?? null;
  const modo: ColunaModo = selected
    ? modoDoStatus(selected.status)
    : "leitura";
  const editavel = modo === "aprovar";

  // Agrupa os cards por status, na ordem das colunas.
  const grupos = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const col of COLUNAS) map.set(col.status, []);
    for (const card of cards) {
      const lista = map.get(card.status ?? "");
      if (lista) lista.push(card);
    }
    return map;
  }, [cards]);

  const handleDirty = useCallback((d: boolean) => {
    dirtyRef.current = d;
    setDirty(d);
  }, []);
  const handleReady = useCallback((api: EditorApi) => {
    editorApi.current = api;
  }, []);

  // Ao expirar a sessao com a tela aberta, o popup pergunta ao cliente o que
  // fazer com uma edicao em aberto (salvar/descartar) antes do logout.
  const sessionHasPendingEdits = useCallback(
    () => !!editorApi.current && dirtyRef.current,
    []
  );
  const sessionSave = useCallback(
    async () => (await editorApi.current?.save()) ?? false,
    []
  );
  const sessionDiscard = useCallback(() => {
    editorApi.current?.discard();
  }, []);

  function selectCard(id: string) {
    setGate(null);
    setDirty(false);
    dirtyRef.current = false;
    setSelectedId(id);
  }

  function voltar() {
    setGate(null);
    setSelectedId(null);
  }

  function doAprovar(card: Card) {
    const acaoModo = modoDoStatus(card.status);
    startTransition(async () => {
      try {
        if (acaoModo === "aprovar-arte") {
          await aprovarArteCard(card.id);
        } else {
          await aprovarCard(card.id);
        }
        toast.success("Conteúdo aprovado.");
        voltar();
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
        voltar();
      } catch {
        toast.error("Não foi possível reprovar. Tente novamente.");
      }
    });
  }

  // Na etapa editavel, aprovar/reprovar so prosseguem sem alteracoes pendentes.
  function requestAprovar(card: Card) {
    if (editavel && dirty) return setGate("aprovar");
    doAprovar(card);
  }
  function requestReprovar(card: Card) {
    if (editavel && dirty) return setGate("reprovar");
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

  // Botoes de acao conforme o modo da etapa.
  const acoes = (card: Card) => {
    if (modo === "leitura") return null;
    const aprovarLabel = modo === "aprovar-arte" ? "Aprovo Publicação" : "Aprovar";
    return (
      <>
        <Button
          onClick={() => requestAprovar(card)}
          disabled={isPending}
          className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {isPending ? "Enviando…" : aprovarLabel}
        </Button>
        {modo === "aprovar" && (
          <Button
            onClick={() => requestReprovar(card)}
            disabled={isPending}
            variant="outline"
            className="text-muted-foreground hover:text-destructive"
          >
            Reprovar
          </Button>
        )}
      </>
    );
  };

  if (!cards.length) {
    return (
      <>
        <div className="rounded-lg border bg-muted/40 px-6 py-16 text-center">
          <p className="text-2xl font-semibold">Tudo em dia ✦</p>
          <p className="mt-2 text-muted-foreground">
            Nenhum conteúdo na sua esteira no momento.
          </p>
        </div>
        <SessionExpiryGuard
          expiresAt={sessionExpiresAt}
          hasPendingEdits={sessionHasPendingEdits}
          onSave={sessionSave}
          onDiscard={sessionDiscard}
        />
      </>
    );
  }

  // --- DETALHE (substitui o board ao selecionar um card) ---
  if (selected) {
    return (
      <>
      <div className="min-w-0">
        <button
          onClick={voltar}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Voltar para o quadro
        </button>

        {modo !== "leitura" && (
          <div className="mb-4">
            <ActionNotices modo={modo} />
          </div>
        )}

        <div className="lg:grid lg:grid-cols-[1fr_220px] lg:gap-6">
          {/* Conteúdo */}
          <article className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {selected.formato && <Badge>{selected.formato}</Badge>}
              {selected.status && (
                <Badge variant="outline" className="text-muted-foreground">
                  {selected.status}
                </Badge>
              )}
              {alteracaoRecente(selected.solicitacaoEm) && (
                <Badge
                  variant="outline"
                  className="border-amber-500/50 bg-amber-500/15 font-semibold text-amber-700 dark:text-amber-400"
                >
                  Alteração solicitada
                </Badge>
              )}
              {mostraAjustes(selected) && (
                <Badge
                  variant="outline"
                  className="border-orange-500/60 bg-orange-500/15 font-semibold text-orange-700 dark:text-orange-400"
                >
                  {selected.ajustes}{" "}
                  {selected.ajustes === 1 ? "ajuste" : "ajustes"}
                </Badge>
              )}
            </div>
            <h2 className="mt-3 text-xl font-semibold leading-tight tracking-tight sm:text-2xl">
              {selected.titulo}
            </h2>

            {/* Historico de ajustes: em qualquer etapa, quando houver pedidos. */}
            {selected.ajustes > 0 && (
              <div className="mt-4">
                <VerAjustes pageId={selected.id} ajustes={selected.ajustes} />
              </div>
            )}

            {(() => {
              // A fonte da galeria depende da etapa (lib/board.ts):
              //   "cru"     => "Files & media" (Conteúdo para aprovar/aprovado)
              //   "editado" => "ARQUIVO EDITADO PRONTO" (Edição finalizada/Para publicar)
              const midias =
                midiaDoStatus(selected.status) === "editado"
                  ? selected.arquivosEditados
                  : selected.arquivos;
              if (midias.length === 0 && !editavel) return null;
              return (
                <div className="mt-4">
                  <p className="mb-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    Mídias
                  </p>
                  <MediaGallery
                    arquivos={midias}
                    editable={editavel}
                    pageId={selected.id}
                  />
                </div>
              );
            })()}

            <Separator className="my-4 sm:my-5" />
            <BodyEditor
              key={selected.id}
              pageId={selected.id}
              blocks={selected.blocks}
              readOnly={!editavel}
              onDirtyChange={editavel ? handleDirty : undefined}
              onReady={editavel ? handleReady : undefined}
            />

            {modo === "aprovar-arte" && (
              <div className="mt-6">
                <RequestChange
                  pageId={selected.id}
                  ajustes={selected.ajustes}
                  onDone={voltar}
                />
              </div>
            )}
          </article>

          {/* Ações — painel lateral (desktop) */}
          {modo !== "leitura" && (
            <aside className="mt-6 lg:mt-0 lg:sticky lg:top-20 lg:block lg:self-start">
              <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Sua decisão
                </p>
                <div className="flex flex-col gap-3 [&>button]:w-full">
                  {acoes(selected)}
                </div>
                {editavel && dirty && (
                  <p className="text-xs text-muted-foreground">
                    Você tem alterações não salvas no conteúdo.
                  </p>
                )}
              </div>
            </aside>
          )}
        </div>

        {/* Alerta: bloqueia aprovar/reprovar com alteracoes pendentes */}
        <AlertDialog
          open={gate !== null}
          onOpenChange={(o) => !o && setGate(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Alterações não salvas</AlertDialogTitle>
              <AlertDialogDescription>
                Você editou o conteúdo e ainda não salvou. Salve as alterações
                ou descarte-as antes de{" "}
                {gate === "reprovar" ? "reprovar" : "aprovar"}.
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
        <SessionExpiryGuard
          expiresAt={sessionExpiresAt}
          hasPendingEdits={sessionHasPendingEdits}
          onSave={sessionSave}
          onDiscard={sessionDiscard}
        />
      </>
    );
  }

  // --- QUADRO (kanban) ---
  // Desktop: 4 colunas em grid (todas visiveis, sem scroll horizontal).
  // Mobile: colunas empilhadas; os cards de cada etapa rolam na horizontal.
  return (
    <>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {COLUNAS.map((col) => {
        const lista = grupos.get(col.status) ?? [];
        return (
          <div key={col.status} className="flex flex-col">
            <div className="mb-2 flex min-h-[2.75rem] items-start justify-between gap-2 px-1">
              <p className="text-xs font-semibold uppercase leading-tight tracking-[0.12em] text-muted-foreground">
                {col.label}
              </p>
              <Badge variant="secondary" className="shrink-0 text-xs">
                {lista.length}
              </Badge>
            </div>
            <div className="flex flex-1 gap-2 overflow-x-auto rounded-lg border bg-muted/30 p-2 md:flex-col md:overflow-visible">
              {lista.length === 0 ? (
                <p className="w-full px-1 py-6 text-center text-xs text-muted-foreground">
                  Nenhum conteúdo
                </p>
              ) : (
                lista.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => selectCard(card.id)}
                    className="w-[220px] shrink-0 rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent md:w-full md:shrink"
                  >
                    <div className="mb-1.5 flex flex-wrap gap-1.5">
                      {alteracaoRecente(card.solicitacaoEm) && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/50 bg-amber-500/15 text-xs font-semibold text-amber-700 dark:text-amber-400"
                        >
                          Alteração solicitada
                        </Badge>
                      )}
                      {card.formato && (
                        <Badge variant="secondary" className="text-xs">
                          {card.formato}
                        </Badge>
                      )}
                      {mostraAjustes(card) && (
                        <Badge
                          variant="outline"
                          className="border-orange-500/60 bg-orange-500/15 text-xs font-semibold text-orange-700 dark:text-orange-400"
                        >
                          {card.ajustes}{" "}
                          {card.ajustes === 1 ? "ajuste" : "ajustes"}
                        </Badge>
                      )}
                    </div>
                    <p className="line-clamp-3 text-sm font-medium leading-snug">
                      {card.titulo}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
      <SessionExpiryGuard
        expiresAt={sessionExpiresAt}
        hasPendingEdits={sessionHasPendingEdits}
        onSave={sessionSave}
        onDiscard={sessionDiscard}
      />
    </>
  );
}
