import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { ApprovalBoard } from "@/components/approval-board";
import { getCardsBoard, getBlocks } from "@/lib/notion";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import { SESSION_MAX_AGE_MS, SESSION_START_COOKIE } from "@/lib/session";

// Sempre busca fresco do Notion (nao prerenderiza no build).
export const dynamic = "force-dynamic";

export default async function Home() {
  // Exige sessao (o middleware ja protege, mas garantimos aqui tambem).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Horario em que a sessao de 1h expira, derivado do cookie de inicio. O board
  // usa isso para avisar o cliente e deslogar no instante exato do fim da janela.
  const cookieStore = await cookies();
  const startedAtRaw = cookieStore.get(SESSION_START_COOKIE)?.value;
  const startedAt = startedAtRaw ? Number(startedAtRaw) : NaN;
  const sessionExpiresAt = Number.isFinite(startedAt)
    ? startedAt + SESSION_MAX_AGE_MS
    : null;

  // O cliente vem do app_metadata, definido pelo admin (o usuario nao altera).
  const cliente = (user.app_metadata?.cliente as string | undefined) ?? "";

  const resumos = cliente ? await getCardsBoard(cliente) : [];
  const cards = await Promise.all(
    resumos.map(async (c) => ({ ...c, blocks: await getBlocks(c.id) }))
  );

  return (
    <main className="flex-1">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-card/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <p className="text-base font-semibold tracking-tight sm:text-lg">
              WRMAX MARKETING & IA
            </p>
            <p className="text-[0.7rem] uppercase tracking-[0.2em] text-muted-foreground sm:text-xs">
              Aprovação de Conteúdos
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <form action={signOut}>
              <Button type="submit" variant="ghost">
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Saudação */}
      <section className="mx-auto max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-4xl">
          Olá, {cliente || "cliente"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:mt-3 sm:text-base">
          Acompanhe os conteúdos por etapa. Revise e aprove os que estão
          aguardando você.
        </p>
      </section>

      {/* Board */}
      <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        {cliente ? (
          <ApprovalBoard cards={cards} sessionExpiresAt={sessionExpiresAt} />
        ) : (
          <div className="rounded-lg border bg-muted/40 px-6 py-16 text-center">
            <p className="text-lg font-semibold">Conta sem cliente associado</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Sua conta ainda não está vinculada a um cliente. Contate o
              administrador para concluir a configuração.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
