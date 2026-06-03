import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./layouts/AppLayout";
import AuthLayout from "./layouts/AuthLayout";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Problems from "./pages/Problems";
import ProblemDetails from "./pages/ProblemDetails";
import Rooms from "./pages/Rooms";
import RoomSession from "./pages/Room";
import RoleSelect from "./pages/RoleSelect";
import InterviewLobby from "./pages/InterviewLobby";
import ResumeUpload from "./pages/ResumeUpload";
import ResumeHistory from "./pages/ResumeHistory";
import ResumeDetail from "./pages/ResumeDetail";
import InterviewWorkspace from "./pages/InterviewWorkspace";
import NotFound from "./pages/NotFound";

const App = () => {
  return (
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
  );
};

export default App;
