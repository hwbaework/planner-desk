import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import * as store from "./lib/store.js";
import "./index.css";

store.connect();
if (import.meta.env.DEV) window.desk = store;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
