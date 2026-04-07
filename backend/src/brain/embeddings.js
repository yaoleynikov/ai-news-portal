import { pipeline, env } from '@xenova/transformers';

// Important for low-spec Intel N100: Don't use WASM threads if memory/architecture has issues,
// but usually modern WASM can handle it fine. We force local cache to avoid downloading repeatedly.
env.allowLocalModels = true;
env.useBrowserCache = false;

// Singleton to prevent reloading the model on every function call
let extractorCache = null;

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

/**
 * Generates highly efficient 384-dimensional embeddings natively in Node.js CPU
 */
export async function generateEmbedding(text) {
  try {
    if (!extractorCache) {
      console.log(`[EMBEDDING] Loading Local Model: ${MODEL_NAME}`);
      extractorCache = await pipeline('feature-extraction', MODEL_NAME, {
        quantized: true, // Crucial for low RAM usage
      });
    }

    // Pooling "mean" and normalizing gives correct cosine similarity vectors
    const output = await extractorCache(text, {
      pooling: 'mean',
      normalize: true,
    });

    return Array.from(output.data);
  } catch (err) {
    console.error('[EMBEDDING] Generation failed:', err.message);
    throw err;
  }
}
