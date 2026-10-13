import { declineAll, serveWebWallet } from "@smart-health-checkin/client/wallet";
import type { SmartCheckinResponse } from "@smart-health-checkin/client/model";
import { renderError, renderSent, showConsentScreen } from "./ui";

export function startWallet(root: HTMLElement): { opened: boolean; stop: () => void } {
  return serveWebWallet({
    closeAfterReply: true,
    onInvalidRequest(message, origin) {
      renderError(root, message, origin);
    },
    async onRequest(context) {
      const choice = await showConsentScreen(root, context);
      if (choice.kind === "closed") {
        renderSent(root, "Closed without sending");
        return { declined: true };
      }
      if (choice.kind === "declined-all") {
        renderSent(root, "Every item was declined");
        return { response: declineAll(context.request) };
      }
      if (choice.kind === "failed") {
        renderError(root, choice.message, context.origin);
        return { error: choice.message };
      }
      renderSent(root, "Sending your answer");
      return { response: choice.response as SmartCheckinResponse };
    },
  });
}
