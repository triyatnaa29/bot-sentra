const {
  default: makeWASocket,
  DisconnectReason,
  useSingleFileAuthState,
  Browsers,
  isJidGroup,
  makeInMemoryStore,
  jidNormalizedUser,
  fetchLatestBaileysVersion,
  getContentType,
  jidDecode,
  delay,
  isJidStatusBroadcast,
  useMultiFileAuthState,
  getDevice,
} = require("@adiwajshing/baileys");
const { Boom } = require("./node_modules/@hapi/boom");
const _ = require("lodash");
const pino = require("pino");
const CFonts = require("cfonts");
const gradient = require("gradient-string");

let package = require("./package.json");
const yargs = require("yargs/yargs");
const { default: axios } = require("axios");
var qs = require("qs");
var fs = require("fs");
var path = require("path");
const { registerFont, createCanvas, loadImage } = require("canvas");
global.opts = new Object(
  yargs(process.argv.slice(2)).exitProcess(false).parse()
);
global.config = require("./src/config.json");
global.API = config.api;
global.owner = config.owner;
global.footer = `© ${package.name} ${new Date().getFullYear()}`;
let session;
if (opts["server"]) require("./server");
if (opts["test"]) {
  session = "session/test";
} else {
  session = "session/main";
}

const msgRetryCounterMap = {};
// the store maintains the data of the WA connection in memory
// can be written out to a file & read from it
const store = makeInMemoryStore({
  logger: pino().child({ level: "silent", stream: "store" }),
});
store.readFromFile("./db/baileys_store_multi.json");
// save every 10s
setInterval(() => {
  store.writeToFile("./db/baileys_store_multi.json");
}, 10_000);

global.store = store;

/** LOCAL MODULE */
const {
  color,
  bgColor,
  msgs,
  pluginLoader,
  Scandir,
  isLatestVersion,
} = require("./utils");
const { Serialize } = require("./lib/simple");
const cmdMSG = require("./src/cmdMessage.json");
const { statistics, groupManage } = require("./db");
const { exit } = require("yargs");

/** DB */
if (!fs.existsSync("./db/usersJid.json")) {
  fs.writeFileSync("./db/usersJid.json", JSON.stringify([]), "utf-8");
}

let chatsJid = JSON.parse(fs.readFileSync("./db/usersJid.json", "utf-8"));
const START_TIME = Date.now();
fs.writeFileSync("./src/start.txt", START_TIME.toString());

const start = async () => {
  // CFonts.say(`${package.name}`, {
  //   font: "shade",
  //   align: "center",
  //   gradient: ["#12c2e9", "#c471ed"],
  //   transitionGradient: true,
  //   letterSpacing: 3,
  // });
  // CFonts.say(`'${package.name}' Coded By ${package.author}`, {
  //   font: "console",
  //   align: "center",
  //   gradient: ["#DCE35B", "#45B649"],
  //   transitionGradient: true,
  // });
  const { version: WAVersion, isLatest } = await fetchLatestBaileysVersion();
  let pkg = await isLatestVersion();
  console.log(
    color("[SYS]", "cyan"),
    `Package Version`,
    color(`${package.version}`, "#009FF0"),
    "Is Latest :",
    color(`${pkg.isLatest}`, "#f5af19")
  );
  console.log(
    color("[SYS]", "cyan"),
    `WA Version`,
    color(WAVersion.join("."), "#38ef7d"),
    "Is Latest :",
    color(`${isLatest}`, "#f5af19")
  );

  const LAUNCH_TIME_MS = Date.now() - START_TIME;
  console.log(
    color("[SYS]", "cyan"),
    `Client loaded with ${color(
      Object.keys(store.contacts).length,
      "#009FF0"
    )} contacts, ` +
      `${color(store.chats.length, "#009FF0")} chats, ` +
      `${color(Object.keys(store.messages).length, "#009FF0")} messages in ` +
      `${color(LAUNCH_TIME_MS / 1000, "#38ef7d")}s`
  );
  const { state, saveCreds } = await useMultiFileAuthState(session);
  let client = makeWASocket({
    version: WAVersion,
    printQRInTerminal: true,
    logger: pino({ level: "silent" }),
    msgRetryCounterMap,
    auth: state,
    browser: Browsers.macOS("Firefox"),
  });
  global.client = client;

  store?.bind(client.ev);

  client.ev.on("connection.update", async (update) => {
    if (global.qr !== update.qr) {
      global.qr = update.qr;
    }

    const { connection, lastDisconnect } = update;
    if (connection === "connecting") {
      console.log(
        color("[SYS]", "#009FFF"),
        color(moment().format("DD/MM/YY HH:mm:ss"), "#A1FFCE"),
        color(`${package.name} is Authenticating...`, "#f12711")
      );
    } else if (connection === "close") {
      const log = (msg) =>
        console.log(
          color("[SYS]", "#009FFF"),
          color(moment().format("DD/MM/YY HH:mm:ss"), "#A1FFCE"),
          color(msg, "#f64f59")
        );
      const statusCode = new Boom(lastDisconnect?.error)?.output.statusCode;

      console.log(lastDisconnect.error);
      if (statusCode === DisconnectReason.badSession) {
        log(`Bad session file, delete ${session} and run again`);
        start();
      } else if (statusCode === DisconnectReason.connectionClosed) {
        log("Connection closed, reconnecting....");
        start();
      } else if (statusCode === DisconnectReason.connectionLost) {
        log("Connection lost, reconnecting....");
        start();
      } else if (statusCode === DisconnectReason.connectionReplaced) {
        log(
          "Connection Replaced, Another New Session Opened, Please Close Current Session First"
        );
        process.exit();
      } else if (statusCode === DisconnectReason.loggedOut) {
        log(`Device Logged Out, Please Delete ${session} and Scan Again.`);
        process.exit();
      } else if (statusCode === DisconnectReason.restartRequired) {
        log("Restart required, restarting...");
        start();
      } else if (statusCode === DisconnectReason.timedOut) {
        log("Connection timedOut, reconnecting...");
        start();
      } else {
        console.log(lastDisconnect.error);
        start();
      }
    } else if (connection === "open") {
      console.log(
        color("[SYS]", "#009FFF"),
        color(moment().format("DD/MM/YY HH:mm:ss"), "#A1FFCE"),
        color(`${package.name} is now Connected...`, "#38ef7d")
      );
    }
  });

  client.ev.on("creds.update", saveCreds);

  // Handling groups update
  client.ev.on("group-participants.update", async (tpow) => {
    try {
      const botNumber = client.user.id;
      let jid = tpow.id;
      let meta = await client.groupMetadata(jid);
      let participants = tpow.participants;

      let json = groupManage.get(jid);

      if (json.welcome.status) {
        for (let x of participants) {
          if (x == botNumber) return;
          let dp;
          try {
            dp = await client.profilePictureUrl(x, "image");
          } catch (error) {
            dp = "./src/logo_sentra.png";
          }
          let textAdd = json.welcome.msg
            .replace("@user", `@${jidDecode(x).user}`)
            .replace("{title}", meta.subject);
          let textRemove = json.leave.msg
            .replace("@user", `@${jidDecode(x).user}`)
            .replace("{title}", meta.subject);

          if (tpow.action == "add" && json.welcome.status) {
            if (textAdd.includes("{foto}")) {
              client.sendMessage(jid, {
                image: { url: dp },
                mentions: [x],
                caption: textAdd.replace("{foto}", ""),
              });
            } else {
              client.sendMessage(jid, { text: textAdd, mentions: [x] });
            }
          } else if (tpow.action == "remove" && json.leave.status) {
            if (textRemove.includes("{foto}")) {
              client.sendMessage(jid, {
                image: { url: dp },
                mentions: [x],
                caption: textRemove.replace("{foto}", ""),
              });
            } else {
              client.sendMessage(jid, { text: textRemove, mentions: [x] });
            }
          } else if (tpow.action == "promote") {
            client.sendMessage(jid, {
              image: { url: dp },
              mentions: [x],
              caption: `Selamat @${
                x.split("@")[0]
              } atas jabatan menjadi admin di *${meta.subject}*`,
            });
          }
        }
      }
    } catch (error) {
      console.log(error);
    }
  });

  client.ev.on("messages.upsert", async (msg) => {
    try {
      if (!msg.messages) return;
      const m = msg.messages[0];
      if (m.key.fromMe) {
        statistics("msgSent");
      } else {
        statistics("msgRecv");
      }
      if (m.key.fromMe) return;
      if (config.autoRead) {
        client.readMessages(m.key.remoteJid, m.key.participant, [m.key.id]);
      }
      if (m.key && isJidStatusBroadcast(m.key.remoteJid)) return;
      const from = m.key.remoteJid;
      const number = from.replace("@s.whatsapp.net", "");
      const device = getDevice(m.key.id);
      const more = String.fromCharCode(8206);
      const readMore = more.repeat(4000);
      let type = (client.msgType = getContentType(m.message));
      Serialize(client, m);
      let t = (client.timestamp = m.messageTimestamp);
      const body =
        type === "conversation"
          ? m.message.conversation
          : type == "imageMessage"
          ? m.message.imageMessage.caption
          : type == "videoMessage"
          ? m.message.videoMessage.caption
          : type == "extendedTextMessage"
          ? m.message.extendedTextMessage.text
          : type == "buttonsResponseMessage"
          ? m.message.buttonsResponseMessage.selectedButtonId
          : type == "listResponseMessage"
          ? m.message.listResponseMessage.singleSelectReply.selectedRowId
          : type == "templateButtonReplyMessage"
          ? m.message.templateButtonReplyMessage.selectedId
          : type === "messageContextInfo"
          ? m.message.listResponseMessage.singleSelectReply.selectedRowId ||
            m.message.buttonsResponseMessage.selectedButtonId ||
            m.text
          : "";

      let isGroupMsg = isJidGroup(m.chat);
      let sender = m.sender;
      const isOwner = config.owner.includes(sender);
      let pushname = (client.pushname = m.pushName);
      const botNumber = jidNormalizedUser(client.user.id);
      let groupMetadata = isGroupMsg
        ? store?.groupMetadata[m.chat] !== undefined
          ? store.groupMetadata[m.chat]
          : await store.fetchGroupMetadata(m.chat, client)
        : {};
      let groupMembers = isGroupMsg ? groupMetadata.participants : [];
      let groupAdmins = groupMembers
        .filter((v) => v.admin !== null)
        .map((x) => x.id);
      let isGroupAdmin = isOwner || groupAdmins.includes(sender);
      let isBotGroupAdmin = groupAdmins.includes(botNumber);
      let formattedTitle = isGroupMsg ? groupMetadata.subject : "";
      let groupData = isGroupMsg
        ? groupManage.get(m.chat) == undefined
          ? groupManage.add(m.chat, formattedTitle)
          : groupManage.get(m.chat)
        : {};

      global.prefix = /^[./~!#%^&=\,;:()]/.test(body)
        ? body.match(/^[./~!#%^&=\,;:()]/gi)
        : "#";
      // let cPrefix = _plugin.filter(x => x.customPrefix && x.cmd).map(x => x.cmd).flat(2)
      // let _prefix = cPrefix.filter(x => new RegExp(str2Regex(x)).test(body)).length ? cPrefix.filter(x => new RegExp(str2Regex(x)).test(body))[0] : global.prefix
      const arg = body.substring(body.indexOf(" ") + 1);
      const args = body.trim().split(/ +/).slice(1);
      const flags = [];
      const isCmd = (client.isCmd = body.startsWith(global.prefix));
      const cmd = (client.cmd = isCmd
        ? body.slice(1).trim().split(/ +/).shift().toLowerCase()
        : null);
      let url = args.length !== 0 ? args[0] : "";
      const typing = async (jid) =>
        await client.sendPresenceUpdate("composing", jid);
      const recording = async (jid) =>
        await client.sendPresenceUpdate("recording", jid);
      const waiting = async (jid, m) =>
        await client.sendMessage(jid, { text: "proses..." }, { quoted: m });
      global.reply = async (text) => {
        await client.sendPresenceUpdate("composing", from);
        return client.sendMessage(from, { text }, { quoted: m });
      };
      for (let i of args) {
        if (i.startsWith("--")) flags.push(i.slice(2).toLowerCase());
      }

      function makeid(length) {
        var result = "";
        var characters = "0123456789";
        var charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
          result += characters.charAt(
            Math.floor(Math.random() * charactersLength)
          );
        }
        return result;
      }

      const Database = require("better-sqlite3");
      const db = new Database("db/database.db", { verbose: null });
      const { menu } = require("./utils/_menu");
      // Check DB Users
      const rowaja = db.prepare("SELECT * FROM _users WHERE phone = ?");
      const checkready = rowaja.all(number);
      // console.log(checkready);

      const rows = db.prepare("SELECT * FROM _bot WHERE message = ?");
      const checka = rows.all(body);
      console.log(checka);
      switch (body) {
        case "selamat pagi":
          delay(1000).then(() => {
            client.sendMessage(from, { text: "Selamat Pagi juga kak" });
          });
          break;
        case "p":
          const stmt = db.prepare(
            "INSERT INTO `_users` (`name`, `phone`, `status`) SELECT * FROM (SELECT ?,?,'terdaftar') tmp WHERE NOT EXISTS (SELECT phone FROM _users WHERE phone = ?) LIMIT 1"
          );
          stmt.run(pushname, number, number);
          // delay(1000).then(() => {
          //   const slc = db
          //     .prepare("SELECT name, phone FROM _users WHERE phone = ?")
          //     .get(number);
          //   console.log(slc.name);
          // });
          break;
      }

      const logEvent = (text) => {
        if (!isGroupMsg) {
          console.log(
            bgColor(color("[EXEC]", "black"), "#38ef7d"),
            color(moment(t * 1000).format("DD/MM/YY HH:mm:ss"), "#A1FFCE"),
            gradient.summer(`[${text}]`),
            bgColor(color(type, "black"), "cyan"),
            "~> from",
            gradient.cristal(pushname)
          );
        }
        if (isGroupMsg) {
          console.log(
            bgColor(color("[EXEC]", "black"), "#38ef7d"),
            color(moment(t * 1000).format("DD/MM/YY HH:mm:ss"), "#A1FFCE"),
            gradient.summer(`[${text}]`),
            bgColor(color(type, "black"), "cyan"),
            "~> from",
            gradient.cristal(pushname),
            "in",
            gradient.fruit(formattedTitle)
          );
        }
      };

      // store user jid to json file
      if (isCmd) {
        if (!chatsJid.some((x) => x == sender)) {
          chatsJid.push(sender);
          fs.writeFileSync(
            "./db/usersJid.json",
            JSON.stringify(chatsJid),
            "utf-8"
          );
        }
      }

      let tipe = bgColor(color(type, "black"), "#FAFFD1");
      if (!isCmd && !isGroupMsg) {
        console.log(
          "[MSG]",
          color(moment(t * 1000).format("DD/MM/YY HH:mm:ss"), "#A1FFCE"),
          msgs(m.text),
          `~> ${tipe} from`,
          color(pushname, "#38ef7d")
        );
      }
      if (!isCmd && isGroupMsg) {
        console.log(
          "[MSG]",
          color(moment(t * 1000).format("DD/MM/YY HH:mm:ss"), "#A1FFCE"),
          msgs(m.text),
          `~> ${tipe} from`,
          color(pushname, "#38ef7d"),
          "in",
          gradient.morning(formattedTitle)
        );
      }
      if (isCmd && !isGroupMsg) {
        console.log(
          color("[CMD]"),
          color(moment(t * 1000).format("DD/MM/YY HH:mm:ss"), "#A1FFCE"),
          color(`${cmd} [${args.length}]`),
          color(`${msgs(body)}`, "cyan"),
          "~> from",
          gradient.teen(pushname, "magenta")
        );
      }
      if (isCmd && isGroupMsg) {
        console.log(
          color("[CMD]"),
          color(moment(t * 1000).format("DD/MM/YY HH:mm:ss"), "#A1FFCE"),
          color(`${cmd} [${args.length}]`),
          color(`${msgs(body)}`, "cyan"),
          "~> from",
          gradient.teen(pushname),
          "in",
          gradient.fruit(formattedTitle)
        );
      }

      if (isGroupMsg) {
        groupManage.add(m.chat, formattedTitle);
      }

      if (isCmd && config.composing) {
        await client.presenceSubscribe(from);
        await client.sendPresenceUpdate("composing", from);
      }
    } catch (error) {
      console.log(
        color("[ERROR]", "red"),
        color(moment().format("DD/MM/YY HH:mm:ss"), "#A1FFCE"),
        error
      );
    }
  });

  client.ws.on("CB:call", async (call) => {
    if (call.content[0].tag == "offer") {
      const callerJid = call.content[0].attrs["call-creator"];
      const { version, platform, notify, t } = call.attrs;
      const caption = `Wahai _${
        notify || "user botku"
      }_ , kamu telah menelpon bot pada *${moment(t * 1000).format(
        "LLL"
      )}* menggunakan device *${platform}* kamu, sehingga kamu diblokir oleh bot secara otomatis.\nsilahkan chat owner bot untuk membuka blok`;
      await delay(3000);
      for (let i = 0; i < config.owner.length; i++) {
        await client.sendContact(
          callerJid,
          config.owner[i].split(S_WHATSAPP_NET)[0],
          `${config.owner.length < 1 ? "Owner" : `Owner ${i + 1}`}`
        );
      }
      await delay(7000);
      await client.sendMessage(callerJid, { text: caption }).then(async () => {
        await client.updateBlockStatus(callerJid, "block");
      });
    }
  });
};

start().catch(() => start());
