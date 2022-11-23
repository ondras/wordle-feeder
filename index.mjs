import puppeteer from "puppeteer";

let pages = {
  attacker: null,
  defender: null
}

const ATTACKER_CLASSES = {
  "absent": "",
  "present": "yellow",
  "correct": "green"
}

async function loadDefender() {
  const args = ["--window-size=500,800", "--window-position=50,50"];
  const browser = await puppeteer.launch({headless:false, args, defaultViewport: null});
  const page = await browser.newPage();

  await page.goto("https://www.nytimes.com/games/wordle/index.html");
  await page.waitForSelector("dialog button");

  await page.evaluate(_ => {
    [...document.querySelectorAll(".ad, #pz-gdpr")].forEach(n => n.remove());
  });
  await sleep(500);

  await page.click("dialog button");
  await sleep(2000);

  return page;
}

async function loadAttacker() {
  const args = ["--window-size=500,800", "--window-position=600,50"];
  const browser = await puppeteer.launch({headless:false, args, defaultViewport: null});
  const page = await browser.newPage();
  await page.goto("https://adverswordle.doteye.online/");

  return page;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pressDefenderKey(ch) {
  let button = await pages.defender.$(`button[data-key=${ch.toLowerCase()}]`);
  console.log("got button", button)
  await button.click();
  await sleep(600);
}

async function setAttackerState(index, state) {
  const { attacker } = pages;
  let button = await attacker.$(`#buttons button:nth-child(${index+1})`);
  let targetClass = ATTACKER_CLASSES[state];

  while (true) {
    let tc = await attacker.evaluate(n => n.className, button);
    if (tc == targetClass) { return; }
    await button.click();
    sleep(200);
  }
}

async function guessWord() {
  const { attacker, defender } = pages;

  // copy offender letters to defender page
  let buttons = await attacker.$$("#buttons button");
  for (let i=0;i<buttons.length;i++) {
    let char = await attacker.evaluate(n => n.textContent, buttons[i]);
    console.log("got char", char);
    await pressDefenderKey(char);
  }

  // let defender rate the attempt
  await pressDefenderKey("↵");
  await sleep(3500);

  // copy defender ratings back to attacker
  let cells = await defender.$$("div[data-state]:not([data-state=empty]");
  cells = cells.slice(-5);
  for (let i=0;i<cells.length;i++) {
    let state = await defender.evaluate(n => n.dataset.state, cells[i]);
    console.log("got state", state);
    await setAttackerState(i, state);
  }

  // let attacker create a new word
  await attacker.click("#submit");
  sleep(1000);
}

async function go() {
  let [attacker, defender] = await Promise.all([loadAttacker(), loadDefender()]);
  pages.attacker = attacker;
  pages.defender = defender;

  while (true) {
    let done = await attacker.$("#game-over.shown");
    if (done) {
      console.log("DONE");
      break;
    } else {
      await guessWord();
    }
  }

}

go();