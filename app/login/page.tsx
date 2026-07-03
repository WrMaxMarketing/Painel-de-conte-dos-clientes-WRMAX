import { LoginForm } from "@/components/login-form";
import { ModeToggle } from "@/components/mode-toggle";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh flex-1 items-center justify-center px-4">
      <div className="absolute right-3 top-3">
        <ModeToggle />
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            WRMAX MARKETING & IA
          </p>
          <CardTitle className="text-xl">Aprovação de Conteúdos</CardTitle>
          <CardDescription>Entre com seu email e senha.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
