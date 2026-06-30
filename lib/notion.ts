import { Client } from "@notionhq/client";
import { BOARD_STATUSES } from "@/lib/board";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB = process.env.NOTION_DB_CONTEUDO!;

// Nomes exatos das propriedades no Notion.
// CONFIRMAR com `node --env-file=.env.local scripts/inspect-db.mjs`.
const PROP_STATUS = "Status";
const PROP_CLIENTE = "Cliente"; // tipo: select
const PROP_FORMATO = "Formato do conteúdo"; // tipo: status
const PROP_FILES = "Files & media"; // tipo: files (fotos/videos/anexos)
const PROP_FILES_EDITADO = "ARQUIVO EDITADO PRONTO"; // tipo: files — arte/edicao finalizada (etapa "Concluido Designer/Arte")
const PROP_AJUSTES = "🔁 Nº de Ajustes"; // tipo: number — contagem de alteracoes
const PROP_SOLICITACAO = "Solicitação de alteração"; // tipo: date — quando foi pedida (badge de 24h)

function getTitle(props: any): string {
  const titleProp = Object.values(props).find((p: any) => p.type === "title") as any;
  return titleProp?.title?.map((t: any) => t.plain_text).join("") ?? "(sem título)";
}

export type MediaKind = "image" | "video" | "other";

export type MediaFile = {
  name: string;
  url: string;
  kind: MediaKind;
};

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp", "heic"];
const VIDEO_EXT = ["mp4", "webm", "mov", "m4v", "ogv", "avi", "mkv"];

function kindFromName(name: string): MediaKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (IMAGE_EXT.includes(ext)) return "image";
  if (VIDEO_EXT.includes(ext)) return "video";
  return "other";
}

// Extrai os arquivos de uma propriedade do tipo "files". As URLs de arquivos
// hospedados no Notion expiram em ~1h — por isso a pagina e force-dynamic.
function getArquivos(props: any, propName: string = PROP_FILES): MediaFile[] {
  const prop = props?.[propName];
  if (prop?.type !== "files") return [];
  return (prop.files ?? [])
    .map((f: any) => {
      const url = f.type === "external" ? f.external?.url : f.file?.url;
      const name = f.name ?? "arquivo";
      return { name, url: url ?? "", kind: kindFromName(name) };
    })
    .filter((f: MediaFile) => f.url);
}

export type CardResumo = {
  id: string;
  titulo: string;
  formato: string | null;
  status: string | null;
  arquivos: MediaFile[];
  // Arte/edicao finalizada (propriedade "ARQUIVO EDITADO PRONTO"), exibida na
  // etapa "Concluido Designer/Arte" — onde costumam ficar os videos prontos.
  arquivosEditados: MediaFile[];
  // Nº de alteracoes solicitadas e quando a ultima foi pedida (ISO) — usados
  // pelo badge "Alteração solicitada" (vale 24h) no quadro.
  ajustes: number;
  solicitacaoEm: string | null;
};

function getAjustes(props: any): number {
  return props?.[PROP_AJUSTES]?.number ?? 0;
}

function getSolicitacaoEm(props: any): string | null {
  return props?.[PROP_SOLICITACAO]?.date?.start ?? null;
}

// Lista os valores do select "Cliente" (para o seletor no painel admin).
export async function getClientesOptions(): Promise<string[]> {
  const db: any = await notion.databases.retrieve({ database_id: DB });
  const prop = db.properties?.[PROP_CLIENTE];
  if (prop?.type !== "select") return [];
  return prop.select.options.map((o: any) => o.name as string);
}

// Lista os cards do kanban isolados por cliente (select): qualquer um dos
// status configurados em COLUNAS. `cliente` = valor da opcao do select.
export async function getCardsBoard(cliente: string): Promise<CardResumo[]> {
  const res = await notion.databases.query({
    database_id: DB,
    filter: {
      and: [
        { property: PROP_CLIENTE, select: { equals: cliente } },
        {
          or: BOARD_STATUSES.map((s) => ({
            property: PROP_STATUS,
            status: { equals: s },
          })),
        },
      ],
    },
    sorts: [{ timestamp: "created_time", direction: "ascending" }],
  });
  return res.results.map((page: any) => ({
    id: page.id,
    titulo: getTitle(page.properties),
    formato: page.properties[PROP_FORMATO]?.status?.name ?? null,
    status: page.properties[PROP_STATUS]?.status?.name ?? null,
    arquivos: getArquivos(page.properties),
    arquivosEditados: getArquivos(page.properties, PROP_FILES_EDITADO),
    ajustes: getAjustes(page.properties),
    solicitacaoEm: getSolicitacaoEm(page.properties),
  }));
}

export async function getCard(pageId: string): Promise<CardResumo> {
  const page: any = await notion.pages.retrieve({ page_id: pageId });
  return {
    id: page.id,
    titulo: getTitle(page.properties),
    formato: page.properties[PROP_FORMATO]?.status?.name ?? null,
    status: page.properties[PROP_STATUS]?.status?.name ?? null,
    arquivos: getArquivos(page.properties),
    arquivosEditados: getArquivos(page.properties, PROP_FILES_EDITADO),
    ajustes: getAjustes(page.properties),
    solicitacaoEm: getSolicitacaoEm(page.properties),
  };
}

// --- Edicao da propriedade "Files & media" ---
// O SDK 2.3.0 nao tem a File Upload API, entao usamos a REST crua para o upload.
// Para preservar os arquivos existentes, reenviamos os objetos como vem do GET
// (type "file") + os novos como "file_upload" — validado em scripts/test-files-upload.mjs.

const NOTION_VERSION = "2022-06-28";

export type CardWrite = {
  titulo: string;
  cliente: string | null;
  status: string | null;
  files: any[];
  ajustes: number;
};

// Le titulo/dono/etapa/arquivos atuais (estado fresco, para checagem e preservacao).
export async function getCardWrite(pageId: string): Promise<CardWrite> {
  const page: any = await notion.pages.retrieve({ page_id: pageId });
  return {
    titulo: getTitle(page.properties),
    cliente: page.properties?.[PROP_CLIENTE]?.select?.name ?? null,
    status: page.properties?.[PROP_STATUS]?.status?.name ?? null,
    files: page.properties?.[PROP_FILES]?.files ?? [],
    ajustes: getAjustes(page.properties),
  };
}

// Registra a solicitacao de alteracao do cliente: incrementa a contagem de
// ajustes, carimba a data (badge de 24h) e devolve o card 1 etapa, para
// "Conteúdo aprovado". `agora` = ISO da solicitacao.
export async function registrarSolicitacaoAlteracao(
  pageId: string,
  ajustesAtuais: number,
  agora: string
) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [PROP_STATUS]: { status: { name: "Conteúdo aprovado" } },
      [PROP_AJUSTES]: { number: ajustesAtuais + 1 },
      [PROP_SOLICITACAO]: { date: { start: agora } },
    },
  } as any);
}

// Sobrescreve a propriedade de arquivos com o array ja montado.
export async function setArquivos(pageId: string, files: any[]) {
  await notion.pages.update({
    page_id: pageId,
    properties: { [PROP_FILES]: { files } },
  } as any);
}

// Sobe os bytes para o Notion (upload de parte unica, ate 20 MB) e devolve o id.
export async function uploadParaNotion(
  bytes: ArrayBuffer,
  name: string,
  contentType: string
): Promise<string> {
  const auth = {
    Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
    "Notion-Version": NOTION_VERSION,
  };

  const create = await fetch("https://api.notion.com/v1/file_uploads", {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: "{}",
  });
  if (!create.ok) throw new Error("Falha ao iniciar o upload no Notion.");
  const { id, upload_url } = await create.json();

  const form = new FormData();
  form.append(
    "file",
    new Blob([bytes], { type: contentType || "application/octet-stream" }),
    name
  );
  const send = await fetch(upload_url, { method: "POST", headers: auth, body: form });
  if (!send.ok) throw new Error("Falha ao enviar o arquivo ao Notion.");

  return id as string;
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
