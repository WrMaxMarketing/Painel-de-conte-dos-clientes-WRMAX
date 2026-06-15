import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function Home() {
  return (
    <main className="flex-1">
      {/* Header */}
      <header className="border-b border-gold-soft/60 bg-cream">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
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

      {/* Content */}
      <section className="mx-auto max-w-4xl px-6 py-14">
        <div className="mb-10 text-center">
          <h1 className="font-heading text-4xl text-foreground sm:text-5xl">
            Seus conteúdos para aprovação
          </h1>
          <div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-gold to-transparent" />
          <p className="mt-4 font-sans text-muted-foreground">
            Pré-visualização do design system — Milestone 1
          </p>
        </div>

        {/* Sample card */}
        <Card className="border-gold-soft/60 shadow-sm">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-gold text-primary-foreground hover:bg-gold">
                Reels
              </Badge>
              <Badge
                variant="outline"
                className="border-gold-soft text-muted-foreground"
              >
                Conteúdo para aprovação
              </Badge>
            </div>
            <CardTitle className="font-heading text-2xl font-medium text-foreground">
              Exemplo de roteiro — lançamento da coleção
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              Este é um cartão de demonstração. No app real, aqui aparecem o
              briefing e o roteiro vindos do corpo da página do Notion, em modo
              somente leitura.
            </p>
            <a
              href="#"
              className="inline-block text-gold underline-offset-4 hover:underline"
            >
              Ver inspiração ↗
            </a>
          </CardContent>
          <Separator className="bg-gold-soft/50" />
          <CardFooter className="justify-end gap-3 pt-4">
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-destructive"
            >
              Reprovar
            </Button>
            <Button
              variant="outline"
              className="border-gold text-gold hover:bg-gold hover:text-primary-foreground"
            >
              Aprovar
            </Button>
          </CardFooter>
        </Card>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Cormorant Garamond nos títulos · Jost no corpo · ouro{" "}
          <span className="text-gold">#AB884E</span>
        </p>
      </section>
    </main>
  );
}
