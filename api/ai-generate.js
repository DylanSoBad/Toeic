// Node and Vercel use one generation contract and one validation pipeline.
import { handleAiRequest } from '../server/ai-service.js';

export default async function handler(req, res) {
  await handleAiRequest(req, res);
}
