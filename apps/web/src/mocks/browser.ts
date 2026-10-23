import { setupWorker } from "msw/browser";
import handlers from "./handlers";
import authHandlers from "./auth-handlers";
import profileHandlers from "./profile-handlers";
import studioHandlers from "./studio-handlers";
import campaignHandlers from "./campaign-handlers";
import pricingHandlers from "./pricing-handlers";

const worker = setupWorker(
  ...handlers,
  ...authHandlers,
  ...profileHandlers,
  ...studioHandlers,
  ...campaignHandlers,
  ...pricingHandlers,
);

export default worker;
