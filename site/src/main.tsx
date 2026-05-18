import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "@fontsource-variable/inter";
import "../globals.css";
import { IndexPage } from "./pages/IndexPage";
import { TestPage } from "./pages/TestPage";

const router = createBrowserRouter(
  [
    { path: "/", element: <IndexPage /> },
    { path: "/test", element: <TestPage /> },
  ],
  { basename: import.meta.env.BASE_URL.replace(/\/$/, "") },
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
