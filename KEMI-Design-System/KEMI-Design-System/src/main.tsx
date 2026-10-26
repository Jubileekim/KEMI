import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import "./docs/docs.css";
import "./docs/unified.css";
import { App } from "./docs/App";
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
