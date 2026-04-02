import { router as authGoogle } from "./auth.google.route";
import { router as authLocal } from "./auth.local.route";
import { router as ai } from "./ai.route";
import { router as user } from "./user.route";

export default [authLocal, authGoogle, user, ai];
