/**
 * Author  : Gimenz
 * Name    : nganu
 * Version : 1.0
 * Update  : 09 Januari 2022
 *
 * If you are a reliable programmer or the best developer, please don't change anything.
 * If you want to be appreciated by others, then don't change anything in this script.
 * Please respect me for making this tool from the beginning.
 */

let express = require("express");
const http = require("http");
const app = express();
const fs = require("fs");
const httpServer = http.createServer(app);
const { color, humanFileSize } = require("./utils/index");
const si = require("systeminformation");
const io = require("socket.io")(httpServer);
const qrcode = require("qrcode");
const { resizeImage } = require("./lib/converter");
const { isJidUser, isJidGroup, delay } = require("@adiwajshing/baileys");
global.qr = "";
let config = require("./src/config.json");
const { configHandler } = require("./db");
const { send } = require("process");

app.set("json spaces", 2);
app.use(express.json());
app.get("/", async (req, res) => {
  try {
    let ram = await si.mem();
    let cpu = await si.cpuCurrentSpeed();
    let disk = await si.fsSize();
    let up = si.time();
    let json = {
      server_time: new Date(up.current).toLocaleString("jv"),
      uptime: times(up.uptime),
      memory:
        humanFileSize(ram.free, true, 1) +
        " free of " +
        humanFileSize(ram.total, true, 1),
      memory_used: humanFileSize(ram.used, true, 1),
      cpu: cpu.avg + " Ghz",
      disk:
        humanFileSize(disk[0].available, true, 1) +
        " free of " +
        humanFileSize(disk[0].size, true, 1),
      chats: {
        total: store.chats.length,
        private: store.chats.filter((x) => isJidUser(x.id)).length,
        groups: store.chats.filter((x) => isJidGroup(x.id)).length,
      },
    };
    res.status(200).json(json);
  } catch (error) {
    res.status(503).send(error);
  }
});

app.get("/qr", async (req, res, next) => {
  try {
    res.setHeader("content-type", "image/png");
    res.send(await resizeImage(await qrcode.toBuffer(global.qr), 512, 512));
  } catch (error) {
    res.send("err, " + error.message);
  }
});

app.get("/send", async (req, res, next) => {
  const { id, text } = req.query;
  if (!id)
    return res.status(403).json({
      status: false,
      code: 403,
      creator: "@gimenz.id",
      result: "jid diperlukan",
    });
  if (!text)
    return res.status(403).json({
      status: false,
      code: 403,
      creator: "@gimenz.id",
      result: "text diperlukan",
    });
  const data = await client.sendMessage(id, { text });
  res.status(200).jsonp(data);
  console.log(
    color(`[SEND] send message to ${id}`, "green") + color(`${PORT}`, "yellow")
  );
});

app.get("/send", async (req, res, next) => {
  const { id, text } = req.query;
  if (!id)
    return res.status(403).json({
      status: false,
      code: 403,
      creator: "@gimenz.id",
      result: "jid diperlukan",
    });
  if (!text)
    return res.status(403).json({
      status: false,
      code: 403,
      creator: "@gimenz.id",
      result: "text diperlukan",
    });
  const data = await client.sendMessage(id, { text });
  res.status(200).jsonp(data);
  console.log(
    color(`[SEND] send message to ${id}`, "green") + color(`${PORT}`, "yellow")
  );
});

app.get("/sendmsg", async (req, res, next) => {
  const { id, text, api } = req.query;
  if (!id)
    return res.status(403).json({
      status: false,
      code: 403,
      creator: "@tyatna",
      result: "jid diperlukan",
    });
  if (!text)
    return res.status(403).json({
      status: false,
      code: 403,
      creator: "@tyatna",
      result: "text diperlukan",
    });
  if (!api)
    return res.status(403).json({
      status: false,
      code: 403,
      creator: "@tyatna",
      result: "API diperlukan",
    });

  if (api === "SENTRAMESSAGE") {
    const nu = id.replace(/^0+/, "62").replace("+", "");
    const data = await client.sendMessage(nu, { text });
    delay(3000).then(() => {
      const buttons = [
        {
          buttonId: "sosmed1",
          buttonText: { displayText: "SOSIAL MEDIA" },
          type: 1,
        },
        {
          buttonId: "joingrup1",
          buttonText: { displayText: "Gabung Group OPREC" },
          type: 1,
        },
      ];

      const buttonMessage = {
        text: "Hallo sobat sEntrative untuk info selanjutnya silahkan untuk masuk ke group whatsapp, dengan cara klik button *Gabung Group OPREC* di bawah ini dan tunggu hingga link group muncul, setelah muncul silahkan untuk klik link tersebut dan bergabung.\n\nTerimakasih,\nMarketing sEntra",
        footer: "Hello World",
        buttons: buttons,
        headerType: 1,
      };
      client.sendMessage(nu, buttonMessage);
    });
    return res.status(200).jsonp(data);
  }
});

app.get("/user", async (req, res, next) => {
  try {
    const user = await client.user;
    res.status(200).jsonp(user);
  } catch (error) {
    res.status(503).jsonp({
      success: false,
      message: "bot not authenticated",
    });
  }
});

app.get("/set", async (req, res, next) => {
  const acceptable = ["session_id", "removeBG", "musixMatch"];
  console.log(req.query);
  const mode = Object.keys(req.query)[0];
  let value = Object.values(req.query)[0];

  if (!acceptable.includes(mode))
    return res.status(401).jsonp({
      status: false,
      message: "mode not acceptable! => only " + acceptable.join(", "),
    });
  if (mode == "session_id") value = encodeURIComponent(value);
  config[mode] = value;
  configHandler.update(mode, value);
  res.send(value);
});

const qrPrint = (qr) => {
  app.get("/qr", async (req, res) => {
    res.setHeader("content-type", "image/png");
    res.send(await resizeImage(await qrcode.toBuffer(qr), 512, 512));
  });
};

// Run the server
const PORT = config.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(
    color("[INFO] Web api Server on port: ", "green") +
      color(`${PORT}`, "yellow")
  );
});

function times(second) {
  days = Math.floor(second / 60 / 60 / 24);
  hours = Math.floor(second / 60 / 60);
  minute = Math.floor(second / 60);
  sec = Math.floor(second);
  return (
    days +
    " days, " +
    hours +
    " hours, " +
    minute +
    " minutes, " +
    sec +
    " seconds"
  );
}

module.exports = {
  qrPrint,
};
