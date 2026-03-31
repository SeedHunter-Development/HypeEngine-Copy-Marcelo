import { Router, type IRouter } from "express";
import healthRouter from "./health";
import hypeEngineRouter from "./hypeengine";

const router: IRouter = Router();

router.use(healthRouter);
router.use(hypeEngineRouter);

export default router;
