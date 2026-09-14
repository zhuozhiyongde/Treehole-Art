import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import styles from "./styles.css?inline";

const isNewTreeholePage = window.location.hostname === "treehole.pku.edu.cn"
  && window.location.pathname.startsWith("/ch/");

if (isNewTreeholePage) {
  window.location.replace("https://treehole.pku.edu.cn/web/");
} else {
  startTreeholeArt();
}

function startTreeholeArt() {
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  const isTreeholeWeb = window.location.hostname === "treehole.pku.edu.cn"
    && /^\/web\/?$/.test(window.location.pathname);
  let officialPageObserver: MutationObserver | null = null;

  function removeOfficialPage() {
    const selector = 'script, style:not(#treehole-art-styles), link[rel="stylesheet"], link[rel="preload"], link[rel="prefetch"], body > #app';
    const removeMatches = (scope: ParentNode) => {
      scope.querySelectorAll(selector).forEach((node) => node.remove());
    };

    removeMatches(document);
    const observer = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof Element)) return;
          if (node.matches(selector)) node.remove();
          else removeMatches(node);
        });
      });
    });
    officialPageObserver = observer;
    observer.observe(document, { childList: true, subtree: true });
    window.addEventListener("pagehide", () => observer.disconnect(), { once: true });
  }

  if (isTreeholeWeb) removeOfficialPage();

  function mount() {
    if (!isLocal && !isTreeholeWeb) return;

    if (isTreeholeWeb) {
      officialPageObserver?.disconnect();
      document
        .querySelectorAll('script, style, link[rel="stylesheet"], link[rel="preload"], link[rel="prefetch"], body > #app')
        .forEach((node) => node.remove());
    }
    document.documentElement.classList.add("treehole-art-active");
    if (!document.getElementById("treehole-art-styles")) {
      const style = document.createElement("style");
      style.id = "treehole-art-styles";
      style.textContent = styles;
      document.head.appendChild(style);
    }
    let root = document.getElementById("treehole-art-root") ?? document.getElementById("root");
    if (!root) {
      root = document.createElement("div");
      root.id = "treehole-art-root";
      document.body.appendChild(root);
    }
    createRoot(root).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount, { once: true });
  } else {
    mount();
  }
}
