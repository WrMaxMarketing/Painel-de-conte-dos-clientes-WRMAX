"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useState } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { salvarCorpo } from "@/app/actions";
import { notionToBlockNote, blockNoteToNotion } from "@/lib/notion-blocknote";

export function BodyEditor({
  pageId,
  blocks,
}: {
  pageId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks: any[];
}) {
  const initial = notionToBlockNote(blocks);
  const editor = useCreateBlockNote({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialContent: (initial.length ? initial : undefined) as any,
  });
  const [saving, setSaving] = useState(false);

  async function salvar() {
    setSaving(true);
    try {
      const children = blockNoteToNotion(editor.document);
      await salvarCorpo(pageId, children);
      toast.success("Conteúdo salvo no Notion.");
    } catch {
      toast.error("Não foi possível salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="overflow-hidden rounded-md border border-gold-soft/60 bg-white py-2">
        <BlockNoteView editor={editor} theme="light" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Edite o conteúdo acima e salve antes de aprovar.
        </p>
        <Button
          onClick={salvar}
          disabled={saving}
          variant="outline"
          className="border-gold text-gold hover:bg-gold hover:text-primary-foreground"
        >
          {saving ? "Salvando…" : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}
