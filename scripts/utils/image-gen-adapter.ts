/**
 * Image generation adapter for baoyu-image-gen integration
 */

import path from "node:path";
import { mkdir } from "node:fs/promises";
import type { Provider } from "../types.js";

export interface ImageGenOptions {
  prompt: string;
  output: string;
  ar?: string;
  quality?: string;
  provider?: Provider;
  refImages?: string[];
}

const SKILL_DIR = path.resolve(import.meta.dir, "../..");

export async function callImageGen(options: ImageGenOptions): Promise<void> {
  const args: string[] = [
    "--prompt", options.prompt,
    "--image", options.output,
  ];

  if (options.ar) {
    args.push("--ar", options.ar);
  }

  if (options.quality) {
    args.push("--quality", options.quality);
  }

  if (options.provider) {
    args.push("--provider", options.provider);
  }

  // Add reference images for character consistency
  if (options.refImages && options.refImages.length > 0) {
    args.push("--ref", ...options.refImages);
  }

  const imageGenPath = path.join(
    SKILL_DIR,
    "../baoyu-image-gen/scripts/main.ts"
  );

  // Ensure output directory exists
  const outputDir = path.dirname(options.output);
  await mkdir(outputDir, { recursive: true });

  // Execute baoyu-image-gen
  const proc = Bun.spawn(["npx", "-y", "bun", imageGenPath, ...args], {
    stdout: "inherit",
    stderr: "inherit",
    env: process.env,
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`Image generation failed with exit code ${exitCode}`);
  }
}

export async function callImageGenWithRetry(
  options: ImageGenOptions,
  maxRetries: number = 2
): Promise<void> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await callImageGen(options);
      return;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        console.warn(`  Generation attempt ${attempt + 1} failed, retrying...`);
      }
    }
  }

  throw lastError;
}

export function resolveProvider(preferred: Provider | null | undefined): Provider {
  if (preferred) return preferred;

  // Auto-detect from environment
  const hasGoogle = !!(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY);
  const hasOpenai = !!process.env.OPENAI_API_KEY;
  const hasDashscope = !!process.env.DASHSCOPE_API_KEY;

  if (hasGoogle) return "google";
  if (hasOpenai) return "openai";
  if (hasDashscope) return "dashscope";

  throw new Error(
    "No API key found. Set GOOGLE_API_KEY, OPENAI_API_KEY, or DASHSCOPE_API_KEY."
  );
}

export function calculatePanelAspectRatio(
  panelWidth: number,
  panelHeight: number
): string {
  const gcd = (a: number, b: number): number => {
    return b === 0 ? a : gcd(b, a % b);
  };

  const divisor = gcd(panelWidth, panelHeight);
  const w = Math.round(panelWidth / divisor);
  const h = Math.round(panelHeight / divisor);

  return `${w}:${h}`;
}
