import { mkdirSync, appendFileSync } from 'fs'
import { join } from 'path'

const DEFAULT_SPAM_DIR_NAME = 'spam'
const DEFAULT_GENUINE_DIR_NAME = 'ideas'

export function createSubmissionLogger(options) {
  const {
    baseDir,
    spamDirName = DEFAULT_SPAM_DIR_NAME,
    genuineDirName = DEFAULT_GENUINE_DIR_NAME,
  } = options

  return function logSubmission({ name, email, message, classification }) {
    const dir = join(
      baseDir,
      classification.classification === 'spam' ? spamDirName : genuineDirName
    )
    try {
      mkdirSync(dir, { recursive: true })
      const date = new Date().toISOString().split('T')[0]
      const filepath = join(dir, `${date}.jsonl`)
      const entry = JSON.stringify({
        timestamp: new Date().toISOString(),
        submission: { name, email, message },
        classification: {
          result: classification.classification,
          reason: classification.reason,
          thanks: classification.thanks || null,
          failed: classification.failed || false,
        },
        engine: classification.engine || null,
      })
      appendFileSync(filepath, entry + '\n')
    } catch (err) {
      console.error(`Failed to log submission to ${dir}:`, err.message)
    }
  }
}
