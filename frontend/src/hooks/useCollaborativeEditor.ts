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
  // Always-current ref so that Run/Submit always send the latest code,
  // regardless of React closure timing.
  const codeRef = useRef<string>(defaultCode);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setCode(saved);
      codeRef.current = saved;
    } else if (defaultCode) {
      setCode(defaultCode);
      codeRef.current = defaultCode;
    }
  }, [storageKey, defaultCode]);

  useEffect(() => {
    if (!remoteUpdate) {
      return;
    }

    if (remoteUpdate.code !== undefined) {
      setCode(remoteUpdate.code);
      codeRef.current = remoteUpdate.code;
    }

    if (remoteUpdate.language) {
      setLanguage(remoteUpdate.language);
    }
  }, [remoteUpdate]);

  useEffect(() => {
    codeRef.current = code;
    localStorage.setItem(storageKey, code);
  }, [storageKey, code]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const updateCode = (nextCode: string) => {
    setCode(nextCode);
    codeRef.current = nextCode;
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
    sendCodeUpdate({ code: codeRef.current, language: nextLanguage });
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "vs-dark" ? "light" : "vs-dark"));
  };

  const resetCode = () => {
    setCode(defaultCode);
    codeRef.current = defaultCode;
    localStorage.removeItem(storageKey);
    sendCodeUpdate({ code: defaultCode, language });
  };

  return {
    code,
    codeRef,
    language,
    theme,
    isSaving,
    updateCode,
    changeLanguage,
    toggleTheme,
    resetCode,
  };
};
