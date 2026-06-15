import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
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
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-lg font-semibold tracking-tight">WRMAX</p>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Aprovação de Conteúdos
            </p>
          </div>
          <div className="flex items-center gap-1">
            <ModeToggle />
            <Button variant="ghost" className="text-muted-foreground">
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Saudação */}
      <section className="mx-auto max-w-5xl px-6 pt-12">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Olá, {cliente || "cliente"}
        </h1>
        <p className="mt-3 text-muted-foreground">
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
