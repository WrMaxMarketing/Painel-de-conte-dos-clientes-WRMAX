"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import type { ColunaModo } from "@/lib/board";

// Hora atual (0-23) no fuso de Sao Paulo, independente do fuso do servidor.
function horaSaoPaulo(): number {
  const txt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  return Number(txt);
}

// Avisos exibidos nas etapas em que o cliente toma alguma acao (editar/aprovar).
// Sao apenas informativos — nao bloqueiam nem enfileiram nada.
export function ActionNotices({ modo }: { modo: ColunaModo }) {
  // Comeca falso (igual no SSR) e so atualiza apos montar, evitando mismatch.
  const [foraHorario, setForaHorario] = useState(false);

  useEffect(() => {
    const checar = () => {
      const h = horaSaoPaulo();
      // Horario util: 08h–17h. Fora dele (>=17h ou <8h) => aviso.
      setForaHorario(h >= 17 || h < 8);
    };
    checar();
    const id = setInterval(checar, 60_000);
    return () => clearInterval(id);
  }, []);

  if (modo === "leitura") return null;

  const box =
    "flex items-start gap-2 rounded-md border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-600 dark:text-red-400";

  return (
    <div className="space-y-2">
      {modo === "aprovar" && (
        <div className={box}>
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Atenção: são aceitas apenas <strong>2 alterações</strong>.
            Alterações adicionais serão cobradas como taxa extra.
          </span>
        </div>
      )}
      {foraHorario && (
        <div className={box}>
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            Fora do horário útil (17h–08h): alterações, aprovações ou
            solicitações feitas agora só serão aplicadas no próximo horário útil
            (08h–17h).
          </span>
        </div>
      )}
    </div>
  );
}
