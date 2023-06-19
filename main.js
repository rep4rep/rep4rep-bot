import parseArgs from 'minimist'
import 'dotenv/config'
import steamBot from './src/steamBot.js'
import db from './src/db.js'
import api from './src/api.js'
import { log, showAllProfiles, addProfileSetup, authAllProfiles, removeProfile, autoRun } from './src/util.js'

var argv = parseArgs(process.argv.slice(2))
await db.init()
// autoRun:
//  --run

// list profiles:
//  --profiles

// auth profiles:
// --auth-profiles

// add profile:
//  --add-profile username:password

// rmeove profile:
//  --remove-profile username

if (argv['run']) {
    await autoRun()
}

if (argv['profiles']) {
    await showAllProfiles()
}

if (argv['auth-profiles']) {
    await authAllProfiles()
}

if (argv['add-profile']) {
    let profile = argv['add-profile'].split(':')
    await addProfileSetup(profile[0], profile[1])
}

if (argv['remove-profile']) {
    await removeProfile(argv['remove-profile'])
}

process.exit()

