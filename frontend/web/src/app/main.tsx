import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider as MTThemeProvider } from "@material-tailwind/react";
import "./tailwind.css";
import "../api/setup";
import App from "./App";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <MTThemeProvider>
      <App />
    </MTThemeProvider>
  </StrictMode>,
);
