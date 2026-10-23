import { setupWorker } from "msw/browser";
import handlers from "./handlers";
import authHandlers from "./auth-handlers";
import profileHandlers from "./profile-handlers";
import studioHandlers from "./studio-handlers";

const worker = setupWorker(
  ...handlers,
  ...authHandlers,
  ...profileHandlers,
  ...studioHandlers,
);

export default worker;
