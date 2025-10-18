#!/usr/bin/env tsx

import { execSync } from 'child_process'
import fs from 'fs/promises'
import path from 'path'

const SPEC_PATH = 'spec/openapi.json'
const OUTPUT_PATH = 'js/src/generated/schema.ts'

async function generateTypes() {
  console.log('🔧 Generating TypeScript types from OpenAPI spec...\n')

  try {
    // Read and validate the OpenAPI spec
    console.log(`📖 Reading spec from: ${SPEC_PATH}`)
    const specContent = await fs.readFile(SPEC_PATH, 'utf-8')
    const spec = JSON.parse(specContent)

    console.log(`📋 OpenAPI version: ${spec.openapi}`)
    console.log(`📋 API title: ${spec.info?.title}`)
    console.log(`📋 API version: ${spec.info?.version}\n`)

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_PATH)
    await fs.mkdir(outputDir, { recursive: true })

    // Generate TypeScript types using CLI
    console.log('⚙️  Generating types...')
    execSync(`npx openapi-typescript ${SPEC_PATH} -o ${OUTPUT_PATH}`, {
      stdio: 'inherit',
    })

    console.log()

    // Print stats
    const stats = await fs.stat(OUTPUT_PATH)
    const sizeInKB = (stats.size / 1024).toFixed(2)
    const content = await fs.readFile(OUTPUT_PATH, 'utf-8')
    const lineCount = content.split('\n').length

    console.log(`✅ Types generated successfully!`)
    console.log(`📁 Output: ${OUTPUT_PATH}`)
    console.log(`📊 File size: ${sizeInKB} KB`)
    console.log(`📊 Lines: ${lineCount.toLocaleString()}`)
  } catch (error) {
    console.error('❌ Error generating types:', error)
    process.exit(1)
  }
}

generateTypes()
