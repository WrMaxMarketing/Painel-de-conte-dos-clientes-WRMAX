// Configuracao das colunas do kanban. Modulo "puro" (sem deps de servidor)
// para poder ser importado tanto no servidor (notion.ts/page) quanto no
// componente client (approval-board).
//
// `status` = valor EXATO da opcao no Notion (atencao: "Concluido" sem acento).
// `label`  = texto exibido na coluna (pode ter acento).
// `modo`   = o que o cliente pode fazer nessa etapa:
//   - "aprovar"      => edita o conteudo + Aprovar (=> "Conteúdo aprovado") / Reprovar
//   - "aprovar-arte" => so visualiza + Aprovar (=> "Para agendar")
//   - "leitura"      => so visualiza, sem acoes

export type ColunaModo = "aprovar" | "aprovar-arte" | "leitura";

export type Coluna = {
  status: string;
  label: string;
  modo: ColunaModo;
};

export const COLUNAS: Coluna[] = [
  {
    status: "Conteúdo para aprovação",
    label: "Conteúdo para aprovação",
    modo: "aprovar",
  },
  {
    status: "Conteúdo aprovado",
    label: "Conteúdo aprovado",
    modo: "leitura",
  },
  {
    status: "Concluido Designer/Arte",
    label: "Concluído Designer/Arte",
    modo: "aprovar-arte",
  },
  {
    status: "Para agendar",
    label: "Para agendar",
    modo: "leitura",
  },
];

export const BOARD_STATUSES = COLUNAS.map((c) => c.status);

// Unica etapa em que o cliente pode editar (corpo e midias).
export const STATUS_EDITAVEL =
  COLUNAS.find((c) => c.modo === "aprovar")?.status ?? "";

export function modoDoStatus(status: string | null | undefined): ColunaModo {
  return COLUNAS.find((c) => c.status === status)?.modo ?? "leitura";
}
