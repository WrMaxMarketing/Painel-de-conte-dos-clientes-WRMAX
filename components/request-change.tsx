"use client";

import { useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { solicitarAlteracao } from "@/app/actions";

// Campo de "solicitar alteração" exibido na etapa "Concluído Designer/Arte".
// Ao enviar, notifica a equipe por WhatsApp (Evolution API).
export function RequestChange({ pageId }: { pageId: string }) {
  const [texto, setTexto] = useState("");
  const [enviando, startTransition] = useTransition();

  function enviar() {
    const msg = texto.trim();
    if (!msg) {
      toast.error("Descreva a alteração desejada.");
      return;
    }
    startTransition(async () => {
      try {
        await solicitarAlteracao(pageId, msg);
        toast.success("Solicitação enviada à equipe.");
        setTexto("");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Não foi possível enviar."
        );
      }
    });
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
      <div>
        <p className="text-sm font-semibold">Solicitar alteração</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Descreva o ajuste desejado (ex.: “trocar o texto X” ou “substituir a
          imagem Y”). A equipe será notificada.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-400">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>
          Atenção: são aceitas apenas <strong>2 alterações</strong>. Alterações
          adicionais serão cobradas como taxa extra.
        </span>
      </div>

      <Textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        disabled={enviando}
        placeholder="Descreva aqui a alteração que deseja…"
      />

      <Button onClick={enviar} disabled={enviando} className="w-full">
        {enviando ? "Enviando…" : "Enviar solicitação"}
      </Button>
    </div>
  );
}
