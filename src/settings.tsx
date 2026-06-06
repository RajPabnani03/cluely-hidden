import React from "react";
import ReactDOM from "react-dom/client";
import { Settings } from "./routes/Settings";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Settings />
  </React.StrictMode>,
);
