"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { NotionBlocks } from "@/components/notion-blocks";
import { aprovarCard, reprovarCard } from "@/app/actions";
import type { CardResumo } from "@/lib/notion";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Card = CardResumo & { blocks: any[] };

export function ApprovalBoard({ cards }: { cards: Card[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(
    cards[0]?.id ?? null
  );
  const [isPending, startTransition] = useTransition();

  const selected = cards.find((c) => c.id === selectedId) ?? null;

  function handleAprovar(card: Card) {
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

  function handleReprovar(card: Card) {
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

  if (!cards.length) {
    return (
      <div className="rounded-lg border border-gold-soft/60 bg-cream/40 px-6 py-16 text-center">
        <p className="font-heading text-2xl text-foreground">
          Tudo em dia ✦
        </p>
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
              onClick={() => setSelectedId(card.id)}
              className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                active
                  ? "border-gold bg-cream"
                  : "border-gold-soft/50 bg-white hover:bg-cream/60"
              }`}
            >
              {card.formato && (
                <Badge className="mb-1.5 bg-gold text-primary-foreground hover:bg-gold">
                  {card.formato}
                </Badge>
              )}
              <p className="font-heading text-lg leading-snug text-foreground">
                {card.titulo}
              </p>
            </button>
          );
        })}
      </aside>

      {/* Detalhe */}
      <section>
        {!selected ? (
          <div className="flex h-full min-h-48 items-center justify-center rounded-lg border border-dashed border-gold-soft/60 text-muted-foreground">
            Selecione um conteúdo à esquerda.
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
            {/* Conteúdo */}
            <article>
              <div className="flex flex-wrap items-center gap-2">
                {selected.formato && (
                  <Badge className="bg-gold text-primary-foreground hover:bg-gold">
                    {selected.formato}
                  </Badge>
                )}
                {selected.status && (
                  <Badge
                    variant="outline"
                    className="border-gold-soft text-muted-foreground"
                  >
                    {selected.status}
                  </Badge>
                )}
              </div>
              <h2 className="mt-3 font-heading text-3xl leading-tight text-foreground">
                {selected.titulo}
              </h2>
              <Separator className="my-5 bg-gold-soft/50" />
              <NotionBlocks blocks={selected.blocks} />
            </article>

            {/* Ações (ao lado) */}
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <div className="space-y-3 rounded-lg border border-gold-soft/60 bg-cream/40 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Sua decisão
                </p>
                <Button
                  onClick={() => handleAprovar(selected)}
                  disabled={isPending}
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {isPending ? "Enviando…" : "Aprovar"}
                </Button>
                <Button
                  onClick={() => handleReprovar(selected)}
                  disabled={isPending}
                  variant="outline"
                  className="w-full border-gold-soft text-muted-foreground hover:bg-white hover:text-destructive"
                >
                  Reprovar
                </Button>
              </div>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
}
