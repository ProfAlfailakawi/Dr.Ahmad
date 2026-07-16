#!/usr/bin/env node
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const child = spawn(process.execPath, [path.join(root, 'whatsapp-agent', 'cli.mjs'), ...process.argv.slice(2)], { stdio: 'inherit', env: process.env })
child.on('exit', (code, signal) => process.exit(signal ? 1 : (code || 0)))
