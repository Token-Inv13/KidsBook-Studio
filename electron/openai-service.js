const express = require('express');
const keytar = require('keytar');
const OpenAI = require('openai');

const SERVICE_NAME = 'KidsBookStudio';
const ACCOUNT_NAME = 'OpenAI_API_Key';

const getPromptPreview = (prompt) => {
  if (!prompt || typeof prompt !== 'string') {
    return '';
  }

  return prompt.replace(/\s+/g, ' ').trim().slice(0, 180);
};

let server;
let openaiClient;

async function initializeOpenAI() {
  const apiKey = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
  if (apiKey) {
    openaiClient = new OpenAI({ apiKey });
  }
  return !!apiKey;
}

async function startOpenAIService() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', hasApiKey: !!openaiClient });
  });

  app.post('/api/reinitialize', async (req, res) => {
    try {
      const hasKey = await initializeOpenAI();
      res.json({ success: true, hasApiKey: hasKey });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      console.log('[OpenAI Service] Received chat request');
      
      if (!openaiClient) {
        console.log('[OpenAI Service] Initializing OpenAI client...');
        await initializeOpenAI();
      }

      if (!openaiClient) {
        console.error('[OpenAI Service] No API key configured');
        return res.status(401).json({ 
          success: false, 
          error: 'OpenAI API key not configured' 
        });
      }

      const { messages, temperature = 0.7, max_tokens = 2000 } = req.body;
      
      console.log('[OpenAI Service] Calling OpenAI API...');

      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4',
        messages: messages,
        temperature: temperature,
        max_tokens: max_tokens
      });

      console.log('[OpenAI Service] OpenAI API response received');

      res.json({
        success: true,
        content: response.choices[0].message.content,
        usage: response.usage
      });
    } catch (error) {
      console.error('[OpenAI Service] Chat error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Internal server error' 
      });
    }
  });

  app.post('/api/generate-image', async (req, res) => {
    const requestId = `img-${Date.now()}`;

    try {
      console.log(`[OpenAI Service] [${requestId}] Received image generation request`);
      
      if (!openaiClient) {
        console.log('[OpenAI Service] Initializing OpenAI client...');
        await initializeOpenAI();
      }

      if (!openaiClient) {
        console.error('[OpenAI Service] No API key configured');
        return res.status(401).json({ 
          success: false, 
          error: 'OpenAI API key not configured' 
        });
      }

      const {
        prompt,
        size = '1024x1024',
        quality = 'standard',
        referenceImageId = null,
        referenceImagePath = null
      } = req.body;

      if (!prompt) {
        return res.status(400).json({ 
          success: false, 
          error: 'Prompt is required' 
        });
      }

      console.log(`[OpenAI Service] [${requestId}] Calling DALL-E 3 API`, {
        size,
        quality,
        promptLength: prompt.length,
        promptPreview: getPromptPreview(prompt),
        referenceImageId,
        hasReferenceImagePath: Boolean(referenceImagePath)
      });

      const response = await openaiClient.images.generate({
        model: 'dall-e-3',
        prompt,
        size,
        n: 1,
        quality
      });

      console.log(`[OpenAI Service] [${requestId}] Image generated successfully`);

      res.json({
        success: true,
        url: response.data[0].url,
        revised_prompt: response.data[0].revised_prompt,
        requestId,
        referenceImageId
      });
    } catch (error) {
      const statusCode = Number(error?.status) || Number(error?.statusCode) || 500;
      const errorType = error?.type || error?.name || 'unknown_error';
      const errorCode = error?.code || error?.error?.code || null;
      const errorParam = error?.param || error?.error?.param || null;

      console.error(`[OpenAI Service] [${requestId}] Image generation error`, {
        message: error?.message,
        statusCode,
        errorType,
        errorCode,
        errorParam,
        raw: error
      });

      res.status(statusCode).json({ 
        success: false, 
        error: error?.message || 'Internal server error',
        errorType,
        errorCode,
        statusCode,
        requestId
      });
    }
  });

  return new Promise((resolve, reject) => {
    const PORT = 3001;
    server = app.listen(PORT, 'localhost', async () => {
      console.log(`OpenAI service running on http://localhost:${PORT}`);
      await initializeOpenAI();
      resolve(PORT);
    });

    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        const altPort = PORT + 1;
        server = app.listen(altPort, 'localhost', async () => {
          console.log(`OpenAI service running on http://localhost:${altPort}`);
          await initializeOpenAI();
          resolve(altPort);
        });
      } else {
        reject(error);
      }
    });
  });
}

async function stopOpenAIService() {
  if (server) {
    return new Promise((resolve) => {
      server.close(() => {
        console.log('OpenAI service stopped');
        resolve();
      });
    });
  }
}

module.exports = { startOpenAIService, stopOpenAIService };
