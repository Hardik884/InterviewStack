import { Link } from "react-router-dom";

const AuthLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-sand text-ink">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            InterviewStack
          </Link>
          <span className="text-xs uppercase tracking-[0.3em] text-ink/60">
            AI Prep Suite
          </span>
        </div>
        <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_1fr]">
          <div className="rounded-3xl border border-ink/10 bg-white/70 p-8 shadow-soft">
            <h1 className="text-3xl font-semibold leading-tight">
              Build confidence with structured practice
            </h1>
            <p className="mt-4 text-sm text-ink/70">
              Analytics, problem sets, collaborative rooms, and AI resume insights
              in one place.
            </p>
            <div className="mt-10 flex flex-wrap gap-3 text-xs text-ink/60">
              <span className="rounded-full border border-ink/10 px-3 py-1">
                Role-based insights
              </span>
              <span className="rounded-full border border-ink/10 px-3 py-1">
                Live coding rooms
              </span>
              <span className="rounded-full border border-ink/10 px-3 py-1">
                Resume feedback
              </span>
            </div>
          </div>
          <div className="rounded-3xl border border-ink/10 bg-white/90 p-8 shadow-soft">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
