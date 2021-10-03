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
    console.log('2) Remove a Steam Account');
    console.log('3) Back \n'.gray);
    if (err) { console.log(err.bold.red); }

    let validOptions = [1, 2, 3];
    rl.question('>> ', function(chosenOption) {
        if (validOptions.includes(parseInt(chosenOption))) {
            switch (parseInt(chosenOption)) {
                case 1:
                    addSteamAccount();
                    break;
                case 2:
                    removeSteamAccount();
                    break;
                case 3:
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
