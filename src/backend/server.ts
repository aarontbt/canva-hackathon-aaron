require("dotenv").config();
import * as express from "express";
import * as cors from "cors";
import * as NodeCache from "node-cache";
import { createBaseServer } from "../../utils/backend/base_backend/create";
import { createJwtMiddleware } from "../../utils/backend/jwt_middleware";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from 'pexels';
import { createHash } from "crypto";

function markdownToPlainText(markdown) {
  return markdown
    .replace(/```json\s*([\s\S]*?)\s*```/g, '$1') // Remove ```json and ```
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
    .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links, keep text
    .replace(/(`|~~|[*_]{1,2})(.*?)\1/g, '$2') // Remove inline code, strikethrough, emphasis
    .replace(/^>\s+/gm, '') // Remove blockquotes
    .replace(/^#{1,6}\s+/gm, '') // Remove headers
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/^\s*[-+*]\s+/gm, '') // Remove unordered lists
    .replace(/^\s*\d+\.\s+/gm, '') // Remove ordered lists
    .replace(/^-{3,}$/gm, '') // Remove horizontal rules
    .replace(/\n{2,}/g, '\n\n') // Remove extra line breaks
    .replace(/\\\$/g, '$') // Handle escaped dollar signs
    .replace(/\$/g, '$') // Handle dollar signs
    .replace(/\*/g, '') // Remove random asterisks
    .trim(); // Trim leading/trailing whitespace
}

function hashString(input) {
  return createHash('sha256').update(input).digest('hex');
}

async function runAI(prompt, systemInstruction) {
  const GEMINI_KEY = process.env.GEMINI_KEY;
  if (!GEMINI_KEY) {
    console.log("GEMINI_KEY is undefined in .env");
    return "";
  }
  if (!prompt) {
    console.log("Empty prompt given.");
    return "";
  }
  if (!systemInstruction) {
    console.log("Empty systemInstruction given.");
    return "";
  }

  const genAI = new GoogleGenerativeAI(GEMINI_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: systemInstruction,
  });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = await response.text();

  return markdownToPlainText(text.trim());
}

async function getPexel(query, items) {
  const PEXEL_KEY = process.env.PEXEL_KEY;
  if (!PEXEL_KEY) {
    console.log("PEXEL_KEY is undefined in .env");
    return "";
  }
  if (!query) {
    console.log("Empty query given.");
    return "";
  }

  const client = createClient(PEXEL_KEY);
  const photos = await client.photos.search({ query, per_page: items });

  if(photos){
    return photos
  } else {
    return "";
  }

}

async function main() {
  const APP_ID = process.env.CANVA_APP_ID;
  if (!APP_ID) {
    throw new Error(
      `The CANVA_APP_ID environment variable is undefined. Set the variable in the project's .env file.`
    );
  }

  const cache = new NodeCache({ stdTTL: 60 }); // Cache with a TTL of 60 seconds
  const router = express.Router();
  router.use(cors());
  router.use(express.json());

  const jwtMiddleware = createJwtMiddleware(APP_ID);
  router.use(jwtMiddleware);

  // Fetch Gemini API
  router.post("/gemini", async (req, res) => {
    const prompt = req.body?.prompt;
    const type = req.body?.type || "default";
    const slides = req.body?.slides || 10;

    let systemInstruction = req.body?.systemInstruction || "You are an expert Hackathon judge. Give your answer in a short description only.";

    // Override default system instruction for pitch instruction
    if(type === "pitch"){
      systemInstruction = `You are an expert in 10-20-30 Guy Kawasaki pitch slides. Based on the hackathon topic given give your answer in the JSON format in slide array which has (name, content, image, link). Give only final output. Suggest a image keyword for the slide. Have ${slides} slides. Please give any link reference if there is evidence. Do not mention 'Slide'. Do not give other suggestion or explaination.`;
    }

    const cacheKey = hashString(`${prompt}_${type}_${systemInstruction}`);
    const cachedResponse = cache.get(cacheKey);

    if (cachedResponse) {
      console.log(cachedResponse);
      return res.status(200).send({
        result: cachedResponse,
      });
    }

    try {
      const aiResult = await runAI(prompt, systemInstruction);
      console.log(aiResult);
      cache.set(cacheKey, aiResult);
      res.status(200).send({
        result: aiResult,
      });
    } catch (error) {
      res.status(500).send({
        error: "Failed to process the request.",
      });
    }
  });

  // Fetch Pexel API
  router.post("/pexel", async (req, res) => {
    const query = req.body?.query;
    const items = req.body?.items;

    const cacheKey = hashString(`pexel_${query}`);
    const cachedResponse = cache.get(cacheKey);

    if (cachedResponse) {
      console.log(cachedResponse);
      return res.status(200).send({
        result: cachedResponse,
      });
    }

    try {
      const photos = await getPexel(query, items);
      console.log(photos);
      cache.set(cacheKey, photos);
      res.status(200).send({
        result: photos,
      });
    } catch (error) {
      res.status(500).send({
        error: "Failed to process the request.",
      });
    }
  });

  const server = createBaseServer(router);
  server.start(process.env.CANVA_BACKEND_PORT);
}

main();
