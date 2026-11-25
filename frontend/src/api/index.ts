import { demoApi } from "../demo/demoApi";
import { serverApi } from "./server";
import type { Api } from "./types";

export const IS_DEMO = import.meta.env.VITE_MODE === "demo";
export const api: Api = IS_DEMO ? demoApi : serverApi;
