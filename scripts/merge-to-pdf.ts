/**
 * Merge generated pages to PDF
 */

import path from "node:path";
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { FlexicomicConfig } from "./types.js";
import { loadConfig } from "./validation.js";

export async function mergeToPdf(configPath: string): Promise<void> {
  const config = await loadConfig(configPath);
  const outputDir = path.dirname(configPath);
  const pagesDir = path.join(outputDir, "pages");
  const outputPath = path.join(outputDir, `${sanitizeFilename(config.meta.title)}.pdf`);

  console.log(`\n📄 Creating PDF: ${outputPath}`);

  let PDFDocument: any;

  try {
    const pdfLib = await import("pdf-lib");
    PDFDocument = pdfLib.PDFDocument;
  } catch {
    console.error("Error: pdf-lib is not installed.");
    console.error("Install with: bun add pdf-lib");
    process.exit(1);
    return;
  }

  // Check if pages directory exists
  if (!existsSync(pagesDir)) {
    console.error(`Error: Pages directory not found: ${pagesDir}`);
    console.error("Generate pages first with: main.ts generate -c <config>");
    process.exit(1);
    return;
  }

  // Get all page files
  const files = await readdir(pagesDir);
  const pageFiles = files
    .filter((f) => f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".jpeg"))
    .sort();

  if (pageFiles.length === 0) {
    console.error("Error: No page images found in pages directory");
    process.exit(1);
    return;
  }

  console.log(`Found ${pageFiles.length} page(s)`);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setAuthor(config.meta.author || "baoyu-flexicomic");
  pdfDoc.setTitle(config.meta.title);
  pdfDoc.setSubject("Generated Comic");

  for (const file of pageFiles) {
    const imagePath = path.join(pagesDir, file);
    const imageData = await readFile(imagePath);
    const ext = path.extname(file).toLowerCase();

    let image: any;
    if (ext === ".png") {
      image = await pdfDoc.embedPng(imageData);
    } else {
      image = await pdfDoc.embedJpg(imageData);
    }

    const { width, height } = image;
    const pdfPage = pdfDoc.addPage([width, height]);
    pdfPage.drawImage(image, { x: 0, y: 0, width, height });

    console.log(`  Added: ${file}`);
  }

  const pdfBytes = await pdfDoc.save();
  await Bun.write(outputPath, pdfBytes);

  console.log(`\n✅ PDF created: ${outputPath}`);
  console.log(`   Total pages: ${pageFiles.length}`);
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 100);
}
