import { Button } from "@/components/ui/button";
import { ApprovalBoard } from "@/components/approval-board";
import { getCardsParaAprovar, getBlocks } from "@/lib/notion";

// Sempre busca fresco do Notion (nao prerenderiza no build).
export const dynamic = "force-dynamic";

export default async function Home() {
  const cliente = process.env.NOTION_CLIENTE_FIXO ?? "";

  const resumos = await getCardsParaAprovar(cliente);
  const cards = await Promise.all(
    resumos.map(async (c) => ({ ...c, blocks: await getBlocks(c.id) }))
  );

  return (
    <main className="flex-1">
      {/* Header */}
      <header className="border-b border-gold-soft/60 bg-cream">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <div>
            <p className="font-heading text-2xl text-gold">WRMAX</p>
            <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
              Aprovação de Conteúdos
            </p>
          </div>
          <Button variant="ghost" className="text-muted-foreground">
            Sair
          </Button>
        </div>
      </header>

      {/* Saudação */}
      <section className="mx-auto max-w-5xl px-6 pt-12">
        <h1 className="font-heading text-4xl text-foreground sm:text-5xl">
          Olá, {cliente || "cliente"}
        </h1>
        <div className="mt-4 h-px w-24 bg-gradient-to-r from-gold to-transparent" />
        <p className="mt-4 text-muted-foreground">
          Revise os conteúdos abaixo e aprove ou reprove cada um.
        </p>
      </section>

      {/* Board */}
      <section className="mx-auto max-w-5xl px-6 py-10">
        <ApprovalBoard cards={cards} />
      </section>
    </main>
  );
}
