var colors = require('colors');
var readLine = require('readline');
const sqlite3 = require('sqlite3').verbose();
var SteamCommunity = require('steamcommunity');
var community = new SteamCommunity();
const SteamID = require('steamid');
var config = require('./config.json');
const FormData = require('form-data');
const fetch = require('node-fetch');
var moment = require('moment');
moment().format();

var rl = readLine.createInterface({
	"input": process.stdin,
	"output": process.stdout
});


let db = new sqlite3.Database('./steamprofiles.db', (err) => {
    if (err) {
        console.log(err);
        process.exit();
    }
    createTables();
    homeMenu();
});

function createTables() {
    let tables = [
        `CREATE TABLE IF NOT EXISTS steamprofiles (
            id integer PRIMARY KEY AUTOINCREMENT,
            username varchar,
            steamId varchar UNIQUE,
            cookies text,
            token varchar,
            last_comment datetime
        )`,
    ];

    tables.forEach(query => {
        db.run(query, function(err) {
            if (err) {
                console.log(err);
                process.exit();
            }
        });
    });
}

function printHeader(headTitle = 'Home') {
    console.log('\x1Bc');
    let title = 'Rep4Rep Bot - ' + headTitle + '\n';
    console.log(title.bold.bgBlue);
}

function homeMenu(err = false) {
    printHeader();
    console.log('1) Auto Run');
    console.log('2) Manage Steam Accounts');
    console.log('CTRL + C to exit at any time.'.gray);
    if (err) { console.log(err.bold.red); }

    let validOptions = [1, 2];
    rl.question('>> ', function(chosenOption) {
        if (validOptions.includes(parseInt(chosenOption))) {
            switch (parseInt(chosenOption)) {
                case 1:
                    autoRun();
                    break;
                case 2:
                    profilesMenu();
                    break;
                default:
                    break;
            }
        } else {
            homeMenu('Invalid Option, Retry.');
        }
    });
}

async function profilesMenu(err = false) {
    printHeader('Manage Steam Accounts');

    let steamProfiles = await db_all('SELECT id, username, steamId, last_comment FROM steamprofiles');
    if (Object.keys(steamProfiles).length !== 0) {
        console.table(steamProfiles);
    } else {
        console.log('[ No Accounts added yet ]'.bold);
    }

    console.log();
    console.log('1) Add a Steam Account');
    console.log('2) Re-Login to a Steam Account');
    console.log('3) Remove a Steam Account');
    console.log('4) Back \n'.gray);
    if (err) { console.log(err.bold.red); }

    let validOptions = [1, 2, 3, 4];
    rl.question('>> ', function(chosenOption) {
        if (validOptions.includes(parseInt(chosenOption))) {
            switch (parseInt(chosenOption)) {
                case 1:
                    addSteamAccount();
                    break;
                case 2:
                    reloginSteamAccount();
                    break;
                case 3:
                    removeSteamAccount();
                    break;
                case 4:
                    homeMenu();
                    break;
                default:
                    break;
            }
        } else {
            profilesMenu('Invalid Option, Retry.');
        }
    });
}

async function db_all(query) {
    return new Promise(function(resolve,reject){
        db.all(query, function(err,rows){
           if(err){return reject(err);}
           resolve(rows);
         });
    });
}

async function isLoggedIn() {
    return new Promise(function(resolve,reject){
         community.loggedIn(function(err, loggedIn, familyView) {
             if(err){return reject(err);}
             resolve(loggedIn);
         });
    });
}

async function autoRun() {
    const response = await fetch('https://rep4rep.com/pub-api/user/steamprofiles?apiToken=' + config.apiToken);
    const data = await response.json();
    if (data.error) {
        homeMenu(data.error);
        return;
    }

    // hella nasty
    let repSteamProfiles = [];
    let repSteamProfilesObj = {};
    data.forEach((steamProfile) => {
        repSteamProfiles.push(steamProfile.steamId);
        repSteamProfilesObj[steamProfile.steamId] = steamProfile.id;
    });

    let steamProfiles = await db_all('SELECT id, username, steamId, last_comment, cookies, token FROM steamprofiles');
    if (Object.keys(steamProfiles).length == 0) {
        homeMenu('No local steam accounts added to comment from.');
        return;
    }

    for (const steamProfile of steamProfiles) {
        // if profile doesnt exist on rep4rep add it
        if (!repSteamProfiles.includes(steamProfile.steamId)) {
            console.log('account not added on rep4rep!!');
            let form = new FormData();
            form.append('apiToken', config.apiToken);
            form.append('steamProfile', steamProfile.steamId);
            const response = await fetch('https://rep4rep.com/pub-api/user/steamprofiles/add', {
                method: 'post',
                body: form
            });
            const data = await response.json();
            if (data.error) {
                homeMenu(data.error);
                return;
            }

            console.log(steamProfile.username + ' added to rep4rep.');
            autoRun(); // hella nasty, fix later
            return;
        }

        let hours = moment().diff(moment(steamProfile.last_comment), 'hours');
        if (hours >= 24 || !steamProfile.last_comment) {
            console.log('attempting to leave comments from: ' + steamProfile.username);
            console.log('[ 10 sec delay between each comment ]'.bold.cyan);

            community.setCookies(JSON.parse(steamProfile.cookies));
            community.oAuthToken = steamProfile.token;
            let loggedIn = await isLoggedIn();

            if (!loggedIn) {
                console.log(steamProfile.username + ' is logged out, re-login from the manage profiles view.'.bold.red);
                continue;
            }

            // fetch available tasks  (30)
            const response = await fetch('https://rep4rep.com/pub-api/tasks?apiToken=' + config.apiToken + '&steamProfile=' + repSteamProfilesObj[steamProfile.steamId]);
            const data = await response.json();
            if (data.error) {
                homeMenu(data.error);
                return;
            }

            let failedAttempts = 0;
            for (const task of data ) {
                if (failedAttempts == 2) {
                    console.log('failed twice, skipping steamProfile.'.bold.yellow); // aka completed/steam limited for today
                    break;
                }

                console.log(steamProfile.username + ' -> ' + task.targetSteamProfileName + ' | ' + task.requiredCommentText);

                await community.postUserComment(task.targetSteamProfileId, task.requiredCommentText, async function(err) {
                    if (err) {
                        console.log(err.message);
                        failedAttempts++;
                    } else {
                        console.log('posted comment successfully.'.bold.green);

                        db.run(`UPDATE steamprofiles SET last_comment=DATETIME('now', 'localtime') WHERE id=?`, [steamProfile.id], function(err) {
                          if (err) {
                            console.log(err.message);
                            process.exit();
                          }
                        });

                        // mark task as complete
                        let form = new FormData();
                        form.append('apiToken', config.apiToken);
                        form.append('taskId', task.taskId);
                        form.append('commentId', task.requiredCommentId);
                        form.append('authorSteamProfileId', repSteamProfilesObj[steamProfile.steamId]);

                        const response = await fetch('https://rep4rep.com/pub-api/tasks/complete', {
                            method: 'post',
                            body: form
                        });
                        const data = await response.json();
                        if (data.error) {
                            console.log(data.error);
                            process.exit();
                        }
                        console.log(data.info ?? data.success);
                    }
                });
                await sleep(10000);
            }
        } else {
            console.log(steamProfile.username.bold.cyan + ' not ready yet. Try again in: ' + (24-hours).toString().bold.red + ' hours.');
            continue;
        }
    }
    console.log('Done with Auto Run, Exiting.'.bold.green);
    process.exit();
}

async function sleep(millis) {
    return new Promise(resolve => setTimeout(resolve, millis));
}

async function addSteamAccount(err = false) {
    printHeader('Add a Steam Account');
    if (err) { console.log(err.bold.red); }
    rl.question("Steam Login Username: ", function(accountName) {
    	rl.question("Password: ", function(password) {
    		doLogin(accountName, password);
    	});
    });
}

async function reloginSteamAccount() {
    rl.question("Steam Login Username: ", function(accountName) {
    	rl.question("Password: ", function(password) {
    		doLogin(accountName, password);
    	});
    });
}

async function removeSteamAccount() {
    rl.question("Username or id to remove: ", function(accountName) {
        db.run(`DELETE FROM steamprofiles WHERE id = ? OR username = ?`, [accountName, accountName], function(err) {
          if (err) {
            console.log(err.message);
            process.exit();
          }
          profilesMenu('Steam Account Removed! (if it was found)');
        });
    });
}

function doLogin(accountName, password, authCode, twoFactorCode, captcha) {
	community.login({
		"accountName": accountName,
		"password": password,
		"authCode": authCode,
		"twoFactorCode": twoFactorCode,
		"captcha": captcha
	}, function(err, sessionID, cookies, steamguard, oauthToken) {
		if(err) {
			if(err.message == 'SteamGuardMobile') {
				rl.question("Steam Authenticator Code: ", function(code) {
					doLogin(accountName, password, null, code);
				});

				return;
			}

			if(err.message == 'SteamGuard') {
				console.log("An email has been sent to your address at " + err.emaildomain);
				rl.question("Steam Guard Code: ", function(code) {
					doLogin(accountName, password, code);
				});

				return;
			}

			if(err.message == 'CAPTCHA') {
				console.log(err.captchaurl);
				rl.question("CAPTCHA: ", function(captchaInput) {
					doLogin(accountName, password, authCode, twoFactorCode, captchaInput);
				});

				return;
			}

            profilesMenu(err.message);
			return;
		}

		console.log("Logged on!");

        steamId64 = community.steamID.getSteamID64();
        db.run(`INSERT OR REPLACE INTO steamprofiles (username, steamId, cookies, token) VALUES (?, ?, ?, ?)`, [accountName, steamId64, JSON.stringify(cookies), oauthToken], function(err) {
          if (err) {
            console.log(err.message);
            process.exit();
          }
          profilesMenu('Steam Account added! (or updated)');
        });
	});
}
