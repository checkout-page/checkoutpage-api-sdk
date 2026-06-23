#!/usr/bin/env tsx

import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const SPEC_PATH = 'spec/openapi.json';
const OUTPUT_PATH = 'js/src/generated/schema.ts';

/**
 * Recursively sort object keys (arrays keep their order — they're significant in
 * OpenAPI). Combined with pretty-printing this gives the committed spec a stable,
 * line-based form that merges cleanly instead of conflicting wholesale (the raw
 * swagger export is minified to a single 600KB+ line).
 */
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeysDeep((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value;
}

async function generateTypes() {
  console.log('🔧 Generating TypeScript types from OpenAPI spec...\n');

  try {
    // Read and validate the OpenAPI spec
    console.log(`📖 Reading spec from: ${SPEC_PATH}`);
    const specContent = await fs.readFile(SPEC_PATH, 'utf-8');
    const spec = JSON.parse(specContent);

    console.log(`📋 OpenAPI version: ${spec.openapi}`);
    console.log(`📋 API title: ${spec.info?.title}`);
    console.log(`📋 API version: ${spec.info?.version}\n`);

    // Normalize the committed spec to a stable, pretty-printed, key-sorted form
    // so it diffs/merges line-by-line instead of conflicting on every refresh.
    const normalized = `${JSON.stringify(sortKeysDeep(spec), null, 2)}\n`;
    if (normalized !== specContent) {
      await fs.writeFile(SPEC_PATH, normalized, 'utf-8');
      console.log('🧹 Normalized spec (sorted keys + pretty-printed)\n');
    }

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_PATH);
    await fs.mkdir(outputDir, { recursive: true });

    // Generate TypeScript types using CLI
    console.log('⚙️  Generating types...');
    execSync(`npx openapi-typescript ${SPEC_PATH} -o ${OUTPUT_PATH}`, {
      stdio: 'inherit',
    });

    console.log();

    // Print stats
    const stats = await fs.stat(OUTPUT_PATH);
    const sizeInKB = (stats.size / 1024).toFixed(2);
    const content = await fs.readFile(OUTPUT_PATH, 'utf-8');
    const lineCount = content.split('\n').length;

    console.log(`✅ Types generated successfully!`);
    console.log(`📁 Output: ${OUTPUT_PATH}`);
    console.log(`📊 File size: ${sizeInKB} KB`);
    console.log(`📊 Lines: ${lineCount.toLocaleString()}`);
  } catch (error) {
    console.error('❌ Error generating types:', error);
    process.exit(1);
  }
}

generateTypes();
