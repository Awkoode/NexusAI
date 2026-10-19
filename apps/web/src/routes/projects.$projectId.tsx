import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "Projeto — NexusAI" },
      { name: "description", content: "Datasets, experimentos e análises do projeto." },
    ],
  }),
  component: () => (
    <Outlet />
  ),
});
