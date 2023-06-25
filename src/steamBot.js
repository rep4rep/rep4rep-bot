import SteamCommunity from 'steamcommunity'
import db from './db.js'

export default (config) => {
    var client = {
        status: 0,
        captchaUrl: null,
        emailDomain: null 
    }

    var community = new SteamCommunity()


    client.isLoggedIn = async () => {
        return new Promise(function(resolve,reject){
            community.loggedIn(function(err, loggedIn, familyView) {
                if(err){return reject(err)}
                resolve(loggedIn);
            })
       })
    }

    client.getSteamId = async () => {
        return community.steamID.getSteamID64()
    }

    client.postComment = async (steamId, commentText) => {
        return new Promise((resolve, reject) => {
            community.postUserComment(steamId, commentText, async (err) => {
                if (err) {
                    reject(err)
                }
                resolve()
            })

        })
    }

    client.steamLogin = async (accountName, password, authCode, twoFactorCode, captcha, cookies) => {
        if (cookies) {
            community.setCookies(cookies)
        }
        return new Promise((resolve, reject) => {
            community.login({
                accountName: accountName,
                password: password,
                authCode: authCode,
                twoFactorCode: twoFactorCode,
                captcha: captcha
            }, async (err, sessionID, cookies, steamguard) => {
                if (err) {
                    switch (err.message) {
                        case 'SteamGuard':
                            client.status = 1
                            client.emailDomain = err.emaildomain
                            resolve()
                            break
                        case 'SteamGuardMobile':
                            client.status = 2
                            resolve()
                            break
                        case 'CAPTCHA':
                            client.status = 3
                            client.captchaUrl = err.captchaurl
                            resolve()
                            break
                        default:
                            console.log(err)
                            reject(err)
                    }
                } else {
                    await db.addOrUpdateProfile(accountName, password, community.steamID.getSteamID64(), cookies)
                    client.status = 4
                    resolve()
                }
                }
            )
        })


    }


    return client
}