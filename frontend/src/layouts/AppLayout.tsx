import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const navItem = ({ isActive }) =>
  `rounded-full px-4 py-2 text-sm transition ${
    isActive ? "bg-ink text-white" : "text-ink/70 hover:bg-ink/5"
  }`;

const AppLayout = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-sand text-ink">
      <header className="border-b border-ink/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <span className="text-lg font-semibold tracking-tight">
              InterviewStack
            </span>
            <nav className="hidden items-center gap-2 lg:flex">
              <NavLink to="/" end className={navItem}>
                Dashboard
              </NavLink>
              <NavLink to="/problems" className={navItem}>
                Problems
              </NavLink>
              <NavLink to="/rooms" className={navItem}>
                Interview Rooms
              </NavLink>
              <NavLink to="/resume/upload" className={navItem}>
                Resume Lab
              </NavLink>
              <NavLink to="/resume/history" className={navItem}>
                History
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right text-xs">
              <p className="font-medium">{user?.name || "Candidate"}</p>
              <p className="text-ink/60">{user?.email}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-full border border-ink/20 px-3 py-1 text-xs hover:bg-ink/5"
            >
              Logout
            </button>
          </div>
        </div>
        <nav className="flex items-center justify-between gap-2 border-t border-ink/10 px-6 py-3 text-xs lg:hidden">
          <NavLink to="/" end className={navItem}>
            Dashboard
          </NavLink>
          <NavLink to="/problems" className={navItem}>
            Problems
          </NavLink>
          <NavLink to="/rooms" className={navItem}>
            Rooms
          </NavLink>
          <NavLink to="/resume/upload" className={navItem}>
            Resume
          </NavLink>
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
