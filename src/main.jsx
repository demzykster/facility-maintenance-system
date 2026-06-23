import React from "react";
import { createRoot } from "react-dom/client";
import App from "./ClaudeMaintenanceApp.jsx";
import "./reset.css";

const storagePrefix = "facility-maintenance:";

if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    async get(key) {
      const value = window.localStorage.getItem(storagePrefix + key);
      return value === null ? null : { value };
    },
    async set(key, value) {
      window.localStorage.setItem(storagePrefix + key, value);
    },
    async delete(key) {
      window.localStorage.removeItem(storagePrefix + key);
    },
    async list(prefix = "") {
      const keys = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const rawKey = window.localStorage.key(i);
        if (rawKey?.startsWith(storagePrefix + prefix)) {
          keys.push(rawKey.slice(storagePrefix.length));
        }
      }
      return { keys };
    }
  };
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
