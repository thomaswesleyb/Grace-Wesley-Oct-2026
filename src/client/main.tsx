import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { Layout } from "@client/components/Layout.tsx";
import { Admin } from "@client/pages/Admin.tsx";
import { Home } from "@client/pages/Home.tsx";
import { NotFound } from "@client/pages/NotFound.tsx";
import { QA } from "@client/pages/QA.tsx";
import { Registry } from "@client/pages/Registry.tsx";
import { Rsvp } from "@client/pages/Rsvp.tsx";
import { site } from "@client/site.ts";
import "@client/styles.css";

document.title = `${site.brideShort} & ${site.groomShort}`;

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/qa", element: <QA /> },
      { path: "/rsvp", element: <Rsvp /> },
      { path: "/registry", element: <Registry /> },
      { path: "/admin", element: <Admin /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

const root = document.getElementById("root");
if (root === null) throw new Error('index.html is missing <div id="root">.');
createRoot(root).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
