import { setupWorker } from "msw/browser";
import handlers from "./handlers";
import authHandlers from "./auth-handlers";
import profileHandlers from "./profile-handlers";
import studioHandlers from "./studio-handlers";
import campaignHandlers from "./campaign-handlers";
import pricingHandlers from "./pricing-handlers";
import proposalHandlers from "./proposal-handlers";
import termsHandlers from "./terms-handlers";

const worker = setupWorker(
  ...handlers,
  ...authHandlers,
  ...profileHandlers,
  ...studioHandlers,
  ...campaignHandlers,
  ...pricingHandlers,
  ...proposalHandlers,
  ...termsHandlers,
);

export default worker;
