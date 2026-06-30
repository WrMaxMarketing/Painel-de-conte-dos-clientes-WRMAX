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

// Qual propriedade de arquivos do Notion alimenta a galeria de midias da etapa:
//   "cru"     => "Files & media" (arquivos crus)
//   "editado" => "ARQUIVO EDITADO PRONTO" (arte/edicao finalizada, incl. videos)
export type ColunaMidia = "cru" | "editado";

export type Coluna = {
  status: string;
  label: string;
  modo: ColunaModo;
  midia: ColunaMidia;
};

export const COLUNAS: Coluna[] = [
  {
    status: "Conteúdo para aprovação",
    label: "Conteúdo para aprovar",
    modo: "aprovar",
    midia: "cru",
  },
  {
    status: "Conteúdo aprovado",
    label: "Conteúdo aprovado pelo cliente",
    modo: "leitura",
    midia: "cru",
  },
  {
    status: "Concluido Designer/Arte",
    label: "Edição/arte finalizada",
    modo: "aprovar-arte",
    midia: "editado",
  },
  {
    status: "Para agendar",
    label: "Para publicar",
    modo: "leitura",
    midia: "editado",
  },
];

export const BOARD_STATUSES = COLUNAS.map((c) => c.status);

// Unica etapa em que o cliente pode editar (corpo e midias).
export const STATUS_EDITAVEL =
  COLUNAS.find((c) => c.modo === "aprovar")?.status ?? "";

// Etapas que disparam notificacao ao cliente (as que exigem acao dele):
// "Conteúdo para aprovação" e "Concluido Designer/Arte".
export const STATUS_NOTIFICAVEIS = COLUNAS.filter(
  (c) => c.modo !== "leitura"
).map((c) => c.status);

export function modoDoStatus(status: string | null | undefined): ColunaModo {
  return COLUNAS.find((c) => c.status === status)?.modo ?? "leitura";
}

// Qual fonte de midia a etapa usa (default "cru" para status fora do board).
export function midiaDoStatus(status: string | null | undefined): ColunaMidia {
  return COLUNAS.find((c) => c.status === status)?.midia ?? "cru";
}
