const {app, BrowserWindow, ipcMain, webContents} = require('electron');
const isDev = require('electron-is-dev');
const axios = require('axios');
const CHANNEL_NAME = 'nickyrobbot'
const WHITELIST_ENABLED = true;
const FIVE_ROUND_REQ = true;
var Datastore = require('nedb'), db = new Datastore({ filename: `${CHANNEL_NAME}.db`, autoload: true });
const tmi = require('tmi.js');
const path = require("path")
const {promisify} = require('util');

var cg_links_counter = [];
var pastebin_links_counter = []
const readdir = promisify(require('fs').readdir)

const opts = {
    connection: {
        reconnect: true,
        secure: true,
    },
    options: {
        debug: isDev
    },
    channels: [CHANNEL_NAME]
};
const ACCEPTABLE_MAPS = [
    'A Diverse World', 
    'A Rural World', 
    'An Improved World', 
    'North America', 
    'Urbanguessr',
    'Europe',
    'AI Generated World',
    'Asia',
    'South America',
    'Oceania',
    'Africa'
    ]
const PASTEBIN_AUTHORIZED = [
    `nickyrobbot`,
]

const client = new tmi.client(opts);

client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

function loadNewTournament(tournamentName) {
    db = new Datastore({ filename: `${tournamentName}`, autoload: true });
    sendTables()
    
    sendTournaments()
}

let win;
function createWindow () {
  win = new BrowserWindow({
    width: 1100, height: 1080, transparent: false, 
    webPreferences: { // <--- (1) Additional preferences
      nodeIntegration: true,
      contextIsolation: false,
  }});
win.loadURL(isDev ? 'http://localhost:3000' : `file://${path.join(__dirname, "../build/index.html")}`); // <--- (3) Loading react
win.removeMenu(true)
if (isDev) {
    win.webContents.openDevTools({mode: "detatch"});
}
win.on('closed', () => {  
    win = null
  });
};
app.on('ready', () => {
    createWindow();
    client.connect();
    win.webContents.on('did-finish-load', () => {
        sendCurrent();
        sendDone();
        sendName();
        sendTournaments();
    })
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
});
app.on('activate', () => {
  if (win === null) {
    createWindow()
  }
});

async function onMessageHandler(target, context, msg, self) {
    if (msg.includes("Game summary:")) {
        let split_msg = msg.split(" ");
        for (let i = 0; i < split_msg.length; i++) {
            console.log(split_msg)
            if (split_msg[i].includes("chatguessr.com/game/")) {
                let ln_code = split_msg[i].replace("chatguessr.com/game/", '');
                if (!cg_links_counter.includes('ln_code')) {
                    await handleLink();
                    sendDone();
                } 
            }

        }
    }
    if (msg.includes('!pastebin')) {
        if (checkPastebin(msg, context)) {
            let split_msg = msg.split(" ");
            for (let i = 0; i < split_msg.length; i++) {
                if (split_msg[i].includes(`https://pastebin.com/`)) {
                    let link_code = split_msg[i].replace('https://pastebin.com/', '');
                    await handlePastebin(link_code);
                }
            }
        } else {
            console.log('failed')
        }
    }
    if (msg.toLowerCase().includes('!geoprofile')) {

    }

    
}
function checkPastebin(msg, context) {
    if (!msg.includes(`https://pastebin.com/`)) {
        return false;
    } else 
    if (!PASTEBIN_AUTHORIZED.includes(context["display-name"])){
        return false;
    } else {
        console.log("passed")
        return true;
    }
}

function onConnectedHandler(addr, port) {
    if (isDev) {
        console.log(`* Connected to ${addr}:${port}`);
    } 

}
function sendTables() {
    db.find({}, (err, docs) => {
        win.webContents.send('tables', docs);
    })  
}
async function sendTournaments() {
    let file_list = await readdir('./')
    let ret_fl = []
   
    for (let i = 0; i < file_list.length; i++) {
        if (file_list[i].includes('.db')) {
            let obj = {
                name: file_list[i]
            }
            ret_fl.push(obj);
        }
    }
    
    win.webContents.send("tournaments", ret_fl)
}
function sendCurrent() {
    win.webContents.send('currentTournament', CHANNEL_NAME)
}
function sendDone() {
    win.webContents.send('dataDone', "done");
}
function sendName() {
    win.webContents.send('channelName', CHANNEL_NAME);
}
ipcMain.on('giveme', (event, arg) => {
    sendTables();
    sendName();
    
}); 
ipcMain.on('delete-pgame', (event, args) => {
    console.log(`** Deleting record for user ${args.username}, map code: ${args.game_id}`)
    handleDelete(args);
});
ipcMain.on('sendTournament', (event, args) => {
    loadNewTournament(args);
    
})

function handleDelete(delete_info) {
    let new_vpc = delete_info.scoreInfo.vpc - 1;
    let new_tgs = delete_info.scoreInfo.total - delete_info.score;
    let new_average = new_tgs / new_vpc;
    db.find({games:{$elemMatch: {game_id: delete_info.game_id}}}, (err, docs) => {
        let deleted_position = delete_info.placement;
        for (let i = 0; i < docs.length; i++) {
            let oGamesPlayed = docs[i].games_played;
            let oTotalGameScore = docs[i].total_game_score;
            let ocum_dist_from_mean = docs[i].cum_dist_from_mean;
            let oavg_dist_from_mean;
            let oWins = docs[i].wins;
            let oPoints = docs[i].points;
            let oUmoScore = docs[i].umo_score;
            if (docs[i].username == delete_info.username) {
                console.log(`${docs[i].username} is having their information updated (deleted record)`);
                oGamesPlayed -= 1;
                oTotalGameScore -= delete_info.score;
                ocum_dist_from_mean -= delete_info.dist_from_mean;
                oavg_dist_from_mean = oGamesPlayed > 0 ? ocum_dist_from_mean / oGamesPlayed : 0;
                oPoints -= getScoreMarioKart(delete_info.placement-1);
                oUmoScore -= getScoreUmo(delete_info.placement-1);
                db.update({username: delete_info.username}, {$pull: {games: {game_id: delete_info.game_id}}}, {returnUpdatedDocs: true}, 
                    (err, numReplaced, affectedDocuments, upsert) => {
                        console.log(`Affected Documents: ${JSON.stringify(affectedDocuments)}`)
                        db.update({username: delete_info.username}, 
                            {
                                username: docs[i].username,
                                games_played: oGamesPlayed,
                                games: affectedDocuments.games,
                                total_game_score: oTotalGameScore,
                                cum_dist_from_mean: ocum_dist_from_mean,
                                avg_dist_from_mean: oavg_dist_from_mean,
                                points: oPoints,
                                wins: delete_info.placement == 1? oWins-1 : oWins,
                                umo_score : oUmoScore,
                            },
                            {},
                            (err, numReplaced) => {
        
                            });
                    });
                

            } else {
                console.log(`${docs[i].username} is having their information updated (not the deleted record)`);
                let oGames = docs[i].games;
                let bgIndex;
                let pGameInfo = oGames.find((game, index) => {
                    if(game.game_id == delete_info.game_id) {
                        bgIndex = index;
                        return true;
                    }
                });
                pGameInfo.scoreInfo = {
                    vpc: new_vpc,
                    avgScore: new_average,
                    total: new_tgs,
                }
                oUmoScore -= getScoreUmo(pGameInfo.placement-1);
                oPoints -= getScoreMarioKart(pGameInfo.placement-1);
                let preChangePlacement = pGameInfo.placement;
                if (pGameInfo.placement >= deleted_position) {
                    pGameInfo.placement -= 1;
                }
                if (preChangePlacement != 1 && pGameInfo.placement == 1) {
                    oWins += 1;
                }
                oPoints += getScoreMarioKart(pGameInfo.placement-1);
                oUmoScore += getScoreUmo(pGameInfo.placement-1);
                ocum_dist_from_mean -= pGameInfo.dist_from_mean;
                ocum_dist_from_mean += getDistFromMean(pGameInfo.score, new_average);
                oavg_dist_from_mean = ocum_dist_from_mean / oGamesPlayed;
                
                pGameInfo.dist_from_mean = getDistFromMean(pGameInfo.score, new_average);

                oGames[bgIndex] = pGameInfo;

                db.update({username: docs[i].username}, 
                    {
                        username: docs[i].username,
                        games_played: oGamesPlayed,
                        games: oGames,
                        total_game_score: oTotalGameScore,
                        cum_dist_from_mean: ocum_dist_from_mean,
                        avg_dist_from_mean: oavg_dist_from_mean,
                        points: oPoints,
                        wins: oWins,
                        umo_score: oUmoScore,
                    },
                    {},
                    (err, numReplaced) => {
        
                    });
                
            }
        }
    });
    sendTables();
}

async function handleData(res, link_code) {
    var game_info = getGameInfo(res.data, link_code);
    // UPDATE ALL RECORDS
    let finished = 0;
    if (roundIsValid(game_info.map)) {
        console.log(`** Round is valid (map = ${game_info.map})`);
        for (let i = 0; i < res.data.players.length; i++) {
            if (playerIsValid(res.data.players[i])) {
                if (isDev) {
                    console.log(`** Player ${res.data.players[i].username} is valid (5 Rounds)`)
                }
                
                let won = i == 0 ? 1 : 0
                let pObj = Object.assign({}, game_info);
                pObj.dist_from_mean = getDistFromMean(res.data.players[i].score, game_info.scoreInfo.avgScore);
                pObj.placement = i+1;
                pObj.score = res.data.players[i].score;
                pObj.username = res.data.players[i].username;
                db.findOne({username: res.data.players[i].username}, (err, docs) => {

                    if (err) {
                        console.log(`** Error: ${err}`);
                    }
                    if (docs == null) {
                        let new_doc = {
                            username: res.data.players[i].username,
                            games_played: 1,
                            games: [pObj],
                            total_game_score: res.data.players[i].score,
                            cum_dist_from_mean: pObj.dist_from_mean,
                            avg_dist_from_mean: pObj.dist_from_mean,
                            points: getScoreMarioKart(i),
                            wins: won,
                            umo_score: getScoreUmo(i)
                        }
                        db.insert(new_doc, (err, docs) => {
                            finished += 1;
                        });
                    } else {
                        let _games = docs.games;
                        let _points = docs.points;
                        let _games_played = docs.games_played;
                        let _total_game_score = docs.total_game_score;
                        let _cum_dist_from_mean = docs.cum_dist_from_mean;
                        let _avg_dist_from_mean = docs.avg_dist_from_mean;
                        let _wins = docs.wins
                        let _umo_score = docs.umo_score;
                        _games.unshift(pObj);
                        _points = _points + getScoreMarioKart(i);
                        _games_played += 1;
                        _total_game_score += res.data.players[i].score;
                        _cum_dist_from_mean += pObj.dist_from_mean;
                        _avg_dist_from_mean = _cum_dist_from_mean/_games_played; 
                        _wins += won;
                        _umo_score = _umo_score + getScoreUmo(i);
                        db.update({username: res.data.players[i].username}, 
                            {
                                username: res.data.players[i].username,
                                games_played: _games_played,
                                games: _games,
                                total_game_score: _total_game_score,
                                points: _points,
                                cum_dist_from_mean: _cum_dist_from_mean,
                                avg_dist_from_mean: _avg_dist_from_mean,
                                wins: _wins,
                                umo_score: _umo_score,
                            }, {}, (err, numReplaced) => {
                                
                            });
                    }
                });
            } else {
                if(isDev) {
                    console.log(`** Player ${res.data.players[i].username} is invalid. Only ${res.data.players[i].rounds} played.`)
                }
                
            } 
        }
    } else {
        if(isDev) {
            console.log(`** map '${game_info.map}' not on allow-list. No data Logged.`);
        }
        
    }

    sendDone();
}

async function handlePastebin(link_code) {
    console.log(`*** link code: ${link_code} ***`);
    var res = await axios.get(`https://pastebin.com/raw/${link_code}`);
    console.log(res.data)
}
async function handleLink(link_code) {
    console.log(`*** link code: ${link_code} ***`);
    var res = await axios.get(`https://chatguessr-api.vercel.app/game/${link_code}`);
    handleData(res, link_code)
}
function getDistFromMean(score, mean) {
    return score-mean;
}
function roundIsValid(map) {
    if (WHITELIST_ENABLED) {
        if (ACCEPTABLE_MAPS.includes(map)) {
            return true;
        } else {
            return false;
        }
    } else {
        return true;
    }

}

function playerIsValid(player) {
    if (FIVE_ROUND_REQ) {
        if (player.rounds == 5) {
            return true;
        } else {
            return false;
        }
    } else {
        return true;
    }
}
function getGameInfo(game_obj, link) {
    ret_obj = {
        map: game_obj.map,
        game_id: link,
        scoreInfo: getGameScoreInfo(game_obj.players)
    }
    return ret_obj;
}
function getTGS(players_list) {
    
}
function getGameScoreInfo(players_list) {
    let total = 0;
    let validPlayerCount = 0;
    for (let i = 0; i < players_list.length; i++) {
        if (playerIsValid(players_list[i])) {
            total += players_list[i].score
            validPlayerCount += 1;
        }
    }
    let ret_obj = {
        vpc: validPlayerCount,
        avgScore: total/validPlayerCount,
        total: total,
    }
    return ret_obj;
}
function getScoreMarioKart(index) {
    let ret = 0;
    switch (index) {
        case 0:
            ret = 15;
            break;
        case 1:
            ret = 12;
            break;
        default:
            if (index < 11) {
                ret = 12 - index;
            }

    }
    return ret;
}
function getScoreUmo(index) {
    let ret = 0;
    switch(index) {
        case 0:
            ret = 4;
            break;
        case 1:
            ret = 2;
            break;
        case 2:
            ret = 1;
        default:
            ret = 0;
    }
    return ret;
}