/**
 * Undo a rejection — `npm run unreject -- --placeId <id>`
 *
 * Removes one place id from `imports/rejected.json` so the next discovery run
 * will propose it again. Rejection is a convenience, not a verdict: a place
 * dropped six months ago may well be worth a second look.
 *
 * `--list` prints the current rejected list.
 */
import { REJECTED_PATH, parseArgs, readRejected, removeRejected } from '../lib/importFiles'
import path from 'node:path'

function main() {
  const args = parseArgs(process.argv.slice(2))
  const rejected = readRejected()

  if (args.list === true || args.list === 'true') {
    if (!rejected.placeIds.length) {
      console.log('Rejected list is empty.')
      return
    }
    console.log(`\n${rejected.placeIds.length} rejected place id(s):\n`)
    for (const id of rejected.placeIds) {
      console.log(`  ${id}${rejected.notes?.[id] ? `  — ${rejected.notes[id]}` : ''}`)
    }
    console.log()
    return
  }

  const placeId = typeof args.placeId === 'string' ? args.placeId.trim() : ''
  if (!placeId) {
    console.error('Usage: npm run unreject -- --placeId <id>   (or --list)')
    process.exitCode = 1
    return
  }

  if (removeRejected(placeId)) {
    console.log(`✓ ${placeId} removed from ${path.basename(REJECTED_PATH)}`)
    console.log('  It will show up in the next discovery run for its area.')
  } else {
    console.log(`· ${placeId} was not in the rejected list — nothing to do.`)
  }
}

main()
