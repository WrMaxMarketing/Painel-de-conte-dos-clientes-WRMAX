"use client";

import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { salvarCorpo } from "@/app/actions";
import { notionToBlockNote, blockNoteToNotion } from "@/lib/notion-blocknote";

export type EditorApi = {
  save: () => Promise<boolean>;
  discard: () => void;
};

export function BodyEditor({
  pageId,
  blocks,
  onDirtyChange,
  onReady,
}: {
  pageId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks: any[];
  onDirtyChange?: (dirty: boolean) => void;
  onReady?: (api: EditorApi) => void;
}) {
  const { resolvedTheme } = useTheme();
  const initial = useMemo(() => notionToBlockNote(blocks), [blocks]);
  const editor = useCreateBlockNote({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialContent: (initial.length ? initial : undefined) as any,
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const baseline = useRef<string | null>(null);

  const setDirtyBoth = useCallback(
    (d: boolean) => {
      setDirty(d);
      onDirtyChange?.(d);
    },
    [onDirtyChange]
  );

  // Captura o estado inicial como referencia para detectar alteracoes.
  // O `dirty` local ja nasce false; aqui so notificamos o pai (sem setState).
  useEffect(() => {
    baseline.current = JSON.stringify(editor.document);
    onDirtyChange?.(false);
  }, [editor, onDirtyChange]);

  const recomputeDirty = useCallback(() => {
    setDirtyBoth(JSON.stringify(editor.document) !== baseline.current);
  }, [editor, setDirtyBoth]);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const children = blockNoteToNotion(editor.document);
      await salvarCorpo(pageId, children);
      baseline.current = JSON.stringify(editor.document);
      setDirtyBoth(false);
      toast.success("Conteúdo salvo no Notion.");
      return true;
    } catch {
      toast.error("Não foi possível salvar. Tente novamente.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [editor, pageId, setDirtyBoth]);

  const discard = useCallback(() => {
    editor.replaceBlocks(
      editor.document,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (initial.length ? initial : []) as any
    );
    baseline.current = JSON.stringify(editor.document);
    setDirtyBoth(false);
  }, [editor, initial, setDirtyBoth]);

  // Disponibiliza save/discard para o componente pai (botoes Aprovar/Reprovar).
  useEffect(() => {
    onReady?.({ save, discard });
  }, [onReady, save, discard]);

  return (
    <div>
      <div className="overflow-hidden rounded-md border bg-card py-2">
        <BlockNoteView
          editor={editor}
          theme={resolvedTheme === "dark" ? "dark" : "light"}
          onChange={recomputeDirty}
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {dirty ? "● Alterações não salvas." : "Edite o conteúdo e salve antes de aprovar."}
        </p>
        <div className="flex gap-2">
          {dirty && (
            <Button
              variant="ghost"
              onClick={discard}
              disabled={saving}
              className="text-muted-foreground"
            >
              Descartar
            </Button>
          )}
          <Button
            onClick={save}
            disabled={saving || !dirty}
            variant="outline"
          >
            {saving ? "Salvando…" : "Salvar alterações"}
          </Button>
        </div>
      </div>
    </div>
  );
}
