"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import dynamic from "next/dynamic";
import { BellRing, ChevronDown, ChevronLeft, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
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

// Cor da tag de formato do conteudo. Cada tipo tem sua cor, com tons ajustados
// para bom contraste no modo claro e escuro:
// estatico = azul claro, reels = rosa, carrossel = amarelo.
function formatoBadgeClass(formato: string): string {
  const chave = formato
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
  if (chave.includes("estatico"))
    return "border-sky-500/50 bg-sky-500/15 text-sky-700 dark:text-sky-300";
  if (chave.includes("reel"))
    return "border-pink-500/50 bg-pink-500/15 text-pink-700 dark:text-pink-300";
  if (chave.includes("carrossel") || chave.includes("carousel"))
    return "border-yellow-500/60 bg-yellow-500/20 text-yellow-800 dark:text-yellow-300";
  // Formato desconhecido: cinza neutro, ainda legivel nos dois temas.
  return "border-border bg-muted text-muted-foreground";
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
  // Etapa "Concluído Designer/Arte": abre o formulário de edição (texto + mídias)
  // pelo botão do topo. Fica fechado por padrão.
  const [editando, setEditando] = useState(false);
  // Mobile: cada etapa é um dropdown (accordion) — guarda o status da etapa
  // aberta; abrir outra fecha a anterior. No desktop as colunas ignoram isto.
  const [colunaAberta, setColunaAberta] = useState<string | null>(null);

  function toggleColuna(status: string) {
    setColunaAberta((cur) => (cur === status ? null : status));
  }

  // Estado de edicao do corpo (vindo do editor) e do alerta de bloqueio.
  // So importa na etapa editavel ("Conteúdo para aprovação").
  const [dirty, setDirty] = useState(false);
  const [gate, setGate] = useState<null | "aprovar" | "reprovar">(null);
  const editorApi = useRef<EditorApi | null>(null);
  // Espelho do `dirty` em ref: o timer de expiracao le o valor atual sem
  // depender do closure do render em que foi agendado.
  const dirtyRef = useRef(false);
  // Marca que abrimos um card empurrando uma entrada no historico do navegador.
  // Permite que a seta de voltar e o gesto de deslizar (mobile) fechem o card,
  // e que o botao "Voltar" consuma essa entrada de forma consistente.
  const pushedRef = useRef(false);

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

  // Pendencias por etapa em que o cliente precisa agir (aprovar conteudo/arte).
  const pendencias = useMemo(
    () =>
      COLUNAS.filter((c) => c.modo !== "leitura").map((c) => ({
        label: c.label,
        count: (grupos.get(c.status) ?? []).length,
      })),
    [grupos]
  );
  const totalPendencias = pendencias.reduce((s, p) => s + p.count, 0);

  // Aviso de boas-vindas: aparece uma vez ao entrar no site quando ha conteudos
  // aguardando a aprovacao do cliente. Estado inicial derivado na montagem — nao
  // reabre a cada render.
  const [welcomeOpen, setWelcomeOpen] = useState(() => totalPendencias > 0);

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
    setEditando(false);
    setSelectedId(id);
    // Cria uma entrada no historico para que voltar pelo navegador ou pelo
    // gesto (deslizar da esquerda no mobile) retorne ao quadro. Mantemos a
    // mesma URL — o card e um estado da tela, nao uma rota compartilhavel.
    pushedRef.current = true;
    window.history.pushState({ cardOpen: true }, "");
  }

  function voltar() {
    setGate(null);
    // Se abrimos empurrando uma entrada, voltamos consumindo-a (o listener de
    // popstate limpa a selecao). Senao, apenas fecha o card.
    if (pushedRef.current) {
      window.history.back();
    } else {
      setSelectedId(null);
    }
  }

  // Fecha o card quando o usuario volta pelo navegador (seta ou gesto de
  // deslizar no mobile), mantendo a UI em sincronia com o historico.
  useEffect(() => {
    function onPop() {
      pushedRef.current = false;
      setGate(null);
      setEditando(false);
      setSelectedId(null);
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

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
          size="lg"
          className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500"
        >
          {isPending ? "Enviando…" : aprovarLabel}
        </Button>
        {modo === "aprovar" && (
          <Button
            onClick={() => requestReprovar(card)}
            disabled={isPending}
            variant="outline"
            size="lg"
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
          className="-mx-2 mb-3 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Voltar para o quadro
        </button>

        {modo !== "leitura" && (
          <div className="mb-4">
            <ActionNotices modo={modo} />
          </div>
        )}

        <div
          className={`lg:grid lg:grid-cols-[1fr_220px] lg:gap-6 ${
            modo !== "leitura" ? "pb-28 lg:pb-0" : ""
          }`}
        >
          {/* Conteúdo */}
          <article className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {selected.formato && (
                <Badge
                  variant="outline"
                  className={`font-semibold ${formatoBadgeClass(selected.formato)}`}
                >
                  {selected.formato}
                </Badge>
              )}
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

            {/* Etapa "Concluído Designer/Arte": edição pelo topo. O botão abre o
                formulário (texto + mídias); antes ficava fixo no rodapé. */}
            {modo === "aprovar-arte" && (
              <div className="mt-4">
                {editando ? (
                  <RequestChange
                    pageId={selected.id}
                    ajustes={selected.ajustes}
                    onDone={() => {
                      setEditando(false);
                      voltar();
                    }}
                    onCancel={() => setEditando(false)}
                  />
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditando(true)}
                  >
                    <PencilLine className="mr-1.5 size-4" />
                    Editar / Solicitar alteração
                  </Button>
                )}
              </div>
            )}

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
            {/* Etapa "Conteúdo para aprovar": deixa claro que o corpo é editável.
                A edição é inline no próprio editor; o popup de salvar (gate) é
                acionado ao aprovar/reprovar com alterações pendentes. */}
            {editavel && (
              <div className="mb-3 flex items-start gap-2 rounded-md border border-dashed border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                <PencilLine className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  Você pode editar este conteúdo: clique no texto para alterar.
                  Lembre-se de salvar as alterações antes de aprovar.
                </span>
              </div>
            )}
            <BodyEditor
              key={selected.id}
              pageId={selected.id}
              blocks={selected.blocks}
              readOnly={!editavel}
              onDirtyChange={editavel ? handleDirty : undefined}
              onReady={editavel ? handleReady : undefined}
            />
          </article>

          {/* Ações. Desktop: painel lateral sticky. Mobile: barra fixa no rodapé
              para a decisão ficar sempre à mão, sem rolar todo o conteúdo. */}
          {modo !== "leitura" && (
            <>
              <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
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

              <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-card/80 lg:hidden">
                {editavel && dirty && (
                  <p className="mb-2 text-center text-xs text-muted-foreground">
                    Você tem alterações não salvas no conteúdo.
                  </p>
                )}
                <div className="mx-auto flex max-w-5xl gap-3 [&>button]:flex-1">
                  {acoes(selected)}
                </div>
              </div>
            </>
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
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
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
  // Mobile: cada etapa e um dropdown (accordion) — toca no cabecalho para ver os
  // cards empilhados na vertical; abrir uma etapa fecha a anterior.
  return (
    <>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
      {COLUNAS.map((col) => {
        const lista = grupos.get(col.status) ?? [];
        // Etapas de aprovacao com conteudos pendentes ganham uma borda com brilho
        // ambar no card da coluna, para chamar a atencao do cliente.
        const destaque = col.modo !== "leitura" && lista.length > 0;
        const aberta = colunaAberta === col.status;
        return (
          <div key={col.status} className="flex flex-col">
            {/* Cabecalho: botao de dropdown no mobile; so rotulo no desktop. */}
            <button
              type="button"
              onClick={() => toggleColuna(col.status)}
              aria-expanded={aberta}
              className="mb-2 flex min-h-[2.75rem] w-full items-start justify-between gap-2 px-1 text-left md:pointer-events-none md:cursor-default"
            >
              <p className="text-xs font-semibold uppercase leading-tight tracking-[0.12em] text-muted-foreground">
                {col.label}
              </p>
              <span className="flex shrink-0 items-center gap-1.5">
                <Badge
                  variant={destaque ? "outline" : "secondary"}
                  className={
                    destaque
                      ? "border-amber-500/50 bg-amber-500/15 text-xs font-semibold text-amber-700 dark:text-amber-400"
                      : "text-xs"
                  }
                >
                  {lista.length}
                </Badge>
                <ChevronDown
                  className={`size-4 text-muted-foreground transition-transform md:hidden ${
                    aberta ? "rotate-180" : ""
                  }`}
                />
              </span>
            </button>
            <div
              className={`flex-1 flex-col gap-2 rounded-lg border bg-muted/30 p-2 md:flex ${
                aberta ? "flex" : "hidden"
              } ${
                destaque
                  ? "border-amber-400/70 shadow-[0_0_14px_-2px_rgba(251,191,36,0.6)] dark:border-amber-300/60 dark:shadow-[0_0_16px_-1px_rgba(252,211,77,0.5)]"
                  : ""
              }`}
            >
              {lista.length === 0 ? (
                <p className="w-full px-1 py-6 text-center text-xs text-muted-foreground">
                  Nenhum conteúdo
                </p>
              ) : (
                lista.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => selectCard(card.id)}
                    className="w-full rounded-lg border bg-card px-3 py-2.5 text-left transition-colors hover:bg-accent"
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
                        <Badge
                          variant="outline"
                          className={`text-xs font-semibold ${formatoBadgeClass(card.formato)}`}
                        >
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

      {/* Aviso ao entrar: destaca os conteudos aguardando aprovacao. */}
      <AlertDialog open={welcomeOpen} onOpenChange={setWelcomeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <BellRing />
            </AlertDialogMedia>
            <AlertDialogTitle>Conteúdos aguardando você</AlertDialogTitle>
            <AlertDialogDescription>
              {totalPendencias === 1
                ? "Há 1 conteúdo aguardando a sua aprovação:"
                : `Há ${totalPendencias} conteúdos aguardando a sua aprovação:`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="space-y-2">
            {pendencias
              .filter((p) => p.count > 0)
              .map((p) => (
                <li
                  key={p.label}
                  className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-3 py-2"
                >
                  <span className="text-sm font-medium">{p.label}</span>
                  <Badge
                    variant="outline"
                    className="shrink-0 border-amber-500/50 bg-amber-500/15 font-semibold text-amber-700 dark:text-amber-400"
                  >
                    {p.count} {p.count === 1 ? "conteúdo" : "conteúdos"}
                  </Badge>
                </li>
              ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogAction>Ver conteúdos</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SessionExpiryGuard
        expiresAt={sessionExpiresAt}
        hasPendingEdits={sessionHasPendingEdits}
        onSave={sessionSave}
        onDiscard={sessionDiscard}
      />
    </>
  );
}
