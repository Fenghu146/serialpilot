import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { useThemeStore } from "./stores/themeStore";

function ThemeEffect() {
  const { mode } = useThemeStore();
  React.useEffect(() => {
    const html = document.getElementById("html-root");
    if (html) {
      html.className = mode;
    }
  }, [mode]);
  return null;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeEffect />
    <App />
  </React.StrictMode>
);
