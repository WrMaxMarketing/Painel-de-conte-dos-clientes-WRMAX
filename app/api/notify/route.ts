import { NextResponse } from "next/server";
import { getCardWrite } from "@/lib/notion";
import { enviarWhatsApp, numeroDoCliente } from "@/lib/whatsapp";
import { STATUS_NOTIFICAVEIS } from "@/lib/board";

// Webhook chamado por uma automação do Notion ("quando Status = X, enviar
// webhook"). Notifica o cliente por WhatsApp que ha conteudo para aprovar.
// Protegido por segredo (?secret= na URL ou header x-webhook-secret).
//
// Config por env:
//   NOTIFY_WEBHOOK_SECRET  segredo que o Notion envia
//   SITE_URL               link do painel (default abaixo)

const SITE_URL = process.env.SITE_URL ?? "https://painel.wrmaxmarketing.com.br/";

// Tenta achar o id da pagina em formatos comuns de payload de webhook.
function extrairPageId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, any>;
  return (
    b.pageId ??
    b.page_id ??
    b.id ??
    b.data?.id ??
    b.entity?.id ??
    b.page?.id ??
    b.data?.pageId ??
    null
  );
}

export async function POST(req: Request) {
  const secret = process.env.NOTIFY_WEBHOOK_SECRET;
  const url = new URL(req.url);
  const provided =
    url.searchParams.get("secret") ?? req.headers.get("x-webhook-secret");
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // corpo vazio/invalido — tentamos o pageId pela query string
  }
  // Aceita o id pela URL (?pageId=/?id=) ou pelo corpo do webhook.
  const pageId =
    url.searchParams.get("pageId") ??
    url.searchParams.get("id") ??
    extrairPageId(body);
  if (!pageId) {
    return NextResponse.json({ error: "pageId ausente." }, { status: 400 });
  }

  // Estado fresco do Notion (autoritativo): titulo, cliente e etapa atual.
  const card = await getCardWrite(pageId);
  if (!card.status || !STATUS_NOTIFICAVEIS.includes(card.status)) {
    return NextResponse.json({ ok: true, skipped: "etapa não notificável" });
  }
  if (!card.cliente) {
    return NextResponse.json({ ok: true, skipped: "card sem cliente" });
  }

  const numero = numeroDoCliente(card.cliente);
  if (!numero) {
    return NextResponse.json({
      ok: true,
      skipped: `sem número de WhatsApp para "${card.cliente}"`,
    });
  }

  const texto = [
    "Você tem novos conteúdos para aprovar:",
    `*${card.titulo}*`,
    "",
    `Acesse o painel: ${SITE_URL}`,
  ].join("\n");

  try {
    await enviarWhatsApp(texto, numero);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha no envio.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
