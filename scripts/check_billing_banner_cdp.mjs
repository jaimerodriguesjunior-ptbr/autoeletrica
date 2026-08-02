import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";

const APP_URL = "http://localhost:3001";
const DEBUG_PORT = 9223;
const USER_DATA_DIR = ".tmp\\autoeletrica-billing-banner-chrome";
const SCREENSHOT_PATH = ".tmp\\autoeletrica-billing-banner.png";
const EMAIL = "teste@teste.com";
const PASSWORD = "Teste@2026";

const chromeCandidates = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
];

const chromePath = chromeCandidates.find((path) => existsSync(path));

if (!chromePath) {
  throw new Error("Chrome/Edge nao encontrado nos caminhos padrao.");
}

rmSync(USER_DATA_DIR, { force: true, recursive: true });
mkdirSync(USER_DATA_DIR, { recursive: true });

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    "about:blank"
  ],
  { stdio: "ignore" }
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`${url} respondeu ${response.status}`);
  }

  return response.json();
}

async function waitForChrome() {
  const versionUrl = `http://127.0.0.1:${DEBUG_PORT}/json/version`;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return await fetchJson(versionUrl);
    } catch {
      await sleep(250);
    }
  }

  throw new Error("Chrome headless nao ficou pronto.");
}

function createCdpClient(webSocketDebuggerUrl) {
  let id = 0;
  const pending = new Map();
  const socket = new WebSocket(webSocketDebuggerUrl);

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id) return;

    const callback = pending.get(message.id);
    if (!callback) return;

    pending.delete(message.id);
    if (message.error) {
      callback.reject(new Error(message.error.message));
    } else {
      callback.resolve(message.result);
    }
  });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const commandId = ++id;
      pending.set(commandId, { resolve, reject });
      socket.send(JSON.stringify({ id: commandId, method, params }));
    });
  }

  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve({ send, close: () => socket.close() }));
    socket.addEventListener("error", reject);
  });
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Erro ao avaliar script no navegador.");
  }

  return result.result.value;
}

async function main() {
  try {
    await waitForChrome();
    const target = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, {
      method: "PUT"
    });
    const cdp = await createCdpClient(target.webSocketDebuggerUrl);

    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Page.navigate", { url: APP_URL });

    for (let attempt = 0; attempt < 30; attempt += 1) {
      const loginReady = await evaluate(
        cdp,
        `Boolean(document.querySelector('input[type="email"]') && document.querySelector('input[type="password"]'))`
      );

      if (loginReady) break;
      await sleep(500);
    }

    await evaluate(
      cdp,
      `(async () => {
        const emailInput = document.querySelector('input[type="email"]');
        const passwordInput = document.querySelector('input[type="password"]');
        if (!emailInput || !passwordInput) {
          throw new Error("Campos de login nao encontrados.");
        }
        const setValue = (input, value) => {
          const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set;
          setter.call(input, value);
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        };
        setValue(emailInput, ${JSON.stringify(EMAIL)});
        setValue(passwordInput, ${JSON.stringify(PASSWORD)});
        await new Promise((resolve) => setTimeout(resolve, 250));
        const submitButton = [...document.querySelectorAll("button")].find((button) => {
          const text = button.innerText || button.textContent || "";
          return button.type === "submit" || text.includes("Entrar") || text.includes("Acessar");
        });
        submitButton?.click();
        return true;
      })()`
    );

    let pageState = null;

    for (let attempt = 0; attempt < 40; attempt += 1) {
      await sleep(1000);
      pageState = await evaluate(
        cdp,
        `(() => ({
          href: location.href,
          text: document.body.innerText
        }))()`
      );

      const normalizedText = pageState.text.toLowerCase();

      const hasBillingBanner =
        normalizedText.includes("mensalidade em dia") ||
        normalizedText.includes("mensalidade perto do vencimento") ||
        normalizedText.includes("mensalidade pendente") ||
        normalizedText.includes("mensalidade em atraso");

      if (hasBillingBanner && normalizedText.includes("pagar")) {
        break;
      }
    }

    const normalizedText = pageState?.text?.toLowerCase() ?? "";
    const hasBillingBanner =
      normalizedText.includes("mensalidade em dia") ||
      normalizedText.includes("mensalidade perto do vencimento") ||
      normalizedText.includes("mensalidade pendente") ||
      normalizedText.includes("mensalidade em atraso");

    if (!hasBillingBanner || !normalizedText.includes("pagar")) {
      throw new Error(
        `Banner nao apareceu. URL atual: ${pageState?.href || "desconhecida"}. Texto: ${pageState?.text?.slice(0, 500) || ""}`
      );
    }

    await evaluate(
      cdp,
      `(() => {
        const payButton = [...document.querySelectorAll("button")].find((button) => {
          const text = button.innerText || button.textContent || "";
          return text.includes("Pagar");
        });
        payButton?.click();
        return Boolean(payButton);
      })()`
    );

    let paymentModalState = null;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await sleep(500);
      paymentModalState = await evaluate(
        cdp,
        `(() => ({
          text: document.body.innerText,
          hasQrImage: Boolean(document.querySelector('img[alt="QR Code Pix"]')),
          hasCopyInput: Boolean([...document.querySelectorAll("input")].find((input) => input.value.startsWith("000201")))
        }))()`
      );

      const modalText = paymentModalState.text.toLowerCase();
      if (modalText.includes("pix copia e cola") && paymentModalState.hasQrImage && paymentModalState.hasCopyInput) {
        break;
      }
    }

    const modalText = paymentModalState?.text?.toLowerCase() ?? "";
    if (!modalText.includes("pix copia e cola") || !paymentModalState?.hasQrImage || !paymentModalState?.hasCopyInput) {
      throw new Error("Modal de pagamento Pix nao abriu com QR Code e copia e cola.");
    }

    const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    writeFileSync(SCREENSHOT_PATH, Buffer.from(screenshot.data, "base64"));
    cdp.close();

    console.log(
      JSON.stringify(
        {
          ok: true,
          href: pageState.href,
          hasBillingBanner: true,
          hasPayButton: true,
          hasPaymentModal: true,
          hasQrCode: true,
          hasPixCopyPaste: true,
          screenshot: SCREENSHOT_PATH
        },
        null,
        2
      )
    );
  } finally {
    chrome.kill();
  }
}

main().catch((error) => {
  chrome.kill();
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
