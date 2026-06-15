"use server";
import { Client } from "@notionhq/client";
import { revalidatePath } from "next/cache";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export async function aprovarCard(pageId: string) {
  await notion.pages.update({
    page_id: pageId,
    properties: { Status: { status: { name: "Conteúdo aprovado" } } },
  });
  revalidatePath("/dashboard");
}

export async function reprovarCard(pageId: string) {
  const page: any = await notion.pages.retrieve({ page_id: pageId });
  const entry = Object.entries(page.properties).find(([, p]: any) => p.type === "title");
  if (!entry) return;
  const [tituloProp, prop]: any = entry;
  const atual = prop.title?.map((t: any) => t.plain_text).join("") ?? "";
  if (atual.startsWith("[REPROVADO]")) return; // guarda contra duplicar
  await notion.pages.update({
    page_id: pageId,
    properties: {
      [tituloProp]: { title: [{ text: { content: `[REPROVADO] ${atual}` } }] },
    },
  });
  revalidatePath("/dashboard");
}