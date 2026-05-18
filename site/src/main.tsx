import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "@fontsource-variable/inter";
import "../globals.css";
import { Layout } from "./Layout";
import { IndexPage } from "./pages/IndexPage";
import { TestPage } from "./pages/TestPage";
import { SequencerPage } from "./pages/SequencerPage";
import { DrumabusePage } from "./pages/DrumabusePage";

const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      children: [
        { path: "/", element: <IndexPage /> },
        { path: "/sequencer", element: <SequencerPage /> },
        { path: "/drumabuse", element: <DrumabusePage /> },
      ],
    },
    { path: "/test", element: <TestPage /> },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, "") },
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
