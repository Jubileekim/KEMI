import { setupWorker } from "msw/browser";
import handlers from "./handlers";
import authHandlers from "./auth-handlers";

const worker = setupWorker(...handlers, ...authHandlers);

export default worker;
