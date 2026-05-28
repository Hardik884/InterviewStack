import { useEffect, useRef, useState } from "react";

type CollaborativeEditorArgs = {
  roomId: string;
  problemId: string;
  defaultCode?: string;
  remoteUpdate?: { code?: string; language?: string } | null;
  sendCodeUpdate: (payload: { code: string; language: string }) => void;
  updateTyping: (isTyping: boolean) => void;
};

export const useCollaborativeEditor = ({
  roomId,
  problemId,
  defaultCode = "// Start coding\n",
  remoteUpdate,
  sendCodeUpdate,
  updateTyping,
}: CollaborativeEditorArgs) => {
  const storageKey = `interview:${roomId}:${problemId}`;
  const [code, setCode] = useState(defaultCode);
  const [language, setLanguage] = useState("javascript");
  const [theme, setTheme] = useState("vs-dark");
  const [isSaving, setIsSaving] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setCode(saved);
    } else if (defaultCode) {
      setCode(defaultCode);
    }
  }, [storageKey, defaultCode]);

  useEffect(() => {
    if (!remoteUpdate) {
      return;
    }

    if (remoteUpdate.code !== undefined) {
      setCode(remoteUpdate.code);
    }

    if (remoteUpdate.language) {
      setLanguage(remoteUpdate.language);
    }
  }, [remoteUpdate]);

  useEffect(() => {
    localStorage.setItem(storageKey, code);
  }, [storageKey, code]);

  const updateCode = (nextCode: string) => {
    setCode(nextCode);
    updateTyping(true);
    setIsSaving(true);

    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }

    debounceRef.current = window.setTimeout(() => {
      sendCodeUpdate({ code: nextCode, language });
      setIsSaving(false);
    }, 250);
  };

  const changeLanguage = (nextLanguage: string) => {
    setLanguage(nextLanguage);
    sendCodeUpdate({ code, language: nextLanguage });
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "vs-dark" ? "light" : "vs-dark"));
  };

  const resetCode = () => {
    setCode(defaultCode);
    sendCodeUpdate({ code: defaultCode, language });
  };

  return {
    code,
    language,
    theme,
    isSaving,
    updateCode,
    changeLanguage,
    toggleTheme,
    resetCode,
  };
};
