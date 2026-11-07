import { getQuote, generateCandles } from "../data/mockMarketData.js";
export function createMockProvider(){return {getQuote:async k=>getQuote(k),getCandles:async(k,t,l)=>generateCandles(k,t,l),source:"mock-fallback"};}
