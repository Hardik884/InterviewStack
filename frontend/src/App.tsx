import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./layouts/AppLayout";
import AuthLayout from "./layouts/AuthLayout";

/*
 * Route-level code-splitting.
 *
 * Heavy dependencies (Monaco editor, Yjs, LiveKit, Recharts, Framer Motion)
 * are isolated to the routes that use them so the initial bundle stays small.
 * Each page is loaded on demand via React.lazy + Suspense.
 */
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Problems = lazy(() => import("./pages/Problems"));
const ProblemDetails = lazy(() => import("./pages/ProblemDetails"));
const Rooms = lazy(() => import("./pages/Rooms"));
const RoomSession = lazy(() => import("./pages/Room"));
const RoleSelect = lazy(() => import("./pages/RoleSelect"));
const InterviewLobby = lazy(() => import("./pages/InterviewLobby"));
const ResumeUpload = lazy(() => import("./pages/ResumeUpload"));
const ResumeHistory = lazy(() => import("./pages/ResumeHistory"));
const ResumeDetail = lazy(() => import("./pages/ResumeDetail"));
const InterviewWorkspace = lazy(() => import("./pages/InterviewWorkspace"));
const NotFound = lazy(() => import("./pages/NotFound"));

const RouteFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center text-sm text-ink/50">
    Loading…
  </div>
);

const App = () => {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route
          path="/login"
          element={
            <AuthLayout>
              <Login />
            </AuthLayout>
          }
        />
        <Route
          path="/register"
          element={
            <AuthLayout>
              <Register />
            </AuthLayout>
          }
        />

        {/*
         * Full-screen pages that bypass the AppLayout chrome.
         * RoleSelect and InterviewLobby have their own dark backgrounds
         * and should not render inside the sidebar/header shell.
         */}
        <Route
          path="/join/:roomId"
          element={
            <ProtectedRoute>
              <RoleSelect />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lobby/:roomId"
          element={
            <ProtectedRoute>
              <InterviewLobby />
            </ProtectedRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="/problems" element={<Problems />} />
          <Route path="/problems/:id" element={<ProblemDetails />} />
          <Route path="/rooms" element={<Rooms />} />
          {/* /rooms/:roomId kept for direct interviewer quick-access */}
          <Route path="/rooms/:roomId" element={<RoomSession />} />
          <Route path="/resume/upload" element={<ResumeUpload />} />
          <Route path="/resume/history" element={<ResumeHistory />} />
          <Route path="/resume/:id" element={<ResumeDetail />} />
          <Route path="/interview/:roomId/:problemId" element={<InterviewWorkspace />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

export default App;
