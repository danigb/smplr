import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "@fontsource-variable/inter";
import "../globals.css";
import { Layout } from "./Layout";
import { IndexPage } from "./pages/IndexPage";

const router = createBrowserRouter(
  [
    {
      element: <Layout />,
      children: [
        { path: "/", element: <IndexPage /> },
        {
          path: "/sequencer",
          lazy: () =>
            import("./pages/SequencerPage").then((m) => ({
              Component: m.SequencerPage,
            })),
        },
        {
          path: "/drumabuse",
          lazy: () =>
            import("./pages/DrumabusePage").then((m) => ({
              Component: m.DrumabusePage,
            })),
        },
      ],
    },
    {
      path: "/test",
      lazy: () =>
        import("./pages/TestPage").then((m) => ({ Component: m.TestPage })),
    },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, "") },
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
