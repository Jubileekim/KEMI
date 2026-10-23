import { setupWorker } from "msw/browser";
import handlers from "./handlers";
import authHandlers from "./auth-handlers";
import profileHandlers from "./profile-handlers";

const worker = setupWorker(...handlers, ...authHandlers, ...profileHandlers);

export default worker;
