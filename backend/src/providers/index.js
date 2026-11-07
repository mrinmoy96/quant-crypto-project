import { createBinanceProvider } from "./BinanceProvider.js";
import { createMockProvider } from "./MockProvider.js";
import { env } from "../config/env.js";
const realProvider=createBinanceProvider(); const mockProvider=createMockProvider();
function live(){return env.marketDataProvider!=="mock";}
export async function getProviderQuote(k){if(live())try{return {...await realProvider.getQuote(k),source:"binance"};}catch(e){console.warn(`[market-data] Binance quote failed for ${k}, using mock: ${e.message}`);} return {...await mockProvider.getQuote(k),source:"mock-fallback"};}
export async function getProviderCandles(k,t,l){if(live())try{const candles=await realProvider.getCandles(k,t,l);if(candles.length)return{candles,source:"binance"};throw new Error("zero candles");}catch(e){console.warn(`[market-data] Binance candles failed for ${k}, using mock: ${e.message}`);} return {candles:await mockProvider.getCandles(k,t,l),source:"mock-fallback"};}
export function _createProvidersForTesting({baseUrl}){return{real:createBinanceProvider({baseUrl}),mock:createMockProvider()};}
