import { setupWorker } from "msw/browser";
import handlers from "./handlers";
import authHandlers from "./auth-handlers";
import profileHandlers from "./profile-handlers";
import studioHandlers from "./studio-handlers";
import campaignHandlers from "./campaign-handlers";
import pricingHandlers from "./pricing-handlers";
import proposalHandlers from "./proposal-handlers";
import termsHandlers from "./terms-handlers";
import signatureHandlers from "./signature-handlers";
import paymentHandlers from "./payment-handlers";
import productionHandlers from "./production-handlers";
import deliveryHandlers from "./delivery-handlers";
import settlementHandlers from "./settlement-handlers";
import resolutionHandlers from "./resolution-handlers";

const worker = setupWorker(
  ...handlers,
  ...authHandlers,
  ...profileHandlers,
  ...studioHandlers,
  ...campaignHandlers,
  ...pricingHandlers,
  ...proposalHandlers,
  ...termsHandlers,
  ...signatureHandlers,
  ...paymentHandlers,
  ...productionHandlers,
  ...deliveryHandlers,
  ...settlementHandlers,
  ...resolutionHandlers,
);

export default worker;
