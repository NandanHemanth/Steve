import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppLayout } from "../components/layout/AppLayout";
import { Protected } from "../components/auth/Protected";
import { LandingPage } from "../pages/LandingPage";
import { LoginPage } from "../pages/LoginPage";
import { DashboardPage } from "../pages/DashboardPage";
import { ProfileBuilderPage } from "../pages/ProfileBuilderPage";
import { SettingsPage } from "../pages/SettingsPage";
import { CourseNewPage } from "../pages/CourseNewPage";
import { CourseOverviewPage } from "../pages/CourseOverviewPage";
import { CourseLearnPage } from "../pages/CourseLearnPage";
import { AcademicHubPage } from "../pages/AcademicHubPage";
import { CareerFitPage } from "../pages/CareerFitPage";

function RedirectDashboard() {
  return <Navigate to="/app/dashboard" replace />;
}

export const router = createBrowserRouter([
  { path: "/", element: <LandingPage /> },
  { path: "/login", element: <LoginPage /> },
  {
    path: "/app",
    element: (
      <Protected>
        <AppLayout />
      </Protected>
    ),
    children: [
      { index: true, element: <Navigate to="/app/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "profile", element: <ProfileBuilderPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "courses/new", element: <CourseNewPage /> },
      { path: "courses/:courseId", element: <CourseOverviewPage /> },
      { path: "courses/:courseId/learn", element: <CourseLearnPage /> },
      { path: "academic", element: <AcademicHubPage /> },
      { path: "career-fit", element: <CareerFitPage /> },
      { path: "academic/planner", element: <Navigate to="/app/academic" replace /> },
      { path: "calendar", element: <RedirectDashboard /> },
      { path: "calendar/*", element: <RedirectDashboard /> },
      { path: "communication", element: <RedirectDashboard /> },
      { path: "communication/*", element: <RedirectDashboard /> },
      { path: "navigator", element: <RedirectDashboard /> },
      { path: "navigator/*", element: <RedirectDashboard /> },
      { path: "events", element: <RedirectDashboard /> },
      { path: "events/*", element: <RedirectDashboard /> }
    ]
  },
  { path: "*", element: <Navigate to="/" replace /> }
]);
