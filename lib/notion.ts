import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB = process.env.NOTION_DB_CONTEUDO!;

// Etapa de aprovacao (valor da propriedade Status). Vem do env, com fallback.
const STATUS_APROVACAO =
  process.env.NOTION_STATUS_APROVACAO ?? "Conteúdo para aprovação";

// Nomes exatos das propriedades no Notion.
// CONFIRMAR com `node --env-file=.env.local scripts/inspect-db.mjs`.
const PROP_STATUS = "Status";
const PROP_CLIENTE = "Cliente"; // tipo: select
const PROP_FORMATO = "Formato do conteúdo"; // tipo: status

function getTitle(props: any): string {
  const titleProp = Object.values(props).find((p: any) => p.type === "title") as any;
  return titleProp?.title?.map((t: any) => t.plain_text).join("") ?? "(sem título)";
}

export type CardResumo = {
  id: string;
  titulo: string;
  formato: string | null;
  status: string | null;
};

// Lista os cards na etapa de aprovacao isolados por cliente (select).
// `cliente` = valor da opcao do select (fase clientPageId fixo).
export async function getCardsParaAprovar(cliente: string): Promise<CardResumo[]> {
  const res = await notion.databases.query({
    database_id: DB,
    filter: {
      and: [
        { property: PROP_STATUS, status: { equals: STATUS_APROVACAO } },
        { property: PROP_CLIENTE, select: { equals: cliente } },
      ],
    },
    sorts: [{ timestamp: "created_time", direction: "ascending" }],
  });
  return res.results.map((page: any) => ({
    id: page.id,
    titulo: getTitle(page.properties),
    formato: page.properties[PROP_FORMATO]?.status?.name ?? null,
    status: page.properties[PROP_STATUS]?.status?.name ?? null,
  }));
}

export async function getCard(pageId: string): Promise<CardResumo> {
  const page: any = await notion.pages.retrieve({ page_id: pageId });
  return {
    id: page.id,
    titulo: getTitle(page.properties),
    formato: page.properties[PROP_FORMATO]?.status?.name ?? null,
    status: page.properties[PROP_STATUS]?.status?.name ?? null,
  };
}

// BLOCK (corpo): separado da query, paginado por cursor. Render read-only.
export async function getBlocks(pageId: string) {
  const blocks: any[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res = await notion.blocks.children.list({
      block_id: pageId, start_cursor: cursor, page_size: 100,
    });
    blocks.push(...res.results);
    cursor = res.has_more ? (res.next_cursor as string) : undefined;
  } while (cursor);
  return blocks;
}
