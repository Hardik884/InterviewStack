import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import Logo from "../components/Logo";
import PageTransition from "../components/ui/PageTransition";

const navLinks = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/problems", label: "Problems" },
  { to: "/rooms", label: "Rooms" },
  { to: "/resume/upload", label: "Resume Lab" },
];

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `relative rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-ink text-white shadow-sm"
      : "text-ink/60 hover:text-ink hover:bg-ink/5"
  }`;

const AppLayout = () => {
  const { user, logout } = useAuth() as {
    user?: { name?: string; email?: string } | null;
    logout: () => void;
  };
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="min-h-screen bg-sand text-ink">
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-ink/8 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">

          {/* Brand */}
          <Link
            to="/"
            className="flex items-center gap-2.5 text-ink no-underline"
            aria-label="InterviewStack home"
          >
            <Logo size={30} />
            <motion.span
              className="text-[15px] font-semibold tracking-tight"
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              InterviewStack
            </motion.span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            {navLinks.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={navItemClass}>
                {label}
              </NavLink>
            ))}
          </nav>

          {/* User section */}
          <div className="flex items-center gap-3">
            {/* Avatar + name */}
            <div className="hidden items-center gap-2.5 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white select-none">
                {initials}
              </div>
              <div className="text-right text-xs leading-tight">
                <p className="font-semibold text-ink">{user?.name || "Candidate"}</p>
                <p className="text-ink/50 truncate max-w-[120px]">{user?.email}</p>
              </div>
            </div>

            <motion.button
              type="button"
              onClick={logout}
              className="rounded-full border border-ink/20 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5 hover:text-ink transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              Logout
            </motion.button>

            {/* Mobile hamburger */}
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink/15 lg:hidden"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle mobile menu"
              aria-expanded={mobileOpen}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              >
                {mobileOpen ? (
                  <>
                    <line x1="3" y1="3" x2="13" y2="13" />
                    <line x1="13" y1="3" x2="3" y2="13" />
                  </>
                ) : (
                  <>
                    <line x1="2" y1="4.5" x2="14" y2="4.5" />
                    <line x1="2" y1="8" x2="14" y2="8" />
                    <line x1="2" y1="11.5" x2="14" y2="11.5" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.nav
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-ink/8 lg:hidden"
              aria-label="Mobile navigation"
            >
              <div className="flex flex-col gap-1 px-4 py-3">
                {navLinks.map(({ to, label, end }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-ink text-white"
                          : "text-ink/60 hover:bg-ink/5 hover:text-ink"
                      }`
                    }
                    onClick={() => setMobileOpen(false)}
                  >
                    {label}
                  </NavLink>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* ── Page content ───────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <AnimatePresence mode="wait" initial={false}>
          <PageTransition key={location.pathname}>
            <Outlet />
          </PageTransition>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default AppLayout;
