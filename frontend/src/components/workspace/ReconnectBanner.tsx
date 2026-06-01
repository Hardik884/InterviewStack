/**
 * ReconnectBanner.tsx
 *
 * Animated banner that appears at the top of the workspace whenever the
 * socket connection is not "online". Disappears smoothly when reconnected.
 */

import { AnimatePresence, motion } from "framer-motion";
import type { ConnectionStatus } from "../../hooks/useConnectionStatus";

type ReconnectBannerProps = {
  status: ConnectionStatus;
  reconnectAttempt?: number;
};

const ReconnectBanner = ({ status, reconnectAttempt = 0 }: ReconnectBannerProps) => {
  const isVisible = status !== "online";

  const isReconnecting = status === "reconnecting";
  const isOffline = status === "offline";

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="reconnect-banner"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="overflow-hidden"
        >
          <div
            className={`flex items-center justify-center gap-3 px-4 py-2.5 text-xs font-medium ${
              isReconnecting
                ? "bg-amber-500/10 text-amber-700 border-b border-amber-500/20"
                : "bg-rose-500/10 text-rose-700 border-b border-rose-500/20"
            }`}
          >
            {isReconnecting && (
              <>
                {/* Spinner */}
                <svg
                  className="h-3.5 w-3.5 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                <span>
                  Reconnecting
                  {reconnectAttempt > 0 ? ` (attempt ${reconnectAttempt})` : ""}
                  … Your work is safe.
                </span>
              </>
            )}
            {isOffline && (
              <>
                {/* Offline icon */}
                <svg
                  className="h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="2" y1="2" x2="22" y2="22" />
                  <path d="M8.5 16.5a5 5 0 0 1 7 0" />
                  <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
                  <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" />
                  <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" />
                  <path d="M5 13a10 10 0 0 1 5.24-2.76" />
                  <line x1="12" y1="20" x2="12.01" y2="20" />
                </svg>
                <span>
                  Connection lost — check your internet connection.
                </span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ReconnectBanner;
