import "./styles.css";
import { renderLanding, renderWaiting } from "./ui";
import { startWallet } from "./wallet";

const root = document.getElementById("app");
if (!root) {
  throw new Error("Missing #app");
}

if (window.opener) {
  renderWaiting(root);
  startWallet(root);
} else {
  renderLanding(root);
}
