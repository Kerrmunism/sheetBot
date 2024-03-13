const Discord = require('discord.js');
const client = new Discord.Client({ intents: ["GUILDS", "GUILD_MESSAGES"] })
const axios = require('axios').default; // This handles URL loads / page calls
const readline = require('readline');
const { MessageEmbed } = require('discord.js');
const { table, getBorderCharacters } = require('table')
const QuickChart = require('quickchart-js');
const fs = require('fs'); // Allows node.js to use the file system.
const { ClientRequest } = require('http');
const config = JSON.parse(fs.readFileSync("./config.json", "utf-8"))
const { sheetBotHelper } = require('./modules/help')

var generalChannel = config.generalChannelID

var prefixes = {};

var apmweight = 1 // All of the below are weights to do with the versus graph area and the area stat.
var ppsweight = 45
var vsweight = 0.444
var appweight = 185
var dssweight = 175
var dspweight = 450
var dsappweight = 140
var vsapmweight = 60
var ciweight = 1.25
var geweight = 315

var apmsrw = 0 // All of the below are weights for the stat rank (or sr) stat and the esttr / estglicko variables.
var ppssrw = 135
var vssrw = 0
var appsrw = 290
var dsssrw = 0
var dspsrw = 700
var garbageeffisrw = 0

var playerCount = 0 // The total ranked player count, not including averages or unranked.
var unrankedCount = 0 // The total number of unranked players grabbed from the unranked players list.
var tawsPrefix = "s!"

let latamCountries = ["AR", "BO", "BR", "CL", "CO", "CR", "CU", "DO", "EC", "SV", "GT", "HN", "MX", "NI", "PA", "PY", "PE", "PT", "PR", "UY", "VE"]
let euCountries = ["AD", "AL", "AM", "AT", "AZ", "BE", "BG", "BY", "CH", "CY", "CZ", "DE", "DK", "EE", "ES", "EU", "FO", "FI", "FR", "GE", "GI", "GG", "GB", "GB-ENG", "GB-NIR", "GB-SCT", "GB-WLS", "GR", "HR", "HU", "IE", "IM", "IS", "IT", "JE", "LI", "LT", "LU", "LV", "MC", "ME", "MD", "MT", "NL", "NO", "NZ", "PL", "PT", "RO", "RU", "SE", "SI", "SM", "SR", "TR", "UA", "VA", "XK"]

const unrankedPlayers = './unrankedPlayers.txt' // Holds all of the unranked players
const prefixFile = "./prefix.txt" // Holds the prefix used for TAWS.

var pList = [] // The list of all players (including unranked, not including average players.)
var avgPlayers = [] // Choosing to store these separately because of commands like !lb that'll try to go through all players.
// You could just stick it at the end of pList though most likely.
var rankArray = ["x", "u", "ss", "s+", "s", "s-", "a+", "a", "a-", "b+", "b", "b-", "c+", "c", "c-", "d+", "d", "z"]
// Array of the ranks, in order


class Player {
  constructor(name, apm, pps, vs, tr, glicko, rd, data) {
    /* 
    I originally wanted to include two different constructors for this, one that uses data and one that doesn't, but
    I discovered that JS doesn't support it :/
    There's hacky ways to get around it but eh, whatever.
    */
    this.name = name
    this.apm = Number(apm) // We define these as numbers here because if we do something like name[0] later on to fill
    // these in, it will assume that it's a string since name is an array of strings. This changes it to a number.
    this.pps = Number(pps)
    this.vs = Number(vs)
    this.tr = tr
    this.glicko = glicko
    this.rd = rd
    this.app = (this.apm / 60 / this.pps)
    this.dss = (this.vs / 100) - (this.apm / 60)
    this.dsp = this.dss / this.pps
    this.dsapp = this.dsp + this.app
    this.vsapm = (this.vs / this.apm)
    this.ci = (this.dsp * 150) + ((this.vsapm - 2) * 50) + ((0.6 - this.app) * 125)
    this.ge = ((this.app * this.dss) / this.pps) * 2
    this.wapp = (this.app - 5 * Math.tan(((this.ci / -30) + 1) * Math.PI / 180))
    this.area = this.apm * apmweight + this.pps * ppsweight + this.vs * vsweight + this.app * appweight + this.dss * dssweight + this.dsp * dspweight + this.ge * geweight
    this.srarea = (this.apm * apmsrw) + (this.pps * ppssrw) + (this.vs * vssrw) + (this.app * appsrw) + (this.dss * dsssrw) + (this.dsp * dspsrw) + (this.ge * garbageeffisrw)
    this.sr = (11.2 * Math.atan((this.srarea - 93) / 130)) + 1
    if (this.sr <= 0) {
      this.sr = 0.001
    }
    //this.estglicko = (4.0867 * this.srarea + 186.68)
    this.estglicko = (0.000013 * (((this.pps * (150 + ((this.vsapm - 1.66) * 35)) + this.app * 290 + this.dsp * 700)) ** 3) - 0.0196 * (((this.pps * (150 + ((this.vsapm - 1.66) * 35)) + this.app * 290 + this.dsp * 700)) ** 2) + (12.645 * ((this.pps * (150 + ((this.vsapm - 1.66) * 35)) + this.app * 290 + this.dsp * 700))) - 1005.4)
    this.esttr = 25000 / (1 + 10 ** (((1500 - this.estglicko) * Math.PI) / (Math.sqrt(((3 * Math.log(10) ** 2) * 60 ** 2) + (2500 * ((64 * Math.PI ** 2) + (147 * Math.log(10) ** 2)))))))
    //this.esttr = Number(Number(25000 / (1 + (10 ** (((1500 - ((4.0867 * this.srarea + 186.68))) * 3.14159) / (((15.9056943314 * (this.rd ** 2) + 3527584.25978) ** 0.5)))))).toFixed(2))
    // ^ Estimated TR
    this.atr = this.esttr - this.tr // Accuracy of TR Estimate
    //this.aglicko = this.estglicko - this.glicko
    this.opener = Number(Number(Number((((this.apm / this.srarea) / ((0.069 * 1.0017 ** ((this.sr ** 5) / 4700)) + this.sr / 360) - 1) + (((this.pps / this.srarea) / (0.0084264 * (2.14 ** (-2 * (this.sr / 2.7 + 1.03))) - this.sr / 5750 + 0.0067) - 1) * 0.75) + (((this.vsapm / (-(((this.sr - 16) / 36) ** 2) + 2.133) - 1)) * -10) + ((this.app / (0.1368803292 * 1.0024 ** ((this.sr ** 5) / 2800) + this.sr / 54) - 1) * 0.75) + ((this.dsp / (0.02136327583 * (14 ** ((this.sr - 14.75) / 3.9)) + this.sr / 152 + 0.022) - 1) * -0.25)) / 3.5) + 0.5).toFixed(4))
    this.plonk = Number(Number((((this.ge / (this.sr / 350 + 0.005948424455 * 3.8 ** ((this.sr - 6.1) / 4) + 0.006) - 1) + (this.app / (0.1368803292 * 1.0024 ** ((this.sr ** 5) / 2800) + this.sr / 54) - 1) + ((this.dsp / (0.02136327583 * (14 ** ((this.sr - 14.75) / 3.9)) + this.sr / 152 + 0.022) - 1) * 0.75) + (((this.pps / this.srarea) / (0.0084264 * (2.14 ** (-2 * (this.sr / 2.7 + 1.03))) - this.sr / 5750 + 0.0067) - 1) * -1)) / 2.73) + 0.5).toFixed(4))
    this.stride = Number(Number((((((this.apm / this.srarea) / ((0.069 * 1.0017 ** ((this.sr ** 5) / 4700)) + this.sr / 360) - 1) * -0.25) + ((this.pps / this.srarea) / (0.0084264 * (2.14 ** (-2 * (this.sr / 2.7 + 1.03))) - this.sr / 5750 + 0.0067) - 1) + ((this.app / (0.1368803292 * 1.0024 ** ((this.sr ** 5) / 2800) + this.sr / 54) - 1) * -2) + ((this.dsp / (0.02136327583 * (14 ** ((this.sr - 14.75) / 3.9)) + this.sr / 152 + 0.022) - 1) * -0.5)) * 0.79) + 0.5).toFixed(4))
    this.infds = Number(Number((((this.dsp / (0.02136327583 * (14 ** ((this.sr - 14.75) / 3.9)) + this.sr / 152 + 0.022) - 1) + ((this.app / (0.1368803292 * 1.0024 ** ((this.sr ** 5) / 2800) + this.sr / 54) - 1) * -0.75) + (((this.apm / this.srarea) / ((0.069 * 1.0017 ** ((this.sr ** 5) / 4700)) + this.sr / 360) - 1) * 0.5) + ((this.vsapm / (-(((this.sr - 16) / 36) ** 2) + 2.133) - 1) * 1.5) + (((this.pps / this.srarea) / (0.0084264 * (2.14 ** (-2 * (this.sr / 2.7 + 1.03))) - this.sr / 5750 + 0.0067) - 1) * 0.5)) * 0.9) + 0.5).toFixed(4))
    if (data != null) { // If we have the individual data for this player...
      // Assign all of it
      this.id = data._id
      this.rank = data.league.rank
      //this.percent_rank = data.league.percentile_rank // Pretty much just used for !avg
      this.country = data.country
      this.games = data.league.gamesplayed
      this.wins = data.league.gameswon
      this.wr = (this.wins / this.games) * 100 // TL winrate
      this.avatar = data.avatar_revision
      // this.position = pList.map(pList => pList.name).indexOf(this.name)
      // The above works but it was horrifically slow.
    } else { // Otherwise...
      // Put dummy data in.
      this.id = -1
      this.rank = null
      this.position = pList.length + 1
      this.country = null // In-game country (conv to string to prevent null error)
      this.games = -1 // TL games played
      this.wins = -1 // TL wins
      this.wr = -1 // TL winrate
    }
  }
}

client.on('ready', () => {
  console.log("Connected as " + client.user.tag);
  //console.log(Discord.version)
  client.user.setActivity("Loading...")
})
async function getData() { // Load the initial data. This is used for !lb, !avg, !ac, basically anything where you need a lot of players.
  try {
    let res = await axios({
      url: 'https://ch.tetr.io/api/users/lists/league/all', // Call the link that has all the ranked league players in it.
      method: 'get',
    })
    // Don't forget to return something   
    var value = (res.data)
    console.log("Data fetched!")
    return value
  }
  catch (err) { // Error catching.
    console.error(err);
  }
}

getData() // Call the getData function
  .then(value => assign(value)) // Actually do something with the data you've grabbed after you've grabbed it.

async function assign(value) { // This assigns all the data that you've loaded to the different variables.
  let generalChannelLocal = generalChannel // Set the general channel.
  playerCount = value.data.users.length // Set the search length to the number of ranked users.
  console.log("Assign data is running.")
  for (let i = 0; i < playerCount; i++) {
    if (value.data.users[i].league.apm != null) { // If the player's APM isn't null (meaning they exist and aren't banned somehow)
      var tmp = new Player(value.data.users[i].username.replace(/['"]+/g, ''), // Make a new player by passing the following
        value.data.users[i].league.apm, // APM 
        value.data.users[i].league.pps, // PPS
        value.data.users[i].league.vs, // VS
        value.data.users[i].league.rating, // TR
        value.data.users[i].league.glicko, // Glicko
        value.data.users[i].league.rd, // RD
        value.data.users[i] // The whole of the data for each user.
      )
      // Then add the following to the class for each player since they aren't built in.
      tmp.position = i + 1 // Position on the TL leaderboard
      pList.push(tmp) // Push this player to the player list.
    } else { // Otherwise, remove them from the list entirely and decrement the loop.
      value.data.users.splice(i, 1);
      playerCount -= 1;
      i -= 1;
    }
  }
  console.log(pList.map(pList => pList.apm))
  console.log(pList.map(pList => pList.country))
  fs.writeFile("./stats/all.txt", JSON.stringify(pList), (err) => { if (err) throw err; })
  w("apm"); w("pps"); w("vs"); w("app"); w("dsp"); w("dss"); w("dsapp"); w("vsapm"); w("glicko"); w("area"); w("srarea"); w("estglicko"); w("atr"); w("position"); w("estglicko"); //w("aglicko") // Log a bunch of stats
  console.log(g("pps"))
  fetchUnranked()
}

function w(stat) { // w for write This is simply a conveinient shorthand. 
  fs.writeFile("./stats/" + stat + ".txt", pList.map(pList => pList[stat]).join("\n"), (err) => { if (err) throw err; })
}

function g(stat) { // g for grab or give.
  return pList.map(pList => pList[stat])
}

async function fetchUnranked() { // Fetch the unranked players based on unrankedPlayers.txt

  var ids = []
  var contents = []
  var nameList = []
  var skip = 2
  const rl = readline.createInterface({
    input: fs.createReadStream(unrankedPlayers),
    output: process.stdout,
    terminal: false
  });
  for await (const line of rl) {
    if (skip == 1 || skip == 2) {
      ids.push(line + "\n") // Add this to the end of the ID array. The ID array holds all the IDs of the players.
    }
    if (skip == 0 || skip == 2) {
      nameList.push(line + "\n") // Add this to the end of the nameList array. The nameList array holds the names of all the players.
    }
    contents.push(line + "\n") // For the contents as a whole, add both the IDs and names.
    if (skip == 1) { // A simple switch back-and-forth toggle.
      skip = 0
    } else {
      skip = 1
    }
  }
  // nameList.splice(0, 1);
  const promises = [];
  for (let i = 0; i < Number(ids.length); i++) { // Loop through the list and grab stats using the same method as before.
    if (i != 0) {
      try {
        promises.push(axios({
          url: 'https://ch.tetr.io/api/users/' + String(ids[i]),
          method: 'get',
        }))
      }
      catch (err) { // In case the data fails to load for whatever reason.
        console.error(err);
      }
    }
  }

  const results = await Promise.allSettled(promises);
  for (let y = 0; y < results.length; ++y) {
    try {

      const result = results[y];
      if (result.status == "rejected") {
        console.error(result.reason);
        continue;
      }
      let res = result.value;
      value = (res.data);
      let i = y + 1;
      // This basically does the same thing as the assign function, but for unranked players.
      if (value.success == false || value.data.user.league.rank != "z" || value.data.user.league.apm == null) { // If the user is no longer unranked
        // or is banned / deleted
        // if (i > -1) {
        console.log(nameList[i] + " (" + i + ", with id:" + ids[i - 1] + " ) was removed!\nTheir rank is: " + value.data.user.league.rank + ", and their apm is " + value.data.user.league.apm)
        nameList.splice(i, 1)
        ids.splice(i - 1, 1)
        contents.splice((i * 2) - 1, 2)
        results.splice(i - 1, 1);
        fs.writeFile(unrankedPlayers, contents.join(""), (err) => { if (err) throw err; })
        y -= 1;
        continue;
        // }
      }
      console.log(nameList[i])
      var tmp = new Player(value.data.user.username, // Make a new player by passing the following
        value.data.user.league.apm, // APM 
        value.data.user.league.pps, // PPS
        value.data.user.league.vs, // VS
        value.data.user.league.rating, // TR
        value.data.user.league.glicko, // Glicko
        value.data.user.league.rd, // RD
        value.data.user // The whole of the data for the player.
      )
      tmp.position = 0
      pList.push(tmp)
      // Since we have the whole data being sent, no need to add the things that aren't automatically included.
      unrankedCount += 1; // Then add one to the unranked player count
    }
    catch (e) { // In case the data fails to load for whatever reason.
      console.error(e);
    }
  }
  loadPrefixes();
}

async function loadPrefixes() {
  const prefixData = fs.readFileSync("./prefix.json", "utf-8");
  prefixes = JSON.parse(prefixData);

  taws(); // The taws function is probably not needed anymore. but just in case i'll keep it here.
}

async function taws() {
  const read = readline.createInterface({
    input: fs.createReadStream(prefixFile),
    output: process.stdout,
    terminal: false
  });
  for await (const line of read) {
    tawsPrefix = String(line) // Change the prefix based on whatever they want it to be. The function that goes to this is now disabled since it's already been set up.
  }
  averagePlayers()
}

async function averagePlayers() {
  let generalChannelLocal = generalChannel
  var rankCount = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] // Count the number of players in each rank
  var ranks = g("rank")
  console.log(pList.slice(-unrankedCount))
  console.log(ranks.slice(-unrankedCount))
  playerNames = [] // The names of the players, which will be assigned shortly.
  avgPlayers = []
  totPlayersSort = 0 // Total number of players we've sorted through so far
  for (let i = 0; i < ranks.length; i++) {
    for (let j = 0; j < rankArray.length; j++) {
      if (ranks[i] == rankArray[j]) {
        rankCount[j] += 1
      }
    }
  }
  for (let i = 0; i < rankArray.length; i++) {
    playerNames.push("$avg" + rankArray[i].toUpperCase())
    let tmp = new Player(playerNames[i],
      g("apm").slice(totPlayersSort, totPlayersSort + rankCount[i]).reduce((a, b) => a + b, 0) / rankCount[i],
      g("pps").slice(totPlayersSort, totPlayersSort + rankCount[i]).reduce((a, b) => a + b, 0) / rankCount[i],
      g("vs").slice(totPlayersSort, totPlayersSort + rankCount[i]).reduce((a, b) => a + b, 0) / rankCount[i],
      g("tr").slice(totPlayersSort, totPlayersSort + rankCount[i]).reduce((a, b) => a + b, 0) / rankCount[i],
      g("glicko").slice(totPlayersSort, totPlayersSort + rankCount[i]).reduce((a, b) => a + b, 0) / rankCount[i],
      g("rd").slice(totPlayersSort, totPlayersSort + rankCount[i]).reduce((a, b) => a + b, 0) / rankCount[i],
      null
    )
    tmp.id = 0
    tmp.rank = "h" // I really just did this because it was funny. That's about it.
    // It's also a way of differentiating from other ranks if you ever wanted to put the average players in the
    // pList array with every other player- simply filter out the h ranks.
    tmp.position = -i
    totPlayersSort += rankCount[i]
    avgPlayers.push(tmp)
    //console.log(totPlayersSort)
    client.user.setActivity("on " + g("name")[(Math.floor(Math.random() * pList.length - 1))] + "'s account")
  }
  console.log(rankCount)
  console.log(avgPlayers)
  let guild = await client.guilds.fetch(config.yourGuildID);
  let channel = await guild.channels.fetch(config.generalChannelID);
  await channel.send("Ready!");
  console.log(g("name"))
}
everythingElse()

function everythingElse() {
  client.on('message', (text) => {
    if (text.author == client.user) { // Prevent bot from responding to its own messages
      return
    }
    generalChannel = text.channelId // Set generalChannel to whatever channel the message is currently in.
    const guildId = text.guild != undefined ? text.guild.id : "";
    const guildPrefix = prefixes[guildId];
    const prefix = guildPrefix == undefined ? config.defaultPrefix : guildPrefix;

    // If the bot is pinged, give its prefix.
    const botMention = `<@${client.user.id}>`;
    if (text.content.startsWith(botMention)) {
      prefixcommand([], prefix, text)
      return;
    }
    // Instead of having to modify the code to add a server's prefix,
    // this will enable servers to define the prefix
    // they want for their server with a command.
    if (text.content.startsWith(prefix)
      // && text.guild.id != "599005375907495936"
    ) { // ! is the prefix used for commands. You could change this if you wanted to.
      processCommand(text, prefix)
    }
    // if (text.content.startsWith(tawsPrefix) && text.guild.id == "599005375907495936") { // Again, they wanted a different prefix for that server.
    //   processCommand(text)
    // }
  })
  function processCommand(text, prefix = '!') {



    client.user.setActivity("on " + g("name")[(Math.floor(Math.random() * pList.length - 1))] + "'s account")
    let parsedText = ""
    // if (text.guild.id == "599005375907495936") {
    //   parsedText = text.content.substr(tawsPrefix.length) // Remove the leading exclamation mark
    // } else {
    //   parsedText = text.content.substr(1)
    // }
    parsedText = text.content.substr(prefix.length)
    let spacesText = parsedText.split(" ") // Split the message up in to pieces for each space
    let command = spacesText[0] // The first word directly after the exclamation is the command
    if (command.length != 0) {
      command = command.toLowerCase()
    }
    let name = spacesText.slice(1) // All other words are name/parameters/options for the command
    for (let i = 0; i < name.length; i++) {
      if (isNaN(Number(name[i]))) { // If it's not a number
        name[i] = name[i].toLowerCase()
        name[i] = name[i].replace(/[\u{0080}-\u{FFFF}]/gu, '') // Removes unicode characters
        name[i] = name[i].replace(/[&\/\\#,()~%'":*?{}]/g, '') // Removes some other problematic characters
      }
    }
    console.log(name)
    console.log(command)

    if (name.length <= 0 && (command == "ts" || command == "vs" || command == "vsr" || command == "o" || command == "vst" || command == "psq"
      || command == "sq" || command == "ac" || command == "lb" || command == "rlb" || command == "z" || command == "rnk" || command == "avg"
      || command == "med")) {
      return client.channels.cache.get(text.channelId).send("Too few parameters entered.")
    }
    // Different commands are called below. Self-explanatory.
    if (command == "prefix") { // DONE
      prefixcommand(parsedText.split(" ").slice(1), prefix, text)
      // Note: For a prefix command you don't need to filter problematic characters
    }
    if (command == "ts") { // DONE?
      tetostat(name)
    }
    if (command == "help") { // Not Started
      sheetBotHelper(client, generalChannel, name)
    }
    if (command == "vs") { // DONE
      versus(name, false, false) // First is for relative, second is for tableValue
    }
    if (command == "vst") { // DONE
      versus(name, false, true)
    }
    if (command == "vsr") { // Done
      versus(name, true, false)
    }
    if (command == "o") { // Done, but should add a feature to sort by other stats than TR/position in league
      operate(name)
    }
    if (command == "psq") { // Done
      triangle(name, true)
    }
    if (command == "sq") { // Done, perhaps change blue color to be more visible then rest.
      triangle(name, false) // Also strange issue with embeds not working when putting in stats?
    }
    if (command == "ac") { // DONE
      allcomp(name)
    }
    if (command == "lb") {
      leaderboard(name, false) // False is for setting reverse
    }
    if (command == "rlb") {
      leaderboard(name, true)
    }
    if (command == "avg") { // DONE, two minor bugs relating to number grabbing one under or over the right count
      getAverage(name, false) // And saying "Average rank of rank UNDEFINED"
      // False here is for median
    }
    if (command == "med") {
      getAverage(name, true)
    }
    if (command == "cc") { // DONE
      copycat(name)
    }
    if (command == "refresh") { // Not started
      refresh()
    }
    if (command == "z") { // DONE?
      addUnranked(name)
    }
    if (command == "rnk") { // Not started
      rankStat(name)
    }
    /*
    if (command == "prefix") { // Again, disabled because it already got set.
      prefix(name)
    }
    */
  }
}

async function prefixcommand(name, prefix, text) {
  let generalChannelLocal = generalChannel;
  let channel = client.channels.cache.get(generalChannelLocal);
  const guild = text.guild;
  if (guild == undefined) {
    channel.send(`This bot's prefix is ${prefix}.`);
    return;
  }
  if (name[0] != undefined) {
    name[0] = String(name[0]);
  }
  else {
    channel.send(`This server's prefix is \`${prefix}\`\nYou can change it with \`${prefix}prefix [prefix]\``);
    return;
  }

  if (!text.member.permissions.has('ADMINISTRATOR')) {
    channel.send("You do not have the permission to change the prefix for that server. You need `ADMINISTRATOR` permissions.");
    return;
  }

  prefixes[guild.id] = name[0];
  fs.writeFileSync("./prefix.json", JSON.stringify(prefixes, undefined, 4), "utf-8");
  console.log(prefixes)
  channel.send(`This server's prefix has been changed to ${name[0]}`);
}

function refresh() { // Now using pm2 to restart the bot.
  // Run pm2 start sheetBot.js inside directory with sheetBot in it to make it run.
  // Using manager.bat can also be useful.
  async function firstFunction() {
    client.user.setActivity("Restarting...")
    return client.channels.cache.get(generalChannel).send("Refreshing... (This may take up to 2 minutes to complete.)")
  };
  async function secondFunction() {
    await firstFunction();
    process.exit();
  }
  secondFunction();
}

async function rankStat(name) {
  let generalChannelLocal = generalChannel
  var player;
  let searchFrom = 0
  let searchTo = pList.length
  let tempPList = pList.map(a => { return { ...a } }) // Create a copy of the objects in our pList to modify as we see fit
  var countrySearch = "default"
  var rankSearchTop = ""
  var rankSearchBottom = ""
  var rankSearchTop;
  var rankSearchBottom;
  var notInList = false // Variable responsible for showing message if our player isn't in the list we're looking for.
  let properties = []
  var propertyNames = ["APM", "PPS", "VS", "APP", "DS/Second", "DS/Piece", "APP+DS/Piece", "VS/APM",
    "Cheese Index", "Garbage Effi", "Weighted APP", "Area", "Opener", "Plonk", "Stride",
    "Inf. DS", "Games", "Wins", "Win Rate", "Est. TR", "TR", "Glicko"]
  // Kept here to look nice rather than displaying the raw variable names
  // for this function. Making it global could almost certainly be used to save some boilerplate lines of code 
  // but to be honest, I couldn't be bothered, at least not yet. If you wanted to rearrange some things
  // (Namely DS/Second, DS/Piece and APP+DS/Piece), you could probably use it in !vst and !ac as well.
  if (name.length > 2) {
    if (!isNaN(name[0]) && !isNaN(name[1]) && !isNaN(name[2]) && name[0] > 0 && name[1] > 0 && name[2] > 0) {
      player = new Player("EXAMPLE", name[0], name[1], name[2], 0, 0, 60, null)
      name.splice(0, 3)
      name.unshift("EXAMPLE")
      console.log(name)
      delete player.games; delete player.wins; delete player.wr; delete player.tr; delete player.glicko;
      propertyNames.splice(propertyNames.length - 2, 2)
      console.log(propertyNames)
      propertyNames.splice(propertyNames.length - 4, 3)
      console.log(propertyNames)
    }
  }
  if (name.length > 6) { // Name is too long, too many parameters
    client.channels.cache.get(generalChannelLocal).send("Too many arguments.")
    return
  }
  if (name.length < 1 && player == undefined) { // Too few parameters
    client.channels.cache.get(generalChannelLocal).send("Too few arguments.")
    return
  }
  if (player == undefined) {
    if (name[0] != undefined) { // Set the name string if we have something to set it to
      var nameString = name[0].toLowerCase()
      if (nameString.length <= 2) { // If our name is too short to be a player name.
        return client.channels.cache.get(generalChannelLocal).send(nameString + " is not a valid name!")
      }
      if (String(name[0].slice(0, 4)).toLowerCase() == "$avg") { // Handles avg players being used
        let avgRank = ""
        if (rankArray.indexOf(String(name[0].slice(-2).toLowerCase())) == -1) { // If the last two characters don't make something 
          // that is a rank. You could also use .includes here if you wanted.
          avgRank = String(name[0].slice(-1).toLowerCase()) // Grab the first character instead
        } else {
          avgRank = String(name[0].slice(-2).toLowerCase()) // Otherwise we can assume we had it right the first time and grab the last two
        }
        player = avgPlayers[rankArray.indexOf(avgRank)] // Makes a deep copy
        if (rankArray.indexOf(avgRank) == -1) { // If our average rank still isn't in rank array...
          return client.channels.cache.get(generalChannelLocal).send(name[0] + " is an invalid rank!")
        }
      } else {
        await axios.get('https://ch.tetr.io/api/users/' + nameString) // Fetch with axios
          .then(function (response) { // Then do the following...
            output = (response.data); // Assign output to the raw data.
            if (response.data.success == false || output.data.user.role == "anon" || output == undefined) { // If the player is an anon, the string couldn't be grabbed or leagueCheck is undefined for whatever reason.
              return client.channels.cache.get(generalChannelLocal).send(name[0] + " is an invalid user. The user appears to be an anonymous account.")
            }
            if (output.data.user.league.gamesplayed == 0) {
              return client.channels.cache.get(generalChannelLocal).send(name[0] + " is an invalid user. Player has never played a Tetra League game.")
            }
            if (output.data.user.league.vs == null) {
              return client.channels.cache.get(generalChannelLocal).send(name[0] + "is an invalid user, as they don't have a versus stat!")
            }
            player = new Player(String(name[0]).toLowerCase(), output.data.user.league.apm, output.data.user.league.pps, output.data.user.league.vs, output.data.user.league.rating, output.data.user.league.glicko, output.data.user.league.rd, output.data.user)
            console.log(player) // Show a console log of them;
          })
      }
    }
    if (player == null) { // Some of the axios stuff won't return properly unless we do this.
      return
    }
  }
  if ((name[name.length - 1].length == 2 || String(name[name.length - 1]).slice(0, 2).toLowerCase() == "gb") && isNaN(name[name.length - 1]) && name[name.length - 1].slice(-1) != "-" && name[name.length - 1].slice(-1) != "+") {
    countrySearch = String(name[name.length - 1]).toUpperCase()
  } else {
    if (name[name.length - 1] == null || String(name[name.length - 1]).toLowerCase() == "null") {
      countrySearch = "null"
    }
    if (String(name[name.length - 1]).toLowerCase() == "latam") {
      countrySearch = "LATAM"
    }
    if (String(name[name.length - 1]).toLowerCase() == "e.u") {
      countrySearch = "E.U"
    }
  }
  // If searchFrom isn't undefined and searchTo is...
  if (isNaN(Number(name[2])) && name[2] != undefined && rankArray.indexOf(name[2]) != -1) {
    rankSearchBottom = name[2].toLowerCase() // For double rank search when implemented
  } else {
    if (name[2] != undefined) {
      searchTo = Number(name[2])
      console.log("searchTo: " + searchTo)
    }
  }
  if (searchTo > pList.length || isNaN(searchTo)) {
    searchTo = pList.length
  }
  console.log(name[1])
  if (isNaN(Number(name[1])) && name[1] != undefined) {
    rankSearchTop = name[1].toLowerCase() // Determine what rank the player is searching for.
  } else {
    searchFrom = Number(name[1])
  }
  if (isNaN(searchFrom)) {
    searchFrom = 0
  }
  if (searchFrom < 0) {
    searchFrom = 0
  }
  console.log("Bottom: " + rankSearchBottom + " , Top: " + rankSearchTop)
  console.log("This is searchFrom: " + searchFrom + " and this is searchTo: " + searchTo)
  if (rankArray.indexOf(rankSearchTop) != -1 || rankArray.indexOf(rankSearchBottom) != -1) { // If we're searching based on ranks and not positions
    console.log("Ranks are being searched!")
    if (rankSearchTop != "" && rankSearchTop != -1 && (rankSearchBottom == "" || rankSearchBottom == "")) {
      console.log("Set bottom!")
      rankSearchBottom = rankSearchTop
    }
    rankSearchTop = rankArray.indexOf(rankSearchTop)
    rankSearchBottom = rankArray.indexOf(rankSearchBottom)
    if (rankSearchTop == 17) { // This handles unranked players
      searchFrom = 0
    }
    if (rankSearchTop == 17 && rankSearchBottom != 17) { // So does this
      let tmp = rankSearchBottom
      rankSearchTop = tmp
      rankSearchBottom = 17
    }
    if (rankSearchBottom == 17) { // And this too
      searchFrom = 0
    }
    tempPList.forEach(function (p) {
      p.rank = rankArray.indexOf(p.rank)
    });
    console.log("Bottom: " + rankSearchBottom + " , Top: " + rankSearchTop)
    tempPList = tempPList.filter(p => p.rank <= rankSearchBottom && p.rank >= rankSearchTop && p.position <= searchTo && p.position >= searchFrom); // Filter our copy of the player list to only include people in the rank being
  } else {
    tempPList = tempPList.filter(p => p.position >= searchFrom && p.position <= searchTo); // Filter our copy of the player list to only include people in the rank being
  }
  if ((countrySearch.length == 2 && countrySearch != "SS") || countrySearch == "null" || countrySearch.slice(0, 2) == "GB") {
    console.log("Hit it!")
    tempPList = tempPList.filter(p => p.country == countrySearch)
  }
  if (countrySearch == "LATAM") {
    tempPList = tempPList.filter(p => latamCountries.includes(p.country))
  }
  if (countrySearch == "E.U") {
    tempPList = tempPList.filter(p => euCountries.includes(p.country))
  }
  if (tempPList.length == 0) {
    return client.channels.cache.get(generalChannelLocal).send("There is nobody that matches the specifications you entered!"
      + " This is most likely caused by entering a position or rank combination with no people in it.\n"
      + "For example, please enter `!rnk explorat0ri x u` instead of `!rnk explorat0ri u x`, or `!rnk explorat0ri 100 1000` instead of `!rnk explorat0ri 1000 100`")
  }
  console.log("countrySearch: " + countrySearch)
  for (const property in player) {
    if (property != "name" && property != "id" && property != "rank" && property != "estglicko" && property != "esttr" && property != "atr" && property != "avatar" && property != "country" && property != "rd" && property != "srarea" && property != "sr" && property != "tr" && property != "glicko" && property != "position") {
      properties.push(property)
    }
  }
  console.log(properties)
  properties.push('esttr') // Push these afterwards so they show up at the end of the display together.
  if (player.name != "EXAMPLE") {
    properties.push('tr')
    properties.push('glicko')
  }
  console.log(properties)
  if (tempPList.findIndex(crit => crit.name === player.name) == -1) {
    tempPList.push(player)
    notInList = true
  }
  let playerPos = [] // Short for position
  let playerPer = [] // Short for percentile
  let lbCom = [] // Short for leaderboard command, displays the command you'd have to use to find yourself on the leaderboard
  for (let i = 0; i < properties.length; i++) {
    tempPList = tempPList.sort((a, b) => { if (a[properties[i]] < b[properties[i]]) return 1; if (a[properties[i]] > b[properties[i]]) return -1; if (a[properties[i]] == b[properties[i]]) return 0; })
    playerPos.push(tempPList.findIndex(crit => crit.name === player.name) + 1) // Find the index the player's name is at and make it the position
    playerPer.push(Number(((playerPos[i] / tempPList.length) * 100).toFixed(2))) // Percentile is based on position obviously
    lbCom.push // Looks really complicated but this is basically to decide whether to display !lb and !rlb and make the command display work
      (
        (playerPer[i] > 50 && playerPer[i] != 100)
          ? ('!rlb ' + properties[i] + " 20 " + name.slice(1, name.length).join(" ") + ((name.length > 1) ? " " : "") + ((Math.ceil((tempPList.length - playerPos[i]) / 20) != 1) ? ("p" + Math.ceil((tempPList.length - playerPos[i]) / 20)) : ""))
          : ('!lb ' + properties[i] + " 20 " + name.slice(1, name.length).join(" ") + ((name.length > 1) ? " " : "") + ((Math.ceil(playerPos[i] / 20) != 1) ? ("p" + Math.ceil(playerPos[i] / 20) + "") : ""))
      )
  }
  console.log(playerPos)
  console.log(playerPer)
  console.log(lbCom)
  var data = [
    [player.name],
    [' '],
  ]
  for (let i = 0; i < properties.length; i++) {
    data.push([propertyNames[i]])
  }
  data[0].push("# of " + tempPList.length)
  data[0].push("!lb command")
  data[1].push(" ")
  data[1].push(" ")
  for (let i = 2; i < data.length; i++) {
    data[i].push(playerPos[i - 2] + " (" + ((playerPer[i - 2] > 50 && playerPer[i - 2] != 100) ? "Bottom " + (100 - playerPer[i - 2]).toFixed(2) + "%)" : "Top " + playerPer[i - 2] + "%)"))
    data[i].push(lbCom[i - 2])
    // Determine whether to use top or bottom for the % and push the data.
  }
  const config = {
    singleLine: true,
    border: getBorderCharacters(`ramac`),
    columns: [
      { alignment: 'center' }
    ],
    columnDefault: {
      alignment: 'center'
    },
    drawHorizontalLine: (lineIndex, rowCount) => {
      return lineIndex === 0 || lineIndex === 1 || lineIndex === rowCount - 1 || lineIndex === rowCount;
    }
  }
  console.log(table(data, config))
  if (notInList) {
    client.channels.cache.get(generalChannelLocal).send(player.name + " is not in the specified group of players! " +
      "Because of this, the table below is a hypothetical- only showing where the player would be if they were in the group.")
  }
  return client.channels.cache.get(generalChannelLocal).send("```" + table(data, config) + "```");
}

function getAverage(name, median) {
  let generalChannelLocal = generalChannel // Just for making sure things get sent to the right channels.
  if (name.length > 3) {
    return client.channels.cache.get(generalChannelLocal).send("Invalid number of parameters entered.")
    // TODO: Add more descriptive text here later.
  }
  let tempPList = pList.map(a => { return { ...a } }) // Create a copy of the objects in our pList to modify as we see fit
  let countryPList;
  var countrySearch = name[name.length - 1].toUpperCase();
  let searchFrom = 0
  let searchTo = pList.length
  var rankSearch = false;
  var rankSearchTop;
  var rankSearchBottom;
  var avgPlayer;
  var avgCountryPlayer;
  if (rankArray.indexOf(countrySearch.toLowerCase()) != -1 || !isNaN(Number(countrySearch)) || countrySearch == "ALL") {
    console.log("Set to zz from countrySearch length!") // This does mean that anyone in South Sudan can't be searched for by country but like
    countrySearch = "zz" // I really don't see a good fix for this because statements like !avg u ss will always be ambiguous
  }
  if (countrySearch == "NULL" || countrySearch == "null") {
    countrySearch = null
  }
  console.log(name)
  if (isNaN(Number(name[1])) && name[1] != undefined && rankArray.indexOf(name[1]) != -1) {
    rankSearchBottom = name[1].toLowerCase() // For double rank search when implemented
  } else {
    if (name[1] != undefined) {
      searchTo = Number(name[1])
      console.log("searchTo: " + searchTo)
    }
  }
  if (searchTo > pList.length || isNaN(searchTo)) {
    searchTo = pList.length
  }
  console.log(name[0])
  if (isNaN(Number(name[0])) && name[0] != undefined) {
    rankSearchTop = name[0].toLowerCase() // Determine what rank the player is searching for.
  } else {
    searchFrom = Number(name[0])
  }
  if (isNaN(searchFrom)) {
    searchFrom = 0
  }
  if (searchFrom < 0) {
    searchFrom = 0
  }
  console.log("This is searchFrom: " + searchFrom + " and this is searchTo: " + searchTo)
  console.log("This is rankSearchTop: " + rankSearchTop + " and this is rankSearchBottom: " + rankSearchBottom)
  console.log(countrySearch)
  if (rankArray.indexOf(rankSearchTop) != -1 || rankArray.indexOf(rankSearchBottom) != -1) {
    console.log("Ranks are being searched!")
    if (rankSearchTop != undefined && rankSearchBottom == undefined) {
      rankSearchBottom = rankSearchTop
    }
    rankSearch = true
    rankSearchTop = rankArray.indexOf(rankSearchTop)
    rankSearchBottom = rankArray.indexOf(rankSearchBottom)
    if (rankSearchTop == 17) { // This handles unranked players
      searchFrom = 0
    }
    if (rankSearchTop == 17 && rankSearchBottom != 17) { // So does this
      let tmp = rankSearchBottom
      rankSearchTop = tmp
      rankSearchBottom = 17
    }
    if (rankSearchBottom == 17) { // And this too
      searchFrom = 0
    }
    tempPList.forEach(function (p) {
      p.rank = rankArray.indexOf(p.rank)
    });
    tempPList = tempPList.filter(p => p.rank <= rankSearchBottom && p.rank >= rankSearchTop && p.position <= searchTo && p.position >= searchFrom); // Filter our copy of the player list to only include people in the rank being
    if (countrySearch != "zz") {
      countryPList = tempPList.filter(p => p.country == countrySearch); // Filter our copy of the player list to only include people in the rank being
      tempPList = tempPList.filter(p => p.country != countrySearch)
    }
  } else {
    tempPList = tempPList.filter(p => p.position >= searchFrom && p.position <= searchTo); // Filter our copy of the player list to only include people in the rank being
    if (countrySearch != "zz") {
      countryPList = tempPList.filter(p => p.country == countrySearch);
      tempPList = tempPList.filter(p => p.country != countrySearch)
    }
    if (countrySearch == "LATAM") {
      countryPList = tempPList.filter(p => latamCountries.includes(p.country))
    }
    if (countrySearch == "E.U") {
      countryPList = tempPList.filter(p => euCountries.includes(p.country))
    }
  }
  if ((countryPList == undefined || countryPList.length == 0) && countrySearch != "zz") {
    return client.channels.cache.get(generalChannelLocal).send("There aren't any people in the country " + countrySearch +
      " that meet the parameters set!")
  }
  console.log(countryPList)
  if (tempPList.length == 0) {
    return client.channels.cache.get(generalChannelLocal).send("There is nobody that matches the specifications you entered!"
      + " This is most likely caused by entering a country and rank combination with no people in it.")
  }
  if (median) {
    let medians = []
    let countryMedians = []
    const median = arr => {
      const mid = Math.floor(arr.length / 2),
        nums = [...arr].sort((a, b) => a - b);
      return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
    };
    medians.push(median(tempPList.map(p => p['apm']))); medians.push(median(tempPList.map(p => p['pps'])));
    medians.push(median(tempPList.map(p => p['vs']))); medians.push(median(tempPList.map(p => p['tr'])));
    medians.push(median(tempPList.map(p => p['glicko']))); medians.push(median(tempPList.map(p => p['rd'])));
    if (countrySearch != "zz") {
      countryMedians.push(median(countryPList.map(p => p['apm']))); countryMedians.push(median(countryPList.map(p => p['pps'])));
      countryMedians.push(median(countryPList.map(p => p['vs']))); countryMedians.push(median(countryPList.map(p => p['tr'])));
      countryMedians.push(median(countryPList.map(p => p['glicko']))); countryMedians.push(median(countryPList.map(p => p['rd'])));
    }
    avgPlayer = new Player("MEDIAN", medians[0], medians[1], medians[2], medians[3], medians[4], medians[5], null)
    if (countrySearch != "zz") {
      avgCountryPlayer = new Player("MEDIAN", countryMedians[0], countryMedians[1], countryMedians[2], countryMedians[3], countryMedians[4], countryMedians[5], null)
    }
  } else {
    let tmpApm = [0, 0]
    let tmpPps = [0, 0]
    let tmpVs = [0, 0]
    let tmpTr = [0, 0]
    let tmpGlicko = [0, 0]
    let tmpRd = [0, 0]
    for (let i = 0; i < tempPList.length; i++) {
      tmpApm[0] += tempPList[i].apm
      tmpPps[0] += tempPList[i].pps
      tmpVs[0] += tempPList[i].vs
      tmpTr[0] += tempPList[i].tr
      tmpGlicko[0] += tempPList[i].glicko
      tmpRd[0] += tempPList[i].rd
    }
    if (countrySearch != "zz") {
      for (let i = 0; i < countryPList.length; i++) {
        tmpApm[1] += countryPList[i].apm
        tmpPps[1] += countryPList[i].pps
        tmpVs[1] += countryPList[i].vs
        tmpTr[1] += countryPList[i].tr
        tmpGlicko[1] += countryPList[i].glicko
        tmpRd[1] += countryPList[i].rd
      }
    }
    // AVERAGING STARTS HERE
    if (avgPlayer == undefined) {
      avgPlayer = new Player("EXAMPLE", Number(tmpApm[0] / tempPList.length), Number(tmpPps[0] / tempPList.length), Number(tmpVs[0] / tempPList.length), Number(tmpTr[0] / tempPList.length), Number(tmpGlicko[0] / tempPList.length), Number(tmpRd[0] / tempPList.length), null)
    }
    if (countrySearch != "zz" && avgCountryPlayer == undefined) {
      avgCountryPlayer = new Player("EXAMPLE", Number(tmpApm[1] / countryPList.length), Number(tmpPps[1] / countryPList.length), Number(tmpVs[1] / countryPList.length), Number(tmpTr[1] / countryPList.length), Number(tmpGlicko[1] / countryPList.length), Number(tmpRd[1] / countryPList.length), null)
    }
  }
  const e = new MessageEmbed() // Make the embed field
    .setColor('#0099ff')
    .setTitle(
      ((median == false) ? "Average" : "Median") + " values for " +
      (
        (rankSearch == false)
          ? ("position " + searchFrom + " to " + searchTo)
          : (
            (rankArray[rankSearchTop] == undefined)
              ? "position " + searchFrom + " to rank " + String(rankArray[rankSearchBottom]).toUpperCase()
              : "rank " +
              (
                (rankArray[rankSearchBottom] == undefined || searchTo == pList.length)
                  ? String(rankArray[rankSearchTop]).toUpperCase()
                  : String(rankArray[rankSearchTop]).toUpperCase() + " to " + searchTo
              )
          )

      ) + ((countrySearch != "zz") ? " in country " + countrySearch : "")
    )
    .setAuthor('Kerrmunism / explorat0ri', 'https://kerrmunism.neocities.org/kapo.PNG', 'https://github.com/Kerrmunism')
    .setThumbnail((countrySearch == "zz") ? 'https://tetr.io/res/league-ranks/' + rankArray[rankSearchTop] + ".png" : 'https://tetr.io/res/flags/' + countrySearch.toLowerCase() + '.png')
    .setDescription("sheetBot - A bot used to grab more advanced statistics from the ch.tetr.io API")
    .addFields( // Simply add all the lines.
      {
        name: 'APM', value: (avgPlayer.apm.toFixed(4) +
          (
            (countrySearch != "zz")
              ? " (" +
              (
                (avgCountryPlayer.apm - avgPlayer.apm >= 0)
                  ? "**+" + (avgCountryPlayer.apm - avgPlayer.apm).toFixed(4) + "**"
                  : "*" + (avgCountryPlayer.apm - avgPlayer.apm).toFixed(4) + "*"
              )
              + ")"
              : ""
          )
        ), inline: true
      }, // Gonna reduce to a one-liner for the other stats but it's the same principle
      { name: 'PPS', value: (avgPlayer.pps.toFixed(4) + ((countrySearch != "zz") ? " (" + ((avgCountryPlayer.pps - avgPlayer.pps >= 0) ? "**+" + (avgCountryPlayer.pps - avgPlayer.pps).toFixed(4) + "**" : "*" + (avgCountryPlayer.pps - avgPlayer.pps).toFixed(4) + "*") + ")" : "")), inline: true },
      { name: 'VS', value: (avgPlayer.vs.toFixed(4) + ((countrySearch != "zz") ? " (" + ((avgCountryPlayer.vs - avgPlayer.vs >= 0) ? "**+" + (avgCountryPlayer.vs - avgPlayer.vs).toFixed(4) + "**" : "*" + (avgCountryPlayer.vs - avgPlayer.vs).toFixed(4) + "*") + ")" : "")), inline: true },
      { name: 'DS/Second', value: (avgPlayer.dss.toFixed(4) + ((countrySearch != "zz") ? " (" + ((avgCountryPlayer.dss - avgPlayer.dss >= 0) ? "**+" + (avgCountryPlayer.dss - avgPlayer.dss).toFixed(4) + "**" : "*" + (avgCountryPlayer.dss - avgPlayer.dss).toFixed(4) + "*") + ")" : "")), inline: true },
      { name: 'DS/Piece', value: (avgPlayer.dsp.toFixed(4) + ((countrySearch != "zz") ? " (" + ((avgCountryPlayer.dsp - avgPlayer.dsp >= 0) ? "**+" + (avgCountryPlayer.dsp - avgPlayer.dsp).toFixed(4) + "**" : "*" + (avgCountryPlayer.dsp - avgPlayer.dsp).toFixed(4) + "*") + ")" : "")), inline: true },
      { name: 'APP+DS/Piece', value: (avgPlayer.dsapp.toFixed(4) + ((countrySearch != "zz") ? " (" + ((avgCountryPlayer.dsapp - avgPlayer.dsapp >= 0) ? "**+" + (avgCountryPlayer.dsapp - avgPlayer.dsapp).toFixed(4) + "**" : "*" + (avgCountryPlayer.dsapp - avgPlayer.dsapp).toFixed(4) + "*") + ")" : "")), inline: true },
      { name: 'APP', value: (avgPlayer.app.toFixed(4) + ((countrySearch != "zz") ? " (" + ((avgCountryPlayer.app - avgPlayer.app >= 0) ? "**+" + (avgCountryPlayer.app - avgPlayer.app).toFixed(4) + "**" : "*" + (avgCountryPlayer.app - avgPlayer.app).toFixed(4) + "*") + ")" : "")), inline: true },
      { name: 'VS/APM', value: (avgPlayer.vsapm.toFixed(4) + ((countrySearch != "zz") ? " (" + ((avgCountryPlayer.vsapm - avgPlayer.vsapm >= 0) ? "**+" + (avgCountryPlayer.vsapm - avgPlayer.vsapm).toFixed(4) + "**" : "*" + (avgCountryPlayer.vsapm - avgPlayer.vsapm).toFixed(4) + "*") + ")" : "")), inline: true },
      { name: 'Cheese Index', value: (avgPlayer.ci.toFixed(4) + ((countrySearch != "zz") ? " (" + ((avgCountryPlayer.ci - avgPlayer.ci >= 0) ? "**+" + (avgCountryPlayer.ci - avgPlayer.ci).toFixed(4) + "**" : "*" + (avgCountryPlayer.ci - avgPlayer.ci).toFixed(4) + "*") + ")" : "")), inline: true },
      { name: 'Garbage Effi.', value: (avgPlayer.ge.toFixed(4) + ((countrySearch != "zz") ? " (" + ((avgCountryPlayer.ge - avgPlayer.ge >= 0) ? "**+" + (avgCountryPlayer.ge - avgPlayer.ge).toFixed(4) + "**" : "*" + (avgCountryPlayer.ge - avgPlayer.ge).toFixed(4) + "*") + ")" : "")), inline: true },
      { name: 'Area', value: (avgPlayer.area.toFixed(4) + ((countrySearch != "zz") ? " (" + ((avgCountryPlayer.area - avgPlayer.area >= 0) ? "**+" + (avgCountryPlayer.area - avgPlayer.area).toFixed(4) + "**" : "*" + (avgCountryPlayer.area - avgPlayer.area).toFixed(4) + "*") + ")" : "")), inline: true },
      { name: 'Weighted APP', value: (avgPlayer.wapp.toFixed(4) + ((countrySearch != "zz") ? " (" + ((avgCountryPlayer.wapp - avgPlayer.wapp >= 0) ? "**+" + (avgCountryPlayer.wapp - avgPlayer.wapp).toFixed(4) + "**" : "*" + (avgCountryPlayer.wapp - avgPlayer.wapp).toFixed(4) + "*") + ")" : "")), inline: true },
      { name: 'Members', value: ((countrySearch != "zz" ? String(countryPList.length) : String(tempPList.length))), inline: true },
      //{ name: 'TR Needed', value: percentilePList[percentilePList.length - 1].tr.toFixed(4), inline: true },
      // Wasn't able to implement the above yet, though I plan on working on it sometime soon.
      { name: 'TR', value: (avgPlayer.tr.toFixed(4) + ((countrySearch != "zz") ? " (" + ((avgCountryPlayer.tr - avgPlayer.tr >= 0) ? "**+" + (avgCountryPlayer.tr - avgPlayer.tr).toFixed(4) + "**" : "*" + (avgCountryPlayer.tr - avgPlayer.tr).toFixed(4) + "*") + ")" : "")), inline: true },
    )
    .addField("Want to know more?", "Use !help calcs for calculation info `^v^`")
    .setTimestamp()
  return client.channels.cache.get(generalChannelLocal).send({ embeds: [e] });
}

async function leaderboard(name, reverse) {
  let generalChannelLocal = generalChannel
  var type = name[0]; // Set the type as the first parameter other than the !lb we used to do this command. This'll usually have something like VS, APP+DS/Piece, Cheese, etc inside it.
  var number = Number(name[1]); // Set the number of names to display as the second parameter.
  let searchFrom = 0
  let searchTo = pList.length
  var page = Number(String(name[4]).substring(1)) - 1; // The 5th parameter skipping the first character, then -1
  var countrySearch = "default"
  var rankSearchTop = ""
  var rankSearchBottom = ""
  var sortPList;
  var rankSearchTop;
  var rankSearchBottom;
  if (name.length > 6) { // Name is too long, too many parameters
    client.channels.cache.get(generalChannelLocal).send("Too many arguments.")
    return
  }
  if (name.length < 2) { // Too few parameters
    client.channels.cache.get(generalChannelLocal).send("Too few arguments.")
    return
  }
  if (page == undefined || isNaN(page) || page == "ndefined") { // If we haven't defined a page...
    page = 0 // Set the page to 0
  }
  for (i = 2; i < name.length; i++) { // Basically this is to determine pages.
    console.log(i + ": " + String(name[i]).toLowerCase())
    if (String(name[i].slice(0, 1)).toLowerCase() == "p" && !isNaN(name[i].slice(1, name[i].length))) {
      // If the first letter is p and everything else is a number 
      page = (name[i].slice(1, name[i].length)) - 1 // Set the page to the numbers - 1.
    } else {
      console.log(name[i].slice(-1))
      if (name[i].length == 2 && isNaN(name[i].slice(-1)) && name[i].slice(-1) != "-" && name[i].slice(-1) != "+" || (name[i].length > 2 && name[i].slice(0, 2).toLowerCase() == "gb")) {
        countrySearch = String(name[i]).toUpperCase()
      } else {
        if (String(name[i]).toLowerCase() == "null") {
          countrySearch = null
        }
        if (String(name[i]).toLowerCase() == "latam") {
          countrySearch = "LATAM"
        }
        if (String(name[i]).toLowerCase() == "e.u") {
          countrySearch = "E.U"
        }
      }
    }
  }
  console.log("countrySearch: " + countrySearch)
  if (page < 0) { // If page is somehow below 0 (which shouldn't come up, but doesn't hurt!)
    client.channels.cache.get(generalChannelLocal).send("Invalid page argument. If you do not wish to use a page, simply don't include it or type `p1`.")
    return
  }
  // Some random console logging done below.
  console.log("number: " + number)
  console.log("searchFrom: " + searchFrom)
  console.log("searchTo: " + searchTo)
  console.log("page: " + page)
  console.log("countrySearch: " + countrySearch)
  // If searchFrom isn't undefined and searchTo is...
  let tempPList = pList.map(a => { return { ...a } }) // Create a copy of the objects in our pList to modify as we see fit
  if (isNaN(Number(name[3])) && name[3] != undefined && rankArray.indexOf(name[3]) != -1) {
    rankSearchBottom = name[3].toLowerCase() // For double rank search when implemented
  } else {
    if (name[3] != undefined) {
      searchTo = Number(name[3])
      console.log("searchTo: " + searchTo)
    }
  }
  if (searchTo > pList.length || isNaN(searchTo)) {
    searchTo = pList.length
  }
  console.log(name[2])
  if (isNaN(Number(name[2])) && name[2] != undefined) {
    rankSearchTop = name[2].toLowerCase() // Determine what rank the player is searching for.
  } else {
    searchFrom = Number(name[2])
  }
  if (isNaN(searchFrom)) {
    searchFrom = 0
  }
  if (searchFrom < 0) {
    searchFrom = 0
  }
  if (number > 50) { // If someone puts a number over 50...
    return client.channels.cache.get(generalChannelLocal).send("Please keep your number of names to count beneath 50! This is due to Discord character limit.")
  }
  if (number < 1 || isNaN(number)) {
    return client.channels.cache.get(generalChannelLocal).send("You need to set your display number to at least 1! This error may come from inputting a command such as `!lb apm x` instead of `!lb apm 10 x`, or `!rlb pps x 20` instead of `!rlb pps 20 x`")
  }
  if (isNaN(page)) {
    page = 0
  }
  console.log("Bottom: " + rankSearchBottom + " , Top: " + rankSearchTop)
  console.log("This is searchFrom: " + searchFrom + " and this is searchTo: " + searchTo)
  if (rankArray.indexOf(rankSearchTop) != -1) { // If we're searching based on ranks and not positions
    console.log("Ranks are being searched!")
    if (rankSearchTop != "" && rankSearchTop != -1 && (rankSearchBottom == "" || rankSearchBottom == "")) {
      console.log("Set bottom!")
      rankSearchBottom = rankSearchTop
    }
    rankSearchTop = rankArray.indexOf(rankSearchTop)
    rankSearchBottom = rankArray.indexOf(rankSearchBottom)
    tempPList.forEach(function (p) {
      p.rank = rankArray.indexOf(p.rank)
    });
    if (rankSearchTop == 17) { // This handles unranked players
      searchFrom = 0
    }
    if (rankSearchTop == 17 && rankSearchBottom != 17) { // So does this
      let tmp = rankSearchBottom
      rankSearchTop = tmp
      rankSearchBottom = 17
    }
    if (rankSearchBottom == 17) { // And this too
      searchFrom = 0
    }
    console.log("This is searchFrom: " + searchFrom + " and this is searchTo: " + searchTo)
    console.log("Bottom: " + rankSearchBottom + " , Top: " + rankSearchTop)
    tempPList = tempPList.filter(p => p.rank <= rankSearchBottom && p.rank >= rankSearchTop && p.position <= searchTo && p.position >= searchFrom); // Filter our copy of the player list to only include people in the rank being
  } else {
    tempPList = tempPList.filter(p => p.position >= searchFrom && p.position <= searchTo); // Filter our copy of the player list to only include people in the rank being
  }
  if (countrySearch == null || countrySearch.length == 2 && countrySearch != "SS" || countrySearch.slice(0, 2) == "GB") {
    console.log("Hit it!")
    tempPList = tempPList.filter(p => p.country == countrySearch)
  }
  if (countrySearch == "LATAM") {
    tempPList = tempPList.filter(p => latamCountries.includes(p.country))
  }
  if (countrySearch == "E.U") {
    tempPList = tempPList.filter(p => euCountries.includes(p.country))
  }
  if (tempPList.length == 0 || tempPList.length < number) {
    return client.channels.cache.get(generalChannelLocal).send("There is not enough people that match the specifications you entered!"
      + " This is most likely caused by entering a position or rank combination with no people in it.\n"
      + "For example, please enter `!lb apm 20 x u` instead of `!lb apm 20 u x`, or `!rlb dsapp 40 100 1000` instead of `!rlb dsapp 40 1000 100`\n"
      + "It could also be caused by entering a country criteria with not enough people in that country to be displayed.")
  }
  if (((searchTo + 1) - searchFrom) < number && (rankSearchTop != 17 && rankSearchBottom != 17) && searchFrom != 0) { // If searchFrom - searchTo is bigger than the number of searches you're making, show this message.
    client.channels.cache.get(generalChannelLocal).send("Invalid parameters. Your 4th value (" + searchTo + ") minus your 3rd value (" + searchFrom + ") can't be less than your 2nd. (" + number + ")")
    return
  }
  var textString = "" // What to display as the leaderboard type "ex: DS/Second, APP, VS, etc."
  console.log("number: " + number)
  console.log("page: " + page)
  console.log("countrySearch: " + countrySearch)
  type = String(type).toLowerCase() // Convert the type string to lowercase
  switch (type.replace(/[^a-z0-9]/gi, '')) { // Remove all special characters, and establish the different types of leaderboards below.
    // Yeah, there was probably a better way to do this.
    case type = "dss":
      type = "dss"
      statArray = g("dss")
      textString = "DS/Second"
      break;
    case type = "dssecond":
      type = "dss"
      statArray = g("dss")
      textString = "DS/Second"
      break;
    case type = "app":
      statArray = g("app")
      textString = "APP";
      break;
    case type = "dspiece":
      statArray = g("dsp")
      type = "dsp"
      textString = "DS/Piece"
      break;
    case type = "dsp":
      statArray = g("dsp")
      type = "dsp"
      textString = "DS/Piece"
      break;
    case type = "dsapppiece":
      statArray = g("dsapp")
      type = "dsapp"
      textString = "APP+DS/Piece"
      break;
    case type = "dsapp":
      statArray = g("dsapp")
      type = "dsapp"
      textString = "APP+DS/Piece"
      break;
    case type = "appdspiece":
      statArray = g("dsapp")
      type = "dsapp"
      textString = "APP+DS/Piece"
      break;
    case type = "vsapm":
      statArray = g("vsapm")
      textString = "VS/APM"
      break;
    case type = "cheese":
      statArray = g("ci")
      type = "ci"
      textString = "Cheese Index"
      break;
    case type = "cheeseindex":
      statArray = g("ci")
      type = "ci"
      textString = "Cheese Index"
      break;
    case type = "ci":
      statArray = g("ci")
      type = "ci"
      textString = "Cheese Index"
      break;
    case type = "vs":
      statArray = g("vs")
      textString = "VS"
      break;
    case type = "apm":
      statArray = g("apm")
      textString = "APM"
      break;
    case type = "pps":
      statArray = g("pps")
      textString = "PPS"
      break;
    case type = "ge":
      statArray = g("ge")
      textString = "Garbage Efficiency"
      break;
    case type = "area":
      statArray = g("area")
      textString = "Area"
      break;
    case type = "nyaapp":
      statArray = g("wapp")
      type = "wapp"
      textString = "Weighted APP"
      break;
    case type = "wapp":
      statArray = g("wapp")
      textString = "Weighted APP"
      break;
    case type = "tr":
      statArray = g("tr")
      textString = "TR"
      break;
    case type = "glicko":
      statArray = g("glicko")
      textString = "TR"
      break;
    case type = "wins":
      statArray = g("wins")
      textString = "Wins"
      break;
    case type = "games":
      statArray = g("games")
      textString = "Games"
      break;
    case type = "wr":
      statArray = g("wr")
      textString = "Win Rate"
      break;
    case type = "rd":
      statArray = g("rd")
      textString = "Rating Deviation"
      break;
    case type = "esttr":
      statArray = g("esttr")
      textString = "Estimated TR"
      break;
    case type = "atr":
      statArray = g("atr")
      textString = "Estimated TR - Real TR"
      break;
    case type = "opener":
      statArray = g("opener")
      textString = "Opener-Playstyle"
      break;
    case type = "plonk":
      statArray = g("plonk")
      textString = "Plonk-Playstyle"
      break;
    case type = "stride":
      statArray = g("stride")
      textString = "Stride-Playstyle"
      break;
    case type = "infds":
      statArray = g("infds")
      textString = "Inf DS-Playstyle"
      break;
    default: // If none of the others applied, set statArray = g(notvalid.
      type = "notvalid"
      break;
  }
  if (type == "notvalid") { // If the type was set to not valid...
    client.channels.cache.get(generalChannelLocal).send("Invalid leaderboard argument. Make sure it's either `apm, pps, vs, app, dspiece, dssecond, dsapppiece, vsapm, cheese, ge, area, wapp, esttr, tr, glicko, wins, games` or `wr`.")
    return
  }
  if (reverse) {
    sortPList = tempPList.sort((a, b) => { if (a[type] > b[type]) return 1; if (a[type] < b[type]) return -1; if (a[type] == b[type]) return 0; })
  } else {
    sortPList = tempPList.sort((a, b) => { if (a[type] < b[type]) return 1; if (a[type] > b[type]) return -1; if (a[type] == b[type]) return 0; })
  }
  var string = "```"
  for (let i = Math.max(((number * page) + (page - (page * 1))), 0); i < number + Math.max(((number) * (page)) + (page - (page * 1)), 0); i++) {
    string += String("#" + (i + 1) + ": " + sortPList[i].name + " (Rank #" + ((sortPList[i].position == 0) ? "[?]" : sortPList[i].position)) + "): (" + ((type == "apm" || type == "pps" || type == "vs") ? sortPList[i][type].toFixed(2) : sortPList[i][type].toFixed(((type == "wins" || type == "games") ? 0 : 4))) + ") \n"
  }
  if (string.length <= 1950) {
    client.channels.cache.get(generalChannelLocal).send(textString + " Leaderboard:") // Display the first message saying what type of leaderboard you're displaying.
    return client.channels.cache.get(generalChannelLocal).send(string + '```') // Once the loop is over, the function large will return the string plus the formatting to end the code block.
  } else {
    return client.channels.cache.get(generalChannelLocal).send("String went over the 2000 character limit. Please reduce the display count. \n ```")
  }
}

async function addUnranked(name) {
  let generalChannelLocal = generalChannel // Set the generalChannel properly.
  var ids = [] // Contains the IDs of the players from the unranked list.
  var contents = [] // The entire contents of the unrankedPlayers.txt document will eventually be stored here.
  var nameList = [] // Contains the last username of the players from the unranked list.
  var skip = 2 // A simple variable that goes back and forth.
  var command; // The command (list, add, remove, etc)
  var player; // The player, if any.
  console.log(name)
  if (String(name[0]).toLowerCase() != "add" && String(name[0]).toLowerCase() != "list" && String(name[0]).toLowerCase() != "remove") {
    client.channels.cache.get(generalChannelLocal).send("Your first parameter (entry after the !z) should be either add, list or remove.")
  }
  command = String(name[0]).toLowerCase()
  if (name[1] != undefined) { // If name[1] is defined...
    player = String(name[1]).toLowerCase() // Player = name[1] (second parameter)
  }
  if ((String(name[1]).toLowerCase()).length <= 2 && command != "list") { // Command part added since someone could be trying to type !z list id.
    client.channels.cache.get(generalChannelLocal).send("This name is too short to be valid. Please pick a different one.")
    return
  }
  const rl = readline.createInterface({ // Read through each line of the unrankedPlayers.txt file.
    input: fs.createReadStream(unrankedPlayers),
    output: process.stdout,
    terminal: false
  });
  for await (const file of rl) { // Basically, push the ids if even, namelist if odd, contents if neither.
    // A for loop probably could've been used with % 1 but whatever.
    if (skip == 1 || skip == 2) {
      ids.push(file + "\n")
    }
    if (skip == 0 || skip == 2) {
      nameList.push(file + "\n")
    }
    contents.push(file + "\n")
    if (skip == 1) {
      skip = 0
    } else {
      skip = 1
    }
  }
  if (command == "add") {
    if (nameList.indexOf(player + "\n") > -1) { // If the player is already listed...
      client.channels.cache.get(generalChannelLocal).send("This player already exists!")
      return
    } else { // Otherwise,
      axios.get('https://ch.tetr.io/api/users/' + player) // Fetch with axios
        .then(function (response) {
          value = response.data
          if (value.success == "false" || value.success == false) { // If the name couldn't be grabbed
            client.channels.cache.get(generalChannelLocal).send("Invalid name.")
            return
          }
          if (value.data.user.league.rank != "z") { // If the player isn't unranked
            client.channels.cache.get(generalChannelLocal).send("This player is not currently unranked!")
            return
          }
          if (value.data.user.league.rating == -1) { // If the rating isn't a proper value
            client.channels.cache.get(generalChannelLocal).send("This user appears to be in placement matches. Please pick a different user.")
            return
          }
          if (value.data.user.league.vs == null || value.data.user.league.vs == "null") { // If VS is null...
            client.channels.cache.get(generalChannelLocal).send("This user has no VS score, and therefore cannot be calculated.")
            return
          }
          var tmp = new Player(value.data.user.username.replace(/['"]+/g, ''), // Make a new player by passing the following
            value.data.user.league.apm, // APM 
            value.data.user.league.pps, // PPS
            value.data.user.league.vs, // VS
            value.data.user.league.rating, // TR
            value.data.user.league.glicko, // Glicko
            value.data.user.league.rd, // RD,
            value.data.user // All of the data.
          )
          // Then add the following to the class for each player since they aren't built in.
          tmp.rank = "z" // TL Rank
          tmp.position = playerCount + unrankedCount + 1 // Position on the TL leaderboard, placed after the other main players.
          // (might change this to 0?)
          tmp.country = String(value.data.user.country).toLowerCase() // In-game country (conv to string to prevent null error)
          tmp.games = value.data.user.league.gamesplayed // TL games played
          tmp.wins = value.data.user.league.gameswon // TL wins
          tmp.wr = tmp.wins / tmp.games // TL winrate
          unrankedCount += 1; // Then add one to the unranked player count
          fs.writeFile(unrankedPlayers, contents.join("") + String(value.data.user._id) + "\n" + value.data.user.username.replace(/['"]+/g, ''), (err) => { if (err) throw err; })
          client.channels.cache.get(generalChannelLocal).send("Added player `" + value.data.user.username.replace(/['"]+/g, '')
            + "` with ID `" + value.data.user._id + "`")
        })
    }
  }
  if (command == "list") {
    if (player == "id") {
      if (String(ids.join("")).length < 1995) { // B.C discord character limits
        client.channels.cache.get(generalChannelLocal).send("There are currently " + Number(Number(ids.length) - 1) + " names listed. \n ```" + ids.join("") + "```")
      } else {
        client.channels.cache.get(generalChannelLocal).send("There are too many names to list all of them, but there are currently " + Number(Number(ids.length) - 1) + " players.")
      }
      return
    } else {
      if (String(nameList.join("")).length < 1995) { // B.C discord character limits
        client.channels.cache.get(generalChannelLocal).send("There are currently " + Number(Number(nameList.length) - 1) + " names listed. \n ```" + nameList.join("") + "```")
      } else {
        client.channels.cache.get(generalChannelLocal).send("There are too many names to list all of them, but there are currently " + Number(Number(nameList.length) - 1) + " players.")
      }
      return
    }
  }
  if (command == "remove") {
    var index = nameList.indexOf(String(String(player).toLowerCase() + "\n"))
    console.log("Index: " + index)
    console.log(String(String(player).toLowerCase()))
    if (index > -1) { // If you're not trying to remove from an invalid index, remove from all variables and documents.
      nameList.splice(index, 1)
      ids.splice(index - 1, 1)
      contents.splice((index * 2) - 1, 2)
      fs.writeFile(unrankedPlayers, contents.join(""), (err) => { if (err) throw err; }) // Write the file.
      console.log(contents)
      client.channels.cache.get(generalChannelLocal).send("Removed player `" + player + "`")
      unrankedCount -= 1
    }
    return
  }
  return
}

function operate(name) {
  var crit = [] // Short for criteria
  var op = [] // Short for operation
  var val = [] // Short for value
  let generalChannelLocal = generalChannel // Just for making sure things get sent to the right channels.
  let tempPList = pList.map(a => { return { ...a } })
  if (name.length == 0) { // If there's nothing afeter the !o
    return client.channels.cache.get(generalChannelLocal).send("There should be at least one filter added after this command. For example `!o apm>30` or `!o app=0.6`")
  }
  for (let i = 0; i < name.length; i++) { // For every argument given
    console.log("name[i]: " + name[i])
    if (name[i].includes("<")) { // Check the included symbols (<, >, =) to see which is used. 
      // There should only be one, which is why else is fine here.
      op[i] = "<"
    } else {
      if (name[i].includes(">")) {
        op[i] = ">"
      } else {
        if (name[i].includes("=")) {
          op[i] = "="
        } else { // If no valid operations are included,
          return client.channels.cache.get(generalChannelLocal).send("An operation should be included. For example, `!o apm>80`. Valid operations are >, < and =.)")
        }
      }
    }
    crit[i] = name[i].substring(0, name[i].indexOf(op[i]))
    val[i] = Number(name[i].substring(name[i].indexOf(op[i]) + 1, name[i].length))
    if (isNaN(val[i])) { // If val is nan (usually from inserting a country)
      val[i] = String(name[i].substring(name[i].indexOf(op[i]) + 1, name[i].length)).toLowerCase()
    }
    if (String(crit[i]).toLowerCase() == "rank") {
      console.log("We hit it!")
      tempPList.forEach(function (p) {
        p.rank = rankArray.length - 1 - rankArray.indexOf(p.rank)
      });
      val[i] = rankArray.length - 1 - rankArray.indexOf(val[i])
    }
  }
  var search = [];
  for (let i = 0; i < crit.length; i++) {
    search[i] = String(crit[i]).toLowerCase()
    // Below just account for if you phrase it a different way.
    if (String(crit[i]).toLowerCase() == "rating") {
      search[i] = "tr"
    }
    if (String(crit[i]).toLowerCase() == "winrate") {
      search[i] = "wr"
    }
    if (String(crit[i]).toLowerCase() == "cheese" || String(crit[i]).toLowerCase() == "cheeseindex"
      || String(crit[i]).toLowerCase() == "cheese_index") {
      search[i] = "ci";
    }
    if (String(crit[i]).toLowerCase() == "nyapp" || String(crit[i]).toLowerCase() == "nyaapp") {
      search[i] = "wapp"
    }
    if (String(crit[i]).toLowerCase() == "dspiece" || String(crit[i]).toLowerCase() == "ds/p") {
      search[i] = "dsp"
    }
    if (String(crit[i]).toLowerCase() == "dssecond") {
      search[i] = "dss"
    }
    // If the thing being searched for isn't recognized,
    if (g(String(search[i]).toLowerCase())[0] == "undefined" || g(String(search[i]).toLowerCase())[0] == undefined) {
      return client.channels.cache.get(generalChannelLocal).send("Invalid criteria. Please ensure that you are searching for a supported stat. \n (Every stat that the `!lb` command can support is supported by this command.)")
    }
    console.log(val)
    switch (op[i]) {
      case '<':
        if (isNaN(val[i]) && crit[i] != "country") {
          tempPList = tempPList.filter(value => value[search[i]] < value[val[i]])
        } else {
          if (crit[i] != "country") {
            tempPList = tempPList.filter(value => value[search[i]] < val[i]);
          }
        }
        break;
      case '>':
        if (isNaN(val[i]) && crit[i] != "country") {
          tempPList = tempPList.filter(value => value[search[i]] > value[val[i]])
        } else {
          if (crit[i] != "country") {
            tempPList = tempPList.filter(value => value[search[i]] > val[i]);
          }
        }
        break;
      case '=':
        if (crit[i] != "country") {
          if (Number(val[i]) == undefined || isNaN(Number(val[i]))) {
            tempPList = tempPList.filter(value => Number(value[search[i]].toFixed(2)) == Number(value[val[i]]).toFixed(2));
          } else {
            tempPList = tempPList.filter(value => Number(value[search[i]].toFixed(2)) == Number(val[i]).toFixed(2));
          }
        } else {
          tempPList = tempPList.filter(value => String(value[search[i]]).toLowerCase() == String(val[i]).toLowerCase())
        }
        break;
    }
  }
  if (search.includes("rank")) { // Change ranks back for proper display
    console.log("We hit it!")
    tempPList.forEach(p => {
      p.rank = rankArray[rankArray.length - 1 - p.rank]
    });
    /*
    for (let i = 0; i < val.length; i++) {
      val[i] = rankArray[rankArray.length - 1 - val[i]]
    }
    */
  }
  var display = [] // This is what will be displayed in the end, but the original tempPList.length will be used for the actual # of players
  // Reason this is done is because of Discord character limit.
  for (let i = 0; i < tempPList.length; i++) { // For each player in the player copy,
    var msg = tempPList[i].name + " (" // Add the player's name and an opening parenthesis to the message.
    for (let j = 0; j < search.length; j++) { // For each stat searched,
      if (search[j] != "rank" && search[j] != "country") { // As long as the stat isn't rank,
        msg += Number(tempPList[i][search[j]].toFixed(4)) + " " + search[j].toUpperCase() + ")" // Add the player's data for that stat and which stat it is.
      } else { // Otherwise,
        msg += tempPList[i][search[j]].toUpperCase() + " " + search[j].toUpperCase() + ")" // Do the same but don't round decimals.
      }
      if (j + 1 != search.length) { // If it's not the last item in the array,
        msg += ", (" // Add on another opening parenthesis and comma.
      }
    }
    display.push(msg) // Push the message to the qualified players array.
  }
  for (let i = 125; i < display.length;) {
    if (display.length > 125) {
      display.pop()
    }
  }
  display = display.join("\n") // Join the string
  display = display.substring(0, 1900) // Make a substring to not go over the discord character limit
  if (display.length >= 1900) {
    display = display.substring(0, display.lastIndexOf("\n") + 1) // Make another substring, stopping at the last occurence of the \n character.
    // This is to make sure we don't cut off in the middle of someone's name basically.
  }
  if (tempPList.length > 125) {
    display += "[and more]" // Add the "[and more]" text if needed.
  }
  return client.channels.cache.get(generalChannelLocal).send("There are " + tempPList.length + " players with " + crit[0] + op[0] + val[0] + " and any other specifications: ```" + "\n" + display + "```")
}

async function triangle(name, playstyle) {
  var chartData;
  var charttype = "radar"
  let generalChannelLocal = generalChannel
  var players = []
  var bgColors = ['rgba(204, 253, 232, 0.65)', 'rgba(48, 186, 255, 0.65)', 'rgba(240, 86, 127, 0.65)', 'rgba(8, 209, 109, 0.65)', 'rgba(237, 156, 17, 0.65)'] // Will hold our fill colors
  var borderColors = ['rgba(75, 118, 191, 1)', 'rgba(204, 33, 201, 1)', 'rgba(250, 5, 70, 1), rgba(28, 232, 130, 1)', 'rgba(250, 177, 42, 1)'] // Will hold the color of the outline
  if (String(name[name.length - 1]).toLowerCase() == "-v") {
    bgColors = ['rgba(204, 253, 232, 0)', 'rgba(48, 186, 255, 0)', 'rgba(240, 86, 127, 0)', 'rgba(8, 209, 109, 0)', 'rgba(237, 156, 17, 0)']
    borderColors = ['rgba(75, 118, 191, 0.5)', 'rgba(204, 33, 201, 0.5)', 'rgba(250, 5, 70, 0.5)', 'rgba(28, 232, 130, 0.5)', 'rgba(250, 177, 42, 0.5)']
    name.pop()
    client.channels.cache.get(generalChannelLocal).send("-v parameter used! The radar graph will now be more visible. Colors after the first 5 will be auto-generated.");
  }
  if (String(name[name.length - 1]).toLowerCase() == "-s" && playstyle == false) {
    return client.channels.cache.get(generalChannelLocal).send("The -s parameter is only supported for `!psq`, not `!sq`.");
  } else {
    if (String(name[name.length - 1]).toLowerCase() == "-quad" || String(name[name.length - 1]).toLowerCase() == "-quadrant" || String(name[name.length - 1]).toLowerCase() == "-scatter" || String(name[name.length - 1]).toLowerCase() == "-s") {
      charttype = "scatter"
      name.pop()
    }
  }
  async function updateChart() {
    if (charttype == "radar") {
      chartData = {
        "chart": {
          type: 'radar',
          data: {
            labels: ((playstyle == false) ? ['ATTACK', 'SPEED', 'DEFENSE', 'CHEESE'] : ['OPENER', 'STRIDE', 'INF DS', 'PLONK']),
            datasets: players.map((dummy, j) => (
              {
                backgroundColor: bgColors[j],
                borderColor: borderColors[j],
                label: players[j].name,
                data: ((playstyle == false) ? [(Number(players[j].apm) / 60) * 0.4, Number(players[j].pps) / 3.75, Number(players[j].dss) * 1.15, players[j].ci / 110,] : [players[j].opener, players[j].stride, players[j].infds, players[j].plonk])
              }
            ))
          },
          options: {
            legend: {
              display: ((players.length > 20) ? false : true),
              labels: {
                "fontSize": 14,
                fontStyle: 'bold',
                "fontColor": 'rgba(115, 158, 231, 1)',
              },
            },
            "scale": {
              "pointLabels": {
                "fontSize": 13,
                "fontColor": 'rgba(95, 138, 211, 1)',
                fontStyle: 'bold'
              },
              rAxis: {
                color: "blue",
                ticks: {
                  display: false
                }
              },
              ticks: {
                min: 0,
                max: ((playstyle == false) ? 1.2 : 1.5),
                stepSize: ((playstyle == false) ? 0.2 : 0.25),
                fontColor: 'blue',
                // rgba(204, 255, 249, 1)
                display: false
              },
              gridLines: {
                color: 'rgb(128,128,128)'
              },
              angleLines: {
                color: 'rgb(128,128,128)'
              }
            }
          }
        }
      }
      return
    }
    if (charttype == "scatter") {
      chartData = {
        "chart": {
          type: 'scatter',
          data: {
            datasets: players.map((dummy, j) => (
              {
                label: players[j].name,
                backgroundColor: bgColors[j],
                borderColor: borderColors[j],
                data: [
                  {
                    x: players[j].stride - players[j].plonk,
                    y: players[j].opener - players[j].infds,
                  }
                ],
              }
            ))
          },
          options: {
            legend: {
              display: ((players.length > 20) ? false : true),
              labels: {
                "fontSize": 14,
                fontStyle: 'bold',
                "fontColor": 'rgba(115, 158, 231, 1)',
              },
            },
            scales: {
              xAxes: [
                {
                  ticks: {
                    display: true,
                    min: -1.5,
                    max: 1.5,
                    stepSize: null,
                    fontColor: 'rgba(95, 138, 211, 1)',
                    fontSize: 13,
                    fontStyle: 'bold'
                  },
                  gridLines: {
                    display: true,
                    color: "#656565",
                    zeroLineWidth: 1,
                    zeroLineColor: "#656565",
                  }
                }
              ],
              yAxes: [
                {
                  ticks: {
                    display: true,
                    min: -1.5,
                    max: 1.5,
                    stepSize: null,
                    fontColor: 'rgba(95, 138, 211, 1)',
                    fontSize: 13,
                    fontStyle: 'bold'
                  },
                  gridLines: {
                    display: true,
                    color: "#656565",
                    zeroLineWidth: 1,
                    zeroLineColor: "#656565",
                  }
                }
              ],
            },
          },
        }
      }
    }
    return
  }
  if (name.length == 3 && !isNaN(name[0]) && !isNaN(name[1]) && !isNaN(name[2]) && name[0] > 0 && name[1] > 0 && name[2] > 0) {
    players.push(new Player("EXAMPLE", name[0], name[1], name[2], 0, 0, 60, null))
    updateChart()
    var url = await axios.post('https://quickchart.io/chart/create', chartData)
    client.channels.cache.get(generalChannelLocal).send(url.data.url)
    return
  } else {
    if (name.length == 3 && !isNaN(name[0]) && !isNaN(name[1]) && !isNaN(name[2]) && name[0] <= 0 || name[1] <= 0 || name[2] <= 0) {
      client.channels.cache.get(generalChannelLocal).send("Please make sure that you don't enter negative or zero numbers as your input.")
      return
    }
  }
  for (let i = 0; i < name.length; i++) { // You could combine this with the other loop for name.length
    // but it becomes a lot harder to read when you do.
    if (String(name[i]).length <= 2) {
      client.channels.cache.get(generalChannelLocal).send(name[i] + " is not a valid user as their name is too short to be valid.")
      name.splice(i, 1)
      i -= 1
    }
  }
  const promises = [];
  for (let i = 0; i < Number(name.length); i++) { // Loop through the list and grab stats using the same method as before.
    try {
      promises.push(axios({
        url: 'https://ch.tetr.io/api/users/' + String(name[i]),
        method: 'get',
      }))
    }
    catch (err) { // In case the data fails to load for whatever reason.
      console.error(err);
    }
  }
  const results = await Promise.allSettled(promises);
  for (let i = 0; i < results.length; i++) {
    try {
      const result = results[i];
      if (result.status == "rejected") {
        console.error(result.reason);
        continue;
      }
      let res = result.value;
      output = (res.data);
      // This basically does the same thing as the assign function, but for unranked players.
      if (output.success == false || output.data.user.league.apm == null) {
        if (String(name[i]).length > 4 && String(name[i]).length <= 6) {
          if (String(name[i].slice(0, 4)).toLowerCase() == "$avg") {
            let rankSearch = ""
            if (rankArray.indexOf(String(name[i].slice(-2).toLowerCase())) == -1) {
              rankSearch = String(name[i].slice(-1).toLowerCase())
            } else {
              rankSearch = String(name[i].slice(-2).toLowerCase())
            }
            if (rankArray.indexOf(rankSearch) == -1) {
              client.channels.cache.get(generalChannelLocal).send(rankSearch + " is not a valid rank!")
            } else {
              temp = avgPlayers[rankArray.indexOf(rankSearch)] // Makes a deep copy
              players.push(avgPlayers[rankArray.indexOf(rankSearch)])
            }
          }
        }
        if (!name[i].includes("$")) {
          client.channels.cache.get(generalChannelLocal).send(name[i] + " is not a valid user! (Perhaps they were banned?)")
        }
        continue;
        // }
      }
      temp = new Player(String(name[i]).toLowerCase(), output.data.user.league.apm,
        output.data.user.league.pps,
        output.data.user.league.vs,
        output.data.user.league.rating,
        output.data.user.league.glicko,
        output.data.user.league.rd,
        output.data.user)
      players.push(temp);
    }
    catch (e) { // In case the data fails to load for whatever reason.
      console.error(e);
    }
  }
  if (players.length == 0) { // Because the axios return doesn't really "return"
    return
  }
  await updateChart()
  if (charttype == "scatter") {
    client.channels.cache.get(generalChannelLocal).send("`Left is more plonk, right is more stride, down is more inf ds, up is more opener.`")
  }
  var url = axios.post('https://quickchart.io/chart/create', chartData).then(function (response) {
    client.channels.cache.get(generalChannelLocal).send(response.data.url)
  })
}

async function copycat(name) {
  let player; // Will store the player we're looking for the closest to.
  let tempPList = pList.map(a => { return { ...a } }) // Create a copy of the objects in our pList to modify as we see fit
  let generalChannelLocal = generalChannel // Just for making sure things get sent to the right channels.
  let category = "old"; // Similar in what regard? (Old is a placeholder for backwards compatability)
  let number = 5; // Number of people to display.
  console.log(name)
  if (name.length < 2) {
    category = "old"
    number = 1
  } else {
    if (!isNaN(name[0]) && !isNaN(name[1]) && !isNaN(name[2]) && name[0] > 0 && name[1] > 0 && name[2] > 0) {
      player = new Player("EXAMPLE", name[0], name[1], name[2], 0, 0, 60, null)
      name.splice(0, 3)
      name.unshift("EXAMPLE")
      console.log(name)
    } else {
      category = name[1].toLowerCase()
      number = Number(name[2])
    }
  }
  // Both of the below are just for people who might input the wrong name for the category unknowingly.
  if (name.length > 2) {
    if (name[name.length - 3].toLowerCase() == "without" && name[name.length - 2].toLowerCase() == "rate") {
      category = "norate"
      console.log(name)
      name.splice(name.length - 2, 1)
      name[name.length - 2] = "norate"
      console.log(name)
      number = name[name.length - 1]
    }
  }
  if (category == "overall") {
    category = "all"
  }
  if (!isNaN(name[1]) && player == undefined) {
    category = "old"
    number = Number(name[1])
  }
  console.log(name[1])
  console.log(number)
  if (player != undefined && name[1] == undefined) {
    category = "old"
  } else {
    if (player != undefined && name[1] != undefined) {
      category = String(name[1]).toLowerCase()
      if (name[2] != undefined) {
        number = Number(name[2])
      }
    }
  }

  number = isNaN(number) ? 5 : number

  console.log(number)
  if (number > 50 || (number > 13 && category == "old")) {
    return client.channels.cache.get(generalChannelLocal).send("Please keep the display number to 50 or lower, or to 13 or lower if no category is specified. This is due to discord character limits.");
  }
  if (number < 1) {
    number = 1
  }
  if (name.length > 3) {
    return client.channels.cache.get(generalChannelLocal).send("Too many parameters were input.");
  }
  if (category == "nonrate" || category == "basic") {
    category = "norate"
  }
  if ((name[0] == undefined || name[0] == "undefined") && player == undefined) { // If we don't have a first parameter (shouldn't be possible)
    return client.channels.cache.get(generalChannelLocal).send("No player was chosen! To use this command, please type `!cc [name]` and any other specifications you need.");
  }
  if (String(name[0]).length > 2 && !name[0].includes('$') && player == undefined) {
    await axios.get('https://ch.tetr.io/api/users/' + String(name[0]).toLowerCase()) // Fetch with axios
      .then(function (response) { // Then do the following...
        output = (response.data); // Assign output to the raw data.
        if (response.data.success == false || output.data.user.role == "anon" || output == undefined) { // If the player is an anon, the string couldn't be grabbed or leagueCheck is undefined for whatever reason.
          client.channels.cache.get(generalChannelLocal).send(name[0] + " is an invalid user. The user appears to be an anonymous account.")
          return
        }
        if (output.data.user.league.gamesplayed == 0) {
          client.channels.cache.get(generalChannelLocal).send(name[0] + " is an invalid user. Player has never played a Tetra League game.")
          return
        }
        player = new Player(String(name[0]).toLowerCase(), output.data.user.league.apm, output.data.user.league.pps, output.data.user.league.vs, output.data.user.league.rating, output.data.user.league.glicko, output.data.user.league.rd, output.data.user)
        console.log(player) // Show a console log of them
        tempPList = tempPList.filter(function (pl) { // Filter our pList copy...
          return pl.name != player.name; // ...to remove the person we're searching for
        });
      })
  } else {
    if (name[0].length > 4 && name[0].length <= 6 && player == undefined) {
      let avgRank = ""
      if (String(name[0].slice(0, 4)).toLowerCase() == "$avg") {
        if (rankArray.indexOf(String(name[0].slice(-2).toLowerCase())) == -1) {
          avgRank = String(name[0].slice(-1).toLowerCase())
        } else {
          avgRank = String(name[0].slice(-2).toLowerCase())
        }
        player = avgPlayers[rankArray.indexOf(avgRank)] // Makes a deep copy
        if (rankArray.indexOf(avgRank) == -1) {
          return client.channels.cache.get(generalChannelLocal).send(name[0] + " is an invalid rank!")
        }
      }
    }
  }
  if (player == null) {
    return
  }
  function closestPlayer(N, stat) { // N = number to return, stat = stat to compare
    tempPList.sort((a, b) => { // Sort our array by abs distance away from our player's stat
      return a[stat] - b[stat]
    });
    let tmp = tempPList.slice(0)
    return tmp.splice(0, N)
  }
  function statDistance() { // N = number to return, stat = stat to compare
    tempPList.forEach(function (p) {
      // You may ask "why do this here and not just get a basic for the player variable and compare with that", but that's not the point.
      // If we did it like that, we'd just be finding stat *totals* that are similar and not a sum of how close every stat is
      p["norate"] = Number((Math.abs(p["apm"] - player["apm"]) * apmweight) + (Math.abs(p["pps"] - player["pps"]) * ppsweight) + (Math.abs(p["vs"] - player["vs"]) * vsweight) + (Math.abs(p["dss"] - player["dss"]) * dssweight))
      p["rate"] = Number((Math.abs(p["app"] - player["app"]) * appweight) + (Math.abs(p["dsp"] - player["dsp"]) * dspweight) + (Math.abs(p["dsapp"] - player["dsapp"]) * dsappweight) + (Math.abs(p["vsapm"] - player["vsapm"]) * vsapmweight) + (Math.abs(p["ge"] - player["ge"]) * geweight) + (Math.abs(p["ci"] - player["ci"]) * ciweight))
      p["playstyle"] = Number((Math.abs(p["opener"] - player["opener"])) + (Math.abs(p["plonk"] - player["plonk"])) + (Math.abs(p["infds"] - player["infds"])) + (Math.abs(p["stride"] - player["stride"])))
      p["all"] = Number((Math.abs(p["apm"] - player["apm"]) * apmweight) + (Math.abs(p["pps"] - player["pps"]) * ppsweight) + (Math.abs(p["vs"] - player["vs"]) * vsweight) + (Math.abs(p["dss"] - player["dss"]) * dssweight) + (Math.abs(p["app"] - player["app"]) * appweight) + (Math.abs(p["dsp"] - player["dsp"]) * dspweight) + (Math.abs(p["dsapp"] - player["dsapp"]) * dsappweight) + (Math.abs(p["vsapm"] - player["vsapm"]) * vsapmweight) + (Math.abs(p["ge"] - player["ge"]) * geweight) + (Math.abs(p["ci"] - player["ci"]) * ciweight))
    });
  }
  statDistance()
  console.log(category)
  if (category != "old") {
    sendList = closestPlayer(number, category)
    let msgSend = "```Closest players to " + player.name + " by " + category + "\n"
    for (let i = 0; i < number; i++) {
      msgSend += sendList.map(sendList => sendList["name"])[i] + " (Similarity: " + Number(sendList.map(sendList => sendList[category])[i].toFixed(4)) + ")\n"
    }
    return client.channels.cache.get(generalChannelLocal).send(msgSend + "```")
  } else {
    let allPlayer = closestPlayer(number, "all")
    let basicPlayer = closestPlayer(number, "norate")
    let ratePlayer = closestPlayer(number, "rate")
    let playstylePlayer = closestPlayer(number, "playstyle")
    console.log(allPlayer)
    console.log(allPlayer.length)
    client.channels.cache.get(generalChannelLocal).send("```\n" + name[0].toUpperCase() + "'s closest" +
      "\nClosest overall:\n" +
      allPlayer.map(allPlayer => allPlayer["name"] + " (Similarity: " + allPlayer["all"].toFixed(4) + ")").join("\n") +
      "\n---------\nClosest rate:\n" +
      ratePlayer.map(ratePlayer => ratePlayer["name"] + " (Similarity: " + ratePlayer["rate"].toFixed(4) + ")").join("\n") +
      "\n---------\nClosest without rate:\n" +
      basicPlayer.map(basicPlayer => basicPlayer["name"] + " (Similarity: " + basicPlayer["norate"].toFixed(4) + ")").join("\n") +
      "\n---------\nClosest playstyle:\n" +
      playstylePlayer.map(playstylePlayer => playstylePlayer["name"] + " (Similarity: " + playstylePlayer["playstyle"].toFixed(4) + ")").join("\n") + "\n```"
    )
    //console.log(sendList.map(sendList => sendList["name"]))
  }
}

async function allcomp(name) {
  var player;
  let closestPlayers = [] // Array to hold our closest players
  let generalChannelLocal = generalChannel
  let tempPList = pList.map(a => { return { ...a } }) // Copy of the pList just in case we need it.
  if (name.length > 2) {
    if (!isNaN(name[0]) && !isNaN(name[1]) && !isNaN(name[2]) && name[0] > 0 && name[1] > 0 && name[2] > 0) {
      player = new Player("EXAMPLE", name[0], name[1], name[2], 0, 0, 60, null)
      name.splice(0, 3)
      name.unshift("EXAMPLE")
      console.log(name)
    }
  }
  if (player == undefined) {
    if (name[0] != undefined) {
      var nameString = name[0].toLowerCase()
      if (nameString.length <= 2) {
        return client.channels.cache.get(generalChannelLocal).send(nameString + " is not a valid name!")
      }
      if (String(name[0].slice(0, 4)).toLowerCase() == "$avg") {
        let avgRank = ""
        if (rankArray.indexOf(String(name[0].slice(-2).toLowerCase())) == -1) {
          avgRank = String(name[0].slice(-1).toLowerCase())
        } else {
          avgRank = String(name[0].slice(-2).toLowerCase())
        }
        player = avgPlayers[rankArray.indexOf(avgRank)] // Makes a deep copy
        if (rankArray.indexOf(avgRank) == -1) {
          return client.channels.cache.get(generalChannelLocal).send(name[0] + " is an invalid rank!")
        }
      } else {
        await axios.get('https://ch.tetr.io/api/users/' + nameString) // Fetch with axios
          .then(function (response) { // Then do the following...
            output = (response.data); // Assign output to the raw data.
            if (response.data.success == false || output.data.user.role == "anon" || output == undefined) { // If the player is an anon, the string couldn't be grabbed or leagueCheck is undefined for whatever reason.
              return client.channels.cache.get(generalChannelLocal).send(name[0] + " is an invalid user. The user appears to be an anonymous account.")
            }
            if (output.data.user.league.gamesplayed == 0) {
              return client.channels.cache.get(generalChannelLocal).send(name[0] + " is an invalid user. Player has never played a Tetra League game.")
            }
            if (output.data.user.league.vs == null) {
              return client.channels.cache.get(generalChannelLocal).send(name[0] + "is an invalid user, as they don't have a versus stat!")
            }
            player = new Player(String(name[0]).toLowerCase(), output.data.user.league.apm, output.data.user.league.pps, output.data.user.league.vs, output.data.user.league.rating, output.data.user.league.glicko, output.data.user.league.rd, output.data.user)
            console.log(player) // Show a console log of them
            tempPList = tempPList.filter(function (pl) { // Filter our pList copy...
              return pl.name != player.name; // ...to remove the person we're searching for
            });
          })
      }
    }
  }
  console.log(nameString)
  let properties = []
  for (const property in player) {
    if (property != "name" && property != "id" && property != "rank" && property != "position" && property != "tr" && property != "glicko" && property != "avatar" && property != "country" && property != "rd") {
      properties.push(property)
    }
  }
  if (properties.length == 0) { // Because some of the returns in the axios section don't work right, we'll catch them here instead.
    return
  }

  let searchFrom = 0
  let searchTo = pList.length
  var rankSearchTop;
  var rankSearchBottom;
  console.log(name)
  if (isNaN(Number(name[2])) && name[2] != undefined && rankArray.indexOf(name[2]) != -1) {
    rankSearchBottom = name[2].toLowerCase() // For double rank search when implemented
  } else {
    if (name[2] != undefined) {
      searchTo = Number(name[2])
      console.log("searchTo: " + searchTo)
    }
  }
  if (searchTo > pList.length || isNaN(searchTo)) {
    searchTo = pList.length
  }
  console.log(name[1])
  if (isNaN(Number(name[1])) && name[1] != undefined) {
    rankSearchTop = name[1].toLowerCase() // Determine what rank the player is searching for.
  } else {
    searchFrom = Number(name[1])
  }
  if (name[1] == undefined) {
    searchFrom = 0
  }
  if (isNaN(searchFrom)) {
    searchFrom = 1
  }
  if (searchFrom < 0) {
    searchFrom = 0
  }
  console.log("This is searchFrom: " + searchFrom + " and this is searchTo: " + searchTo)
  console.log("This is rankSearchTop: " + rankSearchTop + " and this is rankSearchBottom: " + rankSearchBottom)
  if (rankArray.indexOf(rankSearchTop) != -1 || rankArray.indexOf(rankSearchBottom) != -1) {
    console.log("Ranks are being searched!")
    if (rankSearchTop != undefined && rankSearchBottom == undefined) {
      rankSearchBottom = rankSearchTop
    }
    rankSearchTop = rankArray.indexOf(rankSearchTop)
    rankSearchBottom = rankArray.indexOf(rankSearchBottom)
    if (rankSearchTop == 17) { // This handles unranked players
      searchFrom = 0
    }
    if (rankSearchTop == 17 && rankSearchBottom != 17) { // So does this
      let tmp = rankSearchBottom
      rankSearchTop = tmp
      rankSearchBottom = 17
    }
    if (rankSearchBottom == 17) { // And this too
      searchFrom = 0
    }
    tempPList.forEach(function (p) {
      p.rank = rankArray.indexOf(p.rank)
    });
    tempPList = tempPList.filter(p => p.rank <= rankSearchBottom && p.rank >= rankSearchTop && p.position <= searchTo && p.position >= searchFrom); // Filter our copy of the player list to only include people in the rank being
  } else {
    tempPList = tempPList.filter(p => p.position >= searchFrom && p.position <= searchTo); // Filter our copy of the player list to only include people in the rank being
  }
  if (tempPList.length == 0) {
    return client.channels.cache.get(generalChannelLocal).send("There is nobody that matches the specifications you entered!"
      + " This is most likely caused by entering a position or rank combination with no people in it.\n"
      + "For example, please enter `!ac explorat0ri x u` instead of `!ac explorat0ri u x`, or `!ac explorat0ri 100 1000` instead of `!ac explorat0ri 1000 100`")
  }
  console.log(properties)
  searchFrom = tempPList[0].position // This is for the "from position X to Y" text that shows as the header
  searchTo = tempPList[tempPList.length - 1].position // Same as above, but for the Y and not the X/
  if (searchFrom == 1 && searchTo == 0) { // This only really happens if neither setting is set
    searchTo = pList.length // The only reason we're changing it is so the header looks nice.
    searchFrom = 0
  }
  for (let i = 0; i < properties.length; i++) {
    tempPList = tempPList.sort((a, b) => { if (Math.abs(a[properties[i]] - player[properties[i]]) > Math.abs(b[properties[i]] - player[properties[i]])) return 1; if (Math.abs(a[properties[i]] - player[properties[i]]) < Math.abs(b[properties[i]] - player[properties[i]])) return -1; if (Math.abs(a[properties[i]] - player[properties[i]]) == Math.abs(b[properties[i]] - player[properties[i]])) return 0; })
    //Additional conditions would be placed here.
    closestPlayers.push(tempPList[0])
  }
  //console.log(closestPlayers)
  const exampleEmbed = new MessageEmbed() // Make the embed field
    .setColor('#0099ff')
    .setTitle("Closest players to " + String(player.name).toUpperCase() + " from position " + searchFrom + " to " + searchTo)
    .setURL('https://ch.tetr.io/u/' + String(player.name).toLowerCase())
    .setAuthor('Kerrmunism / explorat0ri', 'https://kerrmunism.neocities.org/kapo.PNG', 'https://github.com/Kerrmunism')
    .setThumbnail('https://tetr.io/user-content/avatars/' + player.id + '.jpg?rv=' + player.avatar)
    .setDescription("sheetBot - A bot used to grab more advanced statistics from the ch.tetr.io API")
    .addFields( // Simply add all the lines.
      { name: 'Closest APM:', value: "[" + closestPlayers[0].name + "]" + "(https://ch.tetr.io/u/" + closestPlayers[0].name + "): (Rank #" + ((closestPlayers[0].position == 0) ? "[?]" : closestPlayers[0].position) + "): (" + player.apm.toFixed(2) + " vs. " + closestPlayers[0].apm.toFixed(2) + ")", inline: false },
      { name: 'Closest PPS:', value: "[" + closestPlayers[1].name + "]" + "(https://ch.tetr.io/u/" + closestPlayers[1].name + "): (Rank #" + ((closestPlayers[1].position == 0) ? "[?]" : closestPlayers[1].position) + "): (" + player.pps.toFixed(2) + " vs. " + closestPlayers[1].pps.toFixed(2) + ")", inline: false },
      { name: 'Closest VS:', value: "[" + closestPlayers[2].name + "]" + "(https://ch.tetr.io/u/" + closestPlayers[2].name + "): (Rank #" + ((closestPlayers[2].position == 0) ? "[?]" : closestPlayers[2].position) + "): (" + player.vs.toFixed(2) + " vs. " + closestPlayers[2].vs.toFixed(2) + ")", inline: false },
      { name: 'Closest APP:', value: "[" + closestPlayers[3].name + "]" + "(https://ch.tetr.io/u/" + closestPlayers[3].name + "): (Rank #" + ((closestPlayers[3].position == 0) ? "[?]" : closestPlayers[3].position) + "): (" + player.app.toFixed(4) + " vs. " + closestPlayers[3].app.toFixed(4) + ")", inline: false },
      { name: 'Closest DS/Piece:', value: "[" + closestPlayers[5].name + "]" + "(https://ch.tetr.io/u/" + closestPlayers[5].name + "): (Rank #" + ((closestPlayers[5].position == 0) ? "[?]" : closestPlayers[5].position) + "): (" + player.dsp.toFixed(4) + " vs. " + closestPlayers[5].dsp.toFixed(4) + ")", inline: false },
      { name: 'Closest APP+DS/Piece:', value: "[" + closestPlayers[6].name + "]" + "(https://ch.tetr.io/u/" + closestPlayers[6].name + "): (Rank #" + ((closestPlayers[6].position == 0) ? "[?]" : closestPlayers[6].position) + "): (" + player.dsapp.toFixed(4) + " vs. " + closestPlayers[6].dsapp.toFixed(4) + ")", inline: false },
      { name: 'Closest DS/Second:', value: "[" + closestPlayers[4].name + "]" + "(https://ch.tetr.io/u/" + closestPlayers[4].name + "): (Rank #" + ((closestPlayers[4].position == 0) ? "[?]" : closestPlayers[4].position) + "): (" + player.dss.toFixed(4) + " vs. " + closestPlayers[4].dss.toFixed(4) + ")", inline: false },
      { name: 'Closest VS/APM:', value: "[" + closestPlayers[7].name + "]" + "(https://ch.tetr.io/u/" + closestPlayers[7].name + "): (Rank #" + ((closestPlayers[7].position == 0) ? "[?]" : closestPlayers[7].position) + "): (" + player.vsapm.toFixed(4) + " vs. " + closestPlayers[7].vsapm.toFixed(4) + ")", inline: false },
      { name: 'Closest Cheese Index:', value: "[" + closestPlayers[8].name + "]" + "(https://ch.tetr.io/u/" + closestPlayers[8].name + "): (Rank #" + ((closestPlayers[8].position == 0) ? "[?]" : closestPlayers[8].position) + "): (" + player.ci.toFixed(4) + " vs. " + closestPlayers[8].ci.toFixed(4) + ")", inline: false },
      { name: 'Closest Garbage Effi.:', value: "[" + closestPlayers[9].name + "]" + "(https://ch.tetr.io/u/" + closestPlayers[9].name + "): (Rank #" + ((closestPlayers[9].position == 0) ? "[?]" : closestPlayers[9].position) + "): (" + player.ge.toFixed(4) + " vs. " + closestPlayers[9].ge.toFixed(4) + ")", inline: false },
      { name: 'Closest Weighted APP:', value: "[" + closestPlayers[10].name + "]" + "(https://ch.tetr.io/u/" + closestPlayers[10].name + "): (Rank #" + ((closestPlayers[10].position == 0) ? "[?]" : closestPlayers[10].position) + "): (" + player.wapp.toFixed(4) + " vs. " + closestPlayers[10].wapp.toFixed(4) + ")", inline: false },
      { name: 'Closest Area:', value: "[" + closestPlayers[11].name + "]" + "(https://ch.tetr.io/u/" + closestPlayers[11].name + "): (Rank #" + ((closestPlayers[11].position == 0) ? "[?]" : closestPlayers[11].position) + "): (" + player.area.toFixed(4) + " vs. " + closestPlayers[11].area.toFixed(4) + ")", inline: false },
      { name: 'Closest Opener:', value: "[" + closestPlayers[17].name + "]" + "(https://ch.tetr.io/u/" + closestPlayers[17].name + "): (Rank #" + ((closestPlayers[17].position == 0) ? "[?]" : closestPlayers[17].position) + "): (" + player.opener.toFixed(4) + " vs. " + closestPlayers[17].opener.toFixed(4) + ")", inline: false },
      { name: 'Closest Plonk:', value: "[" + closestPlayers[18].name + "]" + "(https://ch.tetr.io/u/" + closestPlayers[18].name + "): (Rank #" + ((closestPlayers[18].position == 0) ? "[?]" : closestPlayers[18].position) + "): (" + player.plonk.toFixed(4) + " vs. " + closestPlayers[18].plonk.toFixed(4) + ")", inline: false },
      { name: 'Closest Stride:', value: "[" + closestPlayers[19].name + "]" + "(https://ch.tetr.io/u/" + closestPlayers[19].name + "): (Rank #" + ((closestPlayers[19].position == 0) ? "[?]" : closestPlayers[19].position) + "): (" + player.stride.toFixed(4) + " vs. " + closestPlayers[19].stride.toFixed(4) + ")", inline: false },
      { name: 'Closest Inf. DS:', value: "[" + closestPlayers[20].name + "]" + "(https://ch.tetr.io/u/" + closestPlayers[20].name + "): (Rank #" + ((closestPlayers[20].position == 0) ? "[?]" : closestPlayers[20].position) + "): (" + player.infds.toFixed(4) + " vs. " + closestPlayers[20].infds.toFixed(4) + ")", inline: false },
    )
    .addField("Want to know more?", "Use !help calcs for calculation info `^v^`")
    .setTimestamp()
    .setFooter('User ID: ' + player.id + '');
  client.channels.cache.get(generalChannelLocal).send({ embeds: [exampleEmbed] });
}

async function versus(name, relative, tableValue) {
  let generalChannelLocal = generalChannel; // Just for making sure things get sent to the right channels.
  var vsPlayers = [];
  var bgColors = ['rgba(204, 253, 232, 0.65)', 'rgba(48, 186, 255, 0.65)', 'rgba(240, 86, 127, 0.65)', 'rgba(8, 209, 109, 0.65)', 'rgba(237, 156, 17, 0.65)'] // Will hold our fill colors
  var borderColors = ['rgba(75, 118, 191, 1)', 'rgba(204, 33, 201, 1)', 'rgba(250, 5, 70, 1), rgba(28, 232, 130, 1)', 'rgba(250, 177, 42, 1)'] // Will hold the color of the outline
  var maximum = 0; // In charge of setting the max bounds when using !vsr
  var chartData;
  var strictProb // Has to do with win rate
  var estProb // Same with this
  var fileWrite = false
  console.log(name)
  if (name[name.length - 1] == "-v") {
    bgColors = ['rgba(204, 253, 232, 0)', 'rgba(48, 186, 255, 0)', 'rgba(240, 86, 127, 0)', 'rgba(8, 209, 109, 0)', 'rgba(237, 156, 17, 0)']
    borderColors = ['rgba(75, 118, 191, 0.5)', 'rgba(204, 33, 201, 0.5)', 'rgba(250, 5, 70, 0.5)', 'rgba(28, 232, 130, 0.5)', 'rgba(250, 177, 42, 0.5)']
    name.pop()
    if (!tableValue) {
      client.channels.cache.get(generalChannelLocal).send("-v parameter used! The radar graph will now be more visible. Colors after the first 5 will be auto-generated.");
    }
  }
  if (name[name.length - 1] == "-j") {
    client.channels.cache.get(generalChannelLocal).send("-j parameter used! A JSON file will be output.");
    fileWrite = true
    name.pop()
  }
  async function updateChart() {
    chartData = {
      "chart": {
        type: 'radar',
        data: {
          labels: ['APM', 'PPS', 'VS', 'APP', 'DS/Second', 'DS/Piece', 'APP+DS/Piece', 'VS/APM', 'Cheese Index', 'Garbage Effi.'],
          datasets: vsPlayers.map((player, i) => {
            return {
              label: player.name,
              data: [
                (player.apm * apmweight).toFixed(4),
                (player.pps * ppsweight).toFixed(4),
                (player.vs * vsweight).toFixed(4),
                (player.app * appweight).toFixed(4),
                (player.dss * dssweight).toFixed(4),
                (player.dsp * dspweight).toFixed(4),
                (player.dsapp * dsappweight).toFixed(4),
                ((player.vsapm - (relative ? 2 : 0)) * vsapmweight * (relative ? 2.5 : 1)).toFixed(4),
                (player.ci * ciweight).toFixed(4),
                (player.ge * geweight).toFixed(4)
              ],
              backgroundColor: bgColors[i],
              borderColor: borderColors[i],
            }
          }),
        },
        options: {
          legend: {
            labels: {
              fontSize: 14,
              fontStyle: 'bold',
              fontColor: 'rgba(115, 158, 231, 1)',
            },
          },
          scale: {
            pointLabels: {
              fontSize: 13,
              fontColor: 'rgba(95, 138, 211, 1)',
              fontStyle: 'bold'
            },
            rAxis: {
              ticks: {
                display: false
              }
            },
            ticks: {
              min: 0,
              max: relative ? maximum : 180,
              stepSize: relative ? maximum / 6 : 30,
              fontColor: 'blue',
              display: false
            },
            gridLines: {
              color: 'grey'
            },
            angleLines: {
              color: 'grey'
            }
          }
        }
      }
    }
  }
  async function tableMake() {
    var data = [
      ['Names:'],
      ['APM:'],
      ['PPS:'],
      ['VS:'],
      ['APP:'],
      ['DS/Piece:'],
      ['APP+DS/Piece:'],
      ['DS/Second:'],
      ['VS/APM:'],
      ['Cheese Index:'],
      ['Garbage Effi:'],
      ['Weighted APP:'],
      ['Area:']
    ]
    if (vsPlayers.length == 2) {
      data.push(['Win Rate (Glicko): '])
      data.push(['Win Rate (Stats): '])
      vsPlayers[0].strictProb = Number(((1 / (1 + Math.pow(10, (vsPlayers[1].glicko - vsPlayers[0].glicko) / (400 * Math.sqrt(1 + (3 * Math.pow(0.0057564273, 2) * (Math.pow(vsPlayers[0].rd, 2) + Math.pow(vsPlayers[1].rd, 2)) / Math.pow(Math.PI, 2)))))))) * (99 + 1)).toFixed(3)
      vsPlayers[0].estProb = Number(((1 / (1 + Math.pow(10, (vsPlayers[1].estglicko - vsPlayers[0].estglicko) / (400 * Math.sqrt(1 + (3 * Math.pow(0.0057564273, 2) * (Math.pow(vsPlayers[0].rd, 2) + Math.pow(vsPlayers[1].rd, 2)) / Math.pow(Math.PI, 2)))))))) * (99 + 1)).toFixed(3)
      vsPlayers[1].strictProb = Number((100 - vsPlayers[0].strictProb).toFixed(3))
      vsPlayers[1].estProb = Number((100 - vsPlayers[0].estProb).toFixed(3))
    }
    console.log(vsPlayers)
    for (let i = 0; i < vsPlayers.length; i++) {
      data[0].push(vsPlayers[i].name); data[1].push(vsPlayers[i].apm.toFixed(4)); data[2].push(vsPlayers[i].pps.toFixed(4));
      data[3].push(vsPlayers[i].vs.toFixed(4)); data[4].push(vsPlayers[i].app.toFixed(4)); data[5].push(vsPlayers[i].dsp.toFixed(4));
      data[6].push(vsPlayers[i].dsapp.toFixed(4)); data[7].push(vsPlayers[i].dss.toFixed(4)); data[8].push(vsPlayers[i].vsapm.toFixed(4));
      data[9].push(vsPlayers[i].ci.toFixed(4)); data[10].push(vsPlayers[i].ge.toFixed(4)); data[11].push(vsPlayers[i].wapp.toFixed(4));
      data[12].push(vsPlayers[i].area.toFixed(4));
      console.log(data.length)
      console.log(vsPlayers.length)
      if (data.length == 15) {
        data[13].push(vsPlayers[i].strictProb); data[14].push(vsPlayers[i].estProb)
      }
      if (Number.isInteger((i + 1) / 4)) {
        client.channels.cache.get(generalChannelLocal).send("```" + table(data) + "```");
        for (let j = 0; j < 4; j++) {
          for (let k = 0; k < 13; k++) {
            data[k].pop();
          }
        }
      }
    }
    console.log(table(data))
    client.channels.cache.get(generalChannelLocal).send("```" + table(data) + "```");
  }
  async function jsonWrite() {
    fs.writeFile("versus.json", JSON.stringify(vsPlayers), (err) => { if (err) throw err; })
    return
  }
  var temp;
  if (name.length == 3 && !isNaN(name[0]) && !isNaN(name[1]) && !isNaN(name[2]) && name[0] > 0 && name[1] > 0 && name[2] > 0) {
    temp = new Player("EXAMPLE", name[0], name[1], name[2], 0, 0, 60, null)
    vsPlayers.push(temp)
    let maxThisPlayer = Math.max(Number(temp.apm) * apmweight.toFixed(4), Number(temp.pps) * ppsweight.toFixed(4), Number(Number(temp.vs) * vsweight).toFixed(4), Number(Number(temp.app) * appweight).toFixed(4), Number(Number(temp.dss) * dssweight).toFixed(4), Number(Number(temp.dsp) * dspweight).toFixed(4), Number(Number(temp.dsapp) * dsappweight).toFixed(4), Number(Number((temp.vsapm - 2) * vsapmweight) * 2.5).toFixed(4), Number(Number(temp.ci) * ciweight).toFixed(4), Number(Number(temp.ge) * geweight).toFixed(4))
    if (maxThisPlayer > maximum) { // If this player's max is higher than saved max
      maximum = maxThisPlayer // Set saved max to this player's max
    }
    if (tableValue) {
      await tableMake()
      if (fileWrite) {
        await jsonWrite()
        client.channels.cache.get(generalChannelLocal).send({ files: ["versus.json"] });
      }
    } else {
      updateChart()
      var url = await axios.post('https://quickchart.io/chart/create', chartData)
      client.channels.cache.get(generalChannelLocal).send(url.data.url)
    }
    return
  } else {
    if (name.length == 3 && !isNaN(name[0]) && !isNaN(name[1]) && !isNaN(name[2]) && name[0] <= 0 || name[1] <= 0 || name[2] <= 0) {
      client.channels.cache.get(generalChannelLocal).send("Please make sure that you don't enter negative or zero numbers as your input.")
      return
    }
  }
  for (let i = 0; i < name.length; i++) { // You could combine this with the other loop for name.length
    // but it becomes a lot harder to read when you do (and also breaks some things!)
    if (String(name[i]).length <= 2) {
      client.channels.cache.get(generalChannelLocal).send(name[i] + " is not a valid user as their name is too short to be valid.")
      name.splice(i, 1)
      i -= 1
    }
  }
  const promises = [];
  for (let i = 0; i < Number(name.length); i++) { // Loop through the list and grab stats using the same method as before.
    try {
      promises.push(axios({
        url: 'https://ch.tetr.io/api/users/' + String(name[i]),
        method: 'get',
      }))
    }
    catch (err) { // In case the data fails to load for whatever reason.
      console.error(err);
    }
  }
  const results = await Promise.allSettled(promises);
  for (let i = 0; i < results.length; i++) {
    try {
      const result = results[i];
      if (result.status == "rejected") {
        console.error(result.reason);
        continue;
      }
      let res = result.value;
      output = (res.data);
      if (output.success == false || output.data.user.league.apm == null) {
        if (String(name[i]).length > 4 && String(name[i]).length <= 6) {
          if (String(name[i].slice(0, 4)).toLowerCase() == "$avg") {
            let rankSearch = ""
            if (rankArray.indexOf(String(name[i].slice(-2).toLowerCase())) == -1) {
              rankSearch = String(name[i].slice(-1).toLowerCase())
            } else {
              rankSearch = String(name[i].slice(-2).toLowerCase())
            }
            if (rankArray.indexOf(rankSearch) == -1) {
              client.channels.cache.get(generalChannelLocal).send(rankSearch + " is not a valid rank!")
            } else {
              temp = avgPlayers[rankArray.indexOf(rankSearch)] // Makes a deep copy
              vsPlayers.push(temp)
            }
          }
        }
        if (!name[i].includes("$")) {
          client.channels.cache.get(generalChannelLocal).send(name[i] + " is not a valid user! (Perhaps they were banned?)")
        }
        continue;
        // }
      }
      temp = new Player(String(name[i]).toLowerCase(), output.data.user.league.apm,
        output.data.user.league.pps,
        output.data.user.league.vs,
        output.data.user.league.rating,
        output.data.user.league.glicko,
        output.data.user.league.rd,
        output.data.user)
      let maxThisPlayer = Math.max(Number(temp.apm) * apmweight.toFixed(4), Number(temp.pps) * ppsweight.toFixed(4), Number(Number(temp.vs) * vsweight).toFixed(4), Number(Number(temp.app) * appweight).toFixed(4), Number(Number(temp.dss) * dssweight).toFixed(4), Number(Number(temp.dsp) * dspweight).toFixed(4), Number(Number(temp.dsapp) * dsappweight).toFixed(4), Number(Number((temp.vsapm - 2) * vsapmweight) * 2.5).toFixed(4), Number(Number(temp.ci) * ciweight).toFixed(4), Number(Number(temp.ge) * geweight).toFixed(4))
      if (maxThisPlayer > maximum) { // If this player's max is higher than saved max
        maximum = maxThisPlayer // Set saved max to this player's max
      }
      vsPlayers.push(temp);
    }
    catch (e) { // In case the data fails to load for whatever reason.
      console.error(e);
    }
  }
  let maxThisPlayer = Math.max(Number(temp.apm) * apmweight.toFixed(4), Number(temp.pps) * ppsweight.toFixed(4), Number(Number(temp.vs) * vsweight).toFixed(4), Number(Number(temp.app) * appweight).toFixed(4), Number(Number(temp.dss) * dssweight).toFixed(4), Number(Number(temp.dsp) * dspweight).toFixed(4), Number(Number(temp.dsapp) * dsappweight).toFixed(4), Number(Number((temp.vsapm - 2) * vsapmweight) * 2.5).toFixed(4), Number(Number(temp.ci) * ciweight).toFixed(4), Number(Number(temp.ge) * geweight).toFixed(4))
  if (maxThisPlayer > maximum) { // If this player's max is higher than saved max
    maximum = maxThisPlayer // Set saved max to this player's max
  }
  if (vsPlayers.length > 1) {
    strictProb = Number(((1 / (1 + Math.pow(10, (vsPlayers[1].glicko - vsPlayers[0].glicko) / (400 * Math.sqrt(1 + (3 * Math.pow(0.0057564273, 2) * (Math.pow(vsPlayers[0].rd, 2) + Math.pow(vsPlayers[1].rd, 2)) / Math.pow(Math.PI, 2)))))))) * (99 + 1)).toFixed(3)
    estProb = Number(((1 / (1 + Math.pow(10, (vsPlayers[1].estglicko - vsPlayers[0].estglicko) / (400 * Math.sqrt(1 + (3 * Math.pow(0.0057564273, 2) * (Math.pow(vsPlayers[0].rd, 2) + Math.pow(vsPlayers[1].rd, 2)) / Math.pow(Math.PI, 2)))))))) * (99 + 1)).toFixed(3)
  }
  console.log(maximum)
  if (tableValue) {
    await tableMake()
    if (fileWrite) {
      await jsonWrite()
      client.channels.cache.get(generalChannelLocal).send({ files: ["versus.json"] });
    }
  } else {
    await updateChart()
    if (vsPlayers.length > 1) {
      client.channels.cache.get(generalChannelLocal).send(vsPlayers[0].name + " has an approximated " + strictProb + "% chance of beating " + vsPlayers[1].name + " based on glicko.\n"
        + vsPlayers[0].name + " has an approximated " + estProb + "% chance of beating " + vsPlayers[1].name + " using estimated glicko from stats.");
    }
    var url = axios.post('https://quickchart.io/chart/create', chartData).then(function (response) {
      client.channels.cache.get(generalChannelLocal).send(response.data.url)
    })
  }
}

async function tetostat(name) {
  let generalChannelLocal = generalChannel // Just for making sure things get sent to the right channels.
  var statPlayer; // Default player
  let rankSearch = "" // For if we're grabbing an average player
  if (name.length >= 3) { // If inputting stats
    // Below line is checking for if stats are actually valid
    if (!isNaN(name[0]) && !isNaN(name[1]) && !isNaN(name[2]) && name[0] > 0 && name[1] > 0 && name[2] > 0) {
      statPlayer = new Player("EXAMPLE", name[0], name[1], name[2], 0, 0, 60, null)
      statPlayer.id = 0
      statPlayer.avatar = null
    } else {
      client.channels.cache.get(generalChannelLocal).send("One or more inputs were invalid. \n Make sure your input is either a username to search for or a set of 3 numbers representing APM, PPS and VS, in that order.");
      return
    }
  }
  console.log(name[0] + " , " + name[0].length + " , " + String(name[0].slice(0, 4)).toLowerCase())
  if (name[0].length > 4 && name[0].length <= 6) {
    if (String(name[0].slice(0, 4)).toLowerCase() == "$avg") {
      if (rankArray.indexOf(String(name[0].slice(-2).toLowerCase())) == -1) {
        rankSearch = String(name[0].slice(-1).toLowerCase())
      } else {
        rankSearch = String(name[0].slice(-2).toLowerCase())
      }
      statPlayer = avgPlayers[rankArray.indexOf(rankSearch)]
      if (rankArray.indexOf(rankSearch) == -1) {
        return client.channels.cache.get(generalChannelLocal).send(name[0] + " is an invalid rank!")
      }
    }
  }
  if (String(name[0]).length < 3 && statPlayer == undefined) {
    return client.channels.cache.get(generalChannelLocal).send("Invalid user. " + name[0] + " is too short to be a proper player name!")
  }
  if ((name.length == 1 && String(name[0]).length > 2 && statPlayer == undefined) || // Normal input with just a name
    (name.length == 2 && String(name[0]).length > 2 && statPlayer == undefined)) { // Detailed with name
    await axios.get('https://ch.tetr.io/api/users/' + String(name[0]).toLowerCase()) // Fetch with axios
      .then(function (response) { // Then do the following...
        output = (response.data); // Assign output to the raw data.
        if (output.success == false || output.data.user.role == "anon" || output == undefined) { // If the player is an anon, the string couldn't be grabbed or leagueCheck is undefined for whatever reason.
          return client.channels.cache.get(generalChannelLocal).send("Invalid user.")
        }
        if (output.data.user.league.gamesplayed == 0) {
          return client.channels.cache.get(generalChannelLocal).send("Invalid user. Player has never played a Tetra League game.")
        }
        statPlayer = new Player(String(name[0]).toLowerCase(), output.data.user.league.apm,
          output.data.user.league.pps,
          output.data.user.league.vs,
          output.data.user.league.rating,
          output.data.user.league.glicko,
          output.data.user.league.rd,
          output.data.user)
      })
  }
  console.debug(statPlayer)
  if (statPlayer == undefined) { return } // This is just needed because of the way returns work in axios. 
  // It'd keep trying to go through the rest of the function even after the return messages above otherwise.
  if (String(name[name.length - 1]).toLowerCase() == "-m" || String(name[name.length - 1]).toLowerCase() == "-min" || String(name[name.length - 1]).toLowerCase() == "-minimal") {
    const exampleEmbed = new MessageEmbed() // Make the embed field
      .setColor('#0099ff')
      .setTitle(((statPlayer.glicko != 0) ? String(name[0]).toUpperCase() : "ADVANCED STATS FOR VALUES OF [" + statPlayer.apm + ", " + statPlayer.pps + ", " + statPlayer.vs + "]"))
      .setURL('https://ch.tetr.io' + ((statPlayer.glicko != 0) ? "/u/" + String(name[0]).toLowerCase() : ""))
      .setAuthor('Kerrmunism / explorat0ri', 'https://kerrmunism.neocities.org/kapo.PNG', 'https://github.com/Kerrmunism')
      .setThumbnail('https://tetr.io/user-content/avatars/' + statPlayer.id + '.jpg?rv=' + statPlayer.avatar)
      .setDescription("sheetBot - A bot used to grab more advanced statistics from the ch.tetr.io API")
      .addFields( // Simply add all the lines.
        { name: 'APM', value: statPlayer.apm.toFixed(2), inline: true },
        { name: 'PPS', value: statPlayer.pps.toFixed(2), inline: true },
        { name: 'VS', value: statPlayer.vs.toFixed(2), inline: true },
        { name: 'DS/Second', value: statPlayer.dss.toFixed(4), inline: true },
        { name: 'DS/Piece', value: statPlayer.dsp.toFixed(4), inline: true },
        { name: 'APP+DS/Piece', value: statPlayer.dsapp.toFixed(4), inline: true },
        { name: 'APP', value: statPlayer.app.toFixed(4), inline: true },
        { name: 'VS/APM', value: statPlayer.vsapm.toFixed(4), inline: true },
        { name: 'Cheese Index', value: statPlayer.ci.toFixed(4), inline: true },
        { name: 'Garbage Effi.', value: statPlayer.ge.toFixed(4), inline: true },
        { name: 'Weighted APP', value: statPlayer.wapp.toFixed(4), inline: true },
        { name: 'Area', value: statPlayer.area.toFixed(4), inline: true },
      )
    if (statPlayer.glicko != 0) { // So that this won't show if you're just inputting stats     
      exampleEmbed.addFields(
        { name: 'Glicko', value: statPlayer.glicko.toFixed(2) + " ±" + statPlayer.rd.toFixed(2), inline: true },
        { name: 'TR', value: statPlayer.tr.toFixed(2), inline: true },
        { name: 'Rank', value: String(statPlayer.rank).toUpperCase(), inline: true }, // Slice removes surrounding quotes.
      )
    }
    exampleEmbed
      .addField("Want to know more?", "Use !help calcs for calculation info `^v^`")
      .setTimestamp()
      .setFooter('User ID: ' + statPlayer.id + '');
    client.channels.cache.get(generalChannelLocal).send({ embeds: [exampleEmbed] });
    return
  } else {
    const exampleEmbed = new MessageEmbed() // Make the embed field
      .setColor('#0099ff')
      .setTitle(((statPlayer.glicko != 0) ? String(name[0]).toUpperCase() : "ADVANCED STATS FOR VALUES OF [" + statPlayer.apm + ", " + statPlayer.pps + ", " + statPlayer.vs + "]"))
      .setURL('https://ch.tetr.io' + ((statPlayer.glicko != 0) ? "/u/" + String(name[0]).toLowerCase() : ""))
      .setAuthor('Kerrmunism / explorat0ri', 'https://kerrmunism.neocities.org/kapo.PNG', 'https://github.com/Kerrmunism')
      //.setThumbnail('https://tetr.io/user-content/avatars/' + statPlayer.id + '.jpg?rv=' + statPlayer.avatar)
      .setDescription("sheetBot - A bot used to grab more advanced statistics from the ch.tetr.io API")
      .addFields( // Simply add all the lines.
        { name: 'APM', value: statPlayer.apm.toFixed(2), inline: true }, // This one in particular needs it
        { name: 'PPS', value: statPlayer.pps.toFixed(2), inline: true },
        { name: 'VS', value: statPlayer.vs.toFixed(2), inline: true },
        { name: 'DS/Piece', value: statPlayer.dsp.toFixed(4), inline: true },
        { name: 'APP', value: statPlayer.app.toFixed(4), inline: true },
        { name: 'APP+DS/Piece', value: statPlayer.dsapp.toFixed(4), inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        { name: 'Rank', value: String(statPlayer.rank).toUpperCase(), inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        {
          name: 'Advanced:',
          value: '➤DS/Second: **'
            + String(statPlayer.dss.toFixed(4)) + "\n"
            + "**➤VS/APM: **"
            + String(statPlayer.vsapm.toFixed(4)) + "\n"
            + "**➤Garbage Effi.: **"
            + String(statPlayer.ge.toFixed(4)) + "\n"
            + "**➤Cheese Index: **"
            + String(statPlayer.ci.toFixed(4)) + "\n"
            + "**➤Weighted APP: **"
            + String(statPlayer.wapp.toFixed(4)) + "**\n\n"
          , inline: true
        },
        {
          name: 'Ranking:',
          value: '➤Area: **'
            + String(statPlayer.area.toFixed(4)) + "\n"
            + ((statPlayer.rank != "null" && statPlayer.rank != null) ? "**➤TR: **" : "")
            + ((statPlayer.rank != "null" && statPlayer.rank != null) ? String(statPlayer.tr.toFixed(2)) + "\n" : "")
            + "**➤Est. TR: **"
            + String(statPlayer.esttr.toFixed(2)) + "\n"
            + ((statPlayer.rank != "null" && statPlayer.rank != null) ? "**➤Acc. of TR Est.: **" + ((statPlayer.atr > 0) ? "+" : "") : "**")
            + ((statPlayer.rank != "null" && statPlayer.rank != null) ? String(statPlayer.atr.toFixed(2)) + "\n" : "")
            + ((statPlayer.rank != "null" && statPlayer.rank != null) ? "**➤Glicko: **" : '')
            + ((statPlayer.rank != "null" && statPlayer.rank != null) ? String(statPlayer.glicko.toFixed(2) + "**±" + statPlayer.rd.toFixed(2)) + "\n\n" : '')
          , inline: true
        },
        {
          name: 'Playstyle:',
          value: '➤Opener: **' +
            + String(statPlayer.opener.toFixed(4)) + "\n"
            + "**➤Plonk: **" +
            + String(statPlayer.plonk.toFixed(4)) + "\n"
            + "**➤Stride: **" +
            + String(statPlayer.stride.toFixed(4)) + "\n"
            + "**➤Inf DS: **" +
            + String(statPlayer.infds.toFixed(4)) + "**\n\n"
          , inline: true
        },
      )
      .addField("Want to know more?", "Use !help calcs for calculation info `^v^`")
      .setTimestamp()
      .setFooter('User ID: ' + statPlayer.id + '');
    client.channels.cache.get(generalChannelLocal).send({ embeds: [exampleEmbed] });
    return
  }
}

try {
  client.login(config.token); // Login with the token.
} catch (e) {
  console.log('Error:', e.stack);
}
