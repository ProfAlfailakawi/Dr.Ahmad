#!/usr/bin/env node
/**
 * Safety lock: global terminology rewriting is intentionally disabled.
 * The author's articles, books, research, CV, biography, titles, quotations,
 * dialogues, and generated/static copies must never be rewritten by this tool.
 * Interface terminology must be edited explicitly in its owning UI component.
 */
const writeRequested = process.argv.includes('--write')
if (writeRequested) {
  console.error('Global terminology rewriting is disabled to protect author-owned content.')
  process.exitCode = 2
} else {
  console.log('Author-owned content protection is active. No files were changed.')
}
