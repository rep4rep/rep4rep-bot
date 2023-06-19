import db from './db.js'
import api from './api.js'
import steamBot from './steamBot.js'
import { table } from 'table'
import ReadLine from 'readline'
import moment from 'moment'
import 'dotenv/config'

let rl = ReadLine.createInterface({
    input: process.stdin,
    output: process.stdout
})

const statusMessage = {
    inactive: 0,
    steamGuardRequired: 1,
    steamGuardMobileRequired: 2,
    captchaRequired: 3,
    loggedIn: 4
}

function log(message, emptyLine = false) {
    console.log(`[rep4rep-bot] ${message}`)
    if (emptyLine) {
        console.log()
    }
}

async function autoRun() {
    let profiles = await db.getAllProfiles()
    let r4rProfiles = await api.getSteamProfiles()

    for (const [i, profile] of profiles.entries()) {
        log(`Attempting to leave comments from: ${profile.username} (${profile.steamId})`)

        let hours = moment().diff(moment(profile.lastComment), 'hours');
        if (!profile.lastComment || profile.lastComment >= 24) {
            let r4rSteamProfile = r4rProfiles.find(r4rProfile => r4rProfile['steamId'] == profile.steamId)
            if (!r4rSteamProfile) {
                log(`[${profile.username}] steamProfile doesn't exist on rep4rep`)
                log(`Try syncing it with --auth-profiles`, true)
                continue
            }
    
            let tasks = await api.getTasks(r4rSteamProfile.id)
    
            let client = steamBot()
            await client.steamLogin(profile.username, profile.password, null, null, JSON.parse(profile.cookies))
            if (client.status !== 4 && !await client.isLoggedIn()) {
                log(`[${profile.username}] is logged out. reAuth needed`, true)
                continue
            } else {
                await autoRunComments(profile, client, tasks, r4rSteamProfile.id, 2)
                if (i !== profiles.length-1) {
                    await sleep(process.env.LOGIN_DELAY)
                }
                continue
            }
        } else {
            log(`[${profile.username}] is not ready yet`)
            log(`[${profile.username}] try again in: ${Math.round(24-hours)} hours`, true)
            continue
        }
    }

    log('autoRun completed')
}

async function autoRunComments(profile, client, tasks, authorSteamProfileId, maxAttempts = 2) {
    let attempts = 0

    for (const task of tasks) {
        if (attempts == maxAttempts) {
            continue
        }
        log(`[${profile.username}] posting comment:`)
        log(`${task.requiredCommentText} > ${task.targetSteamProfileName}`, true)
        await client.postComment(task.targetSteamProfileId, task.requiredCommentText)
        .then(async () => {
            await api.completeTask(task.taskId, task.requiredCommentId, authorSteamProfileId)
            await db.updateLastComment(profile.steamId)
            log(`[${profile.username}] comment posted and marked as completed`, true)
            attempts = 0 // reset attempts on succesful comment
        })
        .catch(err => {
            attempts++
            log(`[${profile.username}] failed to post comment`, true)
        })

        if (attempts !== maxAttempts) {
            await sleep(process.env.COMMENT_DELAY)
        }
    }

    log(`[${profile.username}] done with posting comments`, true)
}

async function sleep(millis) {
    let sec = Math.round(millis / 1000)
    log(`[ ${sec}s delay ] ...`, true)
    return new Promise(resolve => setTimeout(resolve, millis))
}

async function authAllProfiles() {
    let profiles = await db.getAllProfiles()
    for (const [i, profile] of profiles.entries()) {
        log(`Attempting to auth: ${profile.username} (${profile.steamId})`)
        let client = steamBot()
        await client.steamLogin(profile.username, profile.password, null, null, JSON.parse(profile.cookies))

        while (client.status !== 4 && !await client.isLoggedIn()) {
            let code = await promptForCode(profile.username, client)
            switch (client.status) {
                case 1:
                case 2:
                    await client.steamLogin(profile.username, profile.password, code, null)
                    break
                case 3:
                    await client.steamLogin(profile.username, profile.password, null, code)
                    break
            }
        }

        log(`[${profile.username}] Authorized`)

        let res = await syncWithRep4rep(client)
        if (res == true) {
            log(`[${profile.username}] Synced to Rep4Rep`, true)
        } else {
            log(`[${profile.username}] Failed to sync:`)
            log(res, true)
        }

        if (i !== profiles.length-1) {
            await sleep(process.env.LOGIN_DELAY)
        }
    }

    log(`authProfiles completed`)
}

async function syncWithRep4rep(client) {
    let steamId = await client.getSteamId()
    let steamProfiles = await api.getSteamProfiles()
    const exists = steamProfiles.some(steamProfile => steamProfile.steamId == steamId)

    if (!exists) {
        let res = await api.addSteamProfile(steamId)
        if (res.error) {
            return res.error
        }
    }
    return true
}

async function showAllProfiles() {
    let profiles = await db.getAllProfiles()
    let data = [
        ['steamId', 'username', 'lastComment']
    ]
    profiles.forEach(profile => {
        data.push([profile.steamId, profile.username, profile.lastComment])
    })
    
    console.log(table(data))
}

async function addProfileSetup(accountName, password, authCode, captcha) {
    let client = steamBot()

    await client.steamLogin(accountName, password, authCode, captcha);

    if (client.status !== 4 && !await client.isLoggedIn()) {
        let code = await promptForCode(accountName, client)
        switch (client.status) {
            case 1:
            case 2:
                await addProfileSetup(accountName, password, code, null)
                return
            case 3:
                await addProfileSetup(accountName, password, null, code)
                return
            default:
                process.exit()
        }
    }

    let res = await syncWithRep4rep(client)
    if (res == true) {
        log(`[${accountName}] Synced to Rep4Rep`, true)
    } else {
        log(`[${accountName}] Failed to sync:`)
        log(res, true)
    }
    
    log(`[${accountName}] Profile added`)
    process.exit()
}

async function removeProfile(username) {
    let res = await db.removeProfile(username)
    if (res.changes == 0) {
        log('profile not found', true)
    } else {
        log('profile removed', true)
    }
    process.exit()
}

async function promptForCode(username, client) {
    switch (client.status) {
        case 1:
            log(`[${username}] steamGuard code required  (${client.emailDomain})`)
            break
        case 2:
            log(`[${username}] steamGuardMobile code required`)
            break
        case 3:
            log(`[${username}] captcha required`)
            log(`URL: ${client.captchaUrl}`)
            break
        default:
            console.log('fatl?')
            console.log(client.status)
            process.exit()
    }

    let res =  await new Promise(resolve => {
        rl.question('>> ', resolve)
    })
    return res
}

export { log, statusMessage, showAllProfiles, addProfileSetup, authAllProfiles, removeProfile, autoRun }