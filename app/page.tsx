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
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <p className="text-base font-semibold tracking-tight sm:text-lg">
              WRMAX
            </p>
            <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground sm:text-xs">
              Aprovação de Conteúdos
            </p>
          </div>
          <div className="flex items-center gap-1">
            <ModeToggle />
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
            >
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Saudação */}
      <section className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">
          Olá, {cliente || "cliente"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:mt-3 sm:text-base">
          Revise os conteúdos abaixo e aprove ou reprove cada um.
        </p>
      </section>

      {/* Board */}
      <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <ApprovalBoard cards={cards} />
      </section>
    </main>
  );
}
