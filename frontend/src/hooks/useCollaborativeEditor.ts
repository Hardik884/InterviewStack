/**
 * useCollaborativeEditor.ts — Production-grade collaborative editor hook.
 *
 * Key fixes over original:
 *   - Feedback-loop eliminated: isRemoteUpdateRef gates sendCodeUpdate
 *     so we never echo a remote edit back to the server.
 *   - remoteUpdate identity check: only apply if code/language actually differ.
 *   - applyRemoteSnapshot: explicit method for room:snapshot rehydration.
 *   - Debounce reduced to 150ms for snappier feel.
 *   - Language stored separately from code; changeLanguage uses sendLanguageChange.
 *   - editorRef exposed for cursor decoration consumers.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type * as Monaco from "monaco-editor";

type CollaborativeEditorArgs = {
  roomId: string;
  problemId: string;
  defaultCode?: string;
  remoteUpdate?: { code?: string; language?: string } | null;
  sendCodeUpdate: (payload: { code: string; language: string }) => void;
  sendLanguageChange?: (language: string) => void;
  updateTyping: (isTyping: boolean) => void;
};

export const useCollaborativeEditor = ({
  roomId,
  problemId,
  defaultCode = "// Start coding\n",
  remoteUpdate,
  sendCodeUpdate,
  sendLanguageChange,
  updateTyping,
}: CollaborativeEditorArgs) => {
  const storageKey = `interview:${roomId}:${problemId}`;
  const langStorageKey = `interview:${roomId}:${problemId}:lang`;

  const [code, setCode] = useState<string>(() => {
    const saved = localStorage.getItem(storageKey);
    return saved ?? defaultCode;
  });
  const [language, setLanguage] = useState<string>(() => {
    return localStorage.getItem(langStorageKey) ?? "javascript";
  });
  const [theme, setTheme] = useState<"vs-dark" | "light">("vs-dark");
  const [isSaving, setIsSaving] = useState(false);

  // Always-current ref — used by Run/Submit to avoid stale closure.
  const codeRef = useRef<string>(code);

  // ── Feedback loop guard ───────────────────────────────────────────────────
  // When we apply a remote update we set this flag so that the editor's
  // onChange callback knows not to emit a code:sync back to the server.
  const isRemoteUpdateRef = useRef(false);

  // Debounce ref for outgoing code sync.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Monaco editor instance ref (set via onMount).
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  // ── Persist localStorage ──────────────────────────────────────────────────
  useEffect(() => {
    codeRef.current = code;
    localStorage.setItem(storageKey, code);
  }, [storageKey, code]);

  useEffect(() => {
    localStorage.setItem(langStorageKey, language);
  }, [langStorageKey, language]);

  // ── Apply remote update (code:update / language_changed) ──────────────────
  useEffect(() => {
    if (!remoteUpdate) return;

    let changed = false;

    if (remoteUpdate.code !== undefined && remoteUpdate.code !== codeRef.current) {
      // Mark as remote before setting so onChange skips the emit.
      isRemoteUpdateRef.current = true;
      setCode(remoteUpdate.code);
      codeRef.current = remoteUpdate.code;
      changed = true;
    }

    if (remoteUpdate.language && remoteUpdate.language !== language) {
      setLanguage(remoteUpdate.language);
      changed = true;
    }

    if (changed) {
      // Allow one render cycle then clear the flag.
      // (Monaco's onChange fires synchronously in the same tick on value prop change,
      // but we give a micro-task margin for safety.)
      setTimeout(() => {
        isRemoteUpdateRef.current = false;
      }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteUpdate]);

  // ── Cleanup ───────────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ── applyRemoteSnapshot ───────────────────────────────────────────────────
  /**
   * Called when the server sends room:snapshot on (re)join.
   * Directly sets editor content without emitting back to the server.
   */
  const applyRemoteSnapshot = useCallback(
    (snapshotCode: string, snapshotLanguage: string) => {
      isRemoteUpdateRef.current = true;
      setCode(snapshotCode);
      codeRef.current = snapshotCode;
      setLanguage(snapshotLanguage);
      setTimeout(() => {
        isRemoteUpdateRef.current = false;
      }, 0);
    },
    []
  );

  // ── updateCode (called from Monaco onChange) ──────────────────────────────
  const updateCode = useCallback(
    (nextCode: string) => {
      // If this change originated from a remote update we just applied,
      // do NOT emit it back — that would create an echo loop.
      if (isRemoteUpdateRef.current) {
        isRemoteUpdateRef.current = false;
        return;
      }

      setCode(nextCode);
      codeRef.current = nextCode;
      updateTyping(true);
      setIsSaving(true);

      if (debounceRef.current) clearTimeout(debounceRef.current);

      debounceRef.current = setTimeout(() => {
        sendCodeUpdate({ code: nextCode, language });
        setIsSaving(false);
      }, 150);
    },
    [language, sendCodeUpdate, updateTyping]
  );

  // ── changeLanguage ────────────────────────────────────────────────────────
  const changeLanguage = useCallback(
    (nextLanguage: string) => {
      setLanguage(nextLanguage);
      // Emit language-only change event (preferred) or fall back to code sync.
      if (sendLanguageChange) {
        sendLanguageChange(nextLanguage);
      } else {
        sendCodeUpdate({ code: codeRef.current, language: nextLanguage });
      }
    },
    [sendCodeUpdate, sendLanguageChange]
  );

  // ── toggleTheme ───────────────────────────────────────────────────────────
  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "vs-dark" ? "light" : "vs-dark"));
  }, []);

  // ── resetCode ─────────────────────────────────────────────────────────────
  const resetCode = useCallback(() => {
    isRemoteUpdateRef.current = false;
    setCode(defaultCode);
    codeRef.current = defaultCode;
    localStorage.removeItem(storageKey);
    sendCodeUpdate({ code: defaultCode, language });
  }, [defaultCode, language, sendCodeUpdate, storageKey]);

  // ── onMount ───────────────────────────────────────────────────────────────
  const handleEditorMount = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor) => {
      editorRef.current = editor;
    },
    []
  );

  return {
    code,
    codeRef,
    language,
    theme,
    isSaving,
    editorRef,
    updateCode,
    changeLanguage,
    toggleTheme,
    resetCode,
    applyRemoteSnapshot,
    handleEditorMount,
  };
};
