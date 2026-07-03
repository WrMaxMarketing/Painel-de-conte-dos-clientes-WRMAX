import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { AdminLogin } from "@/components/admin-login";
import { CreateAccessForm } from "@/components/create-access-form";
import { isAdmin } from "@/lib/admin";
import { adminLogout } from "@/app/admin/actions";
import { getClientesOptions } from "@/lib/notion";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const admin = await isAdmin();

  if (!admin) {
    return (
      <main className="relative flex min-h-dvh flex-1 items-center justify-center px-4">
        <div className="absolute right-3 top-3">
          <ModeToggle />
        </div>
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              WRMAX MARKETING & IA · Admin
            </p>
            <CardTitle className="text-xl">Painel do administrador</CardTitle>
            <CardDescription>Acesso restrito.</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminLogin />
          </CardContent>
        </Card>
      </main>
    );
  }

  const clientes = await getClientesOptions();

  return (
    <main className="flex-1">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <p className="text-base font-semibold tracking-tight sm:text-lg">
              WRMAX MARKETING & IA · Admin
            </p>
            <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground sm:text-xs">
              Gerenciar acessos
            </p>
          </div>
          <div className="flex items-center gap-1">
            <ModeToggle />
            <form action={adminLogout}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
              >
                Sair
              </Button>
            </form>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-md px-4 py-8 sm:px-6 sm:py-12">
        <Card>
          <CardHeader>
            <CardTitle>Criar novo acesso do cliente</CardTitle>
            <CardDescription>
              Defina email e senha, e selecione a qual cliente do Notion este
              login terá acesso.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateAccessForm clientes={clientes} />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
