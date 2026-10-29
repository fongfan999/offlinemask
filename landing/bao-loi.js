import "./product.css";
import "./privacy.css";
import "./bao-loi.css";

// The report page (decision 0147). The app opens it with the report in the fragment
// (#kind=…&message=…&version=…&os=…&screen=…), which never reaches the server; the page fills the
// form, drops the fragment from the address and sends nothing until the visitor presses Gửi.
const form = document.querySelector("[data-om-report]");
const about = document.querySelector("[data-om-report-about]");
const status = document.querySelector("[data-om-report-status]");
const done = document.querySelector("[data-om-report-done]");
const sent = new URLSearchParams(location.hash.slice(1));
const app = {
  version: sent.get("version") ?? "",
  os: sent.get("os") ?? "",
  screen: sent.get("screen") ?? "",
};

const kind = form.elements.namedItem("kind");
if ([...kind].some((input) => input.value === sent.get("kind"))) kind.value = sent.get("kind");
form.elements.namedItem("message").value = sent.get("message") ?? "";
const details = [
  app.version && `OfflineMask ${app.version}`,
  app.os,
  app.screen && `màn hình ${app.screen}`,
];
if (details.some(Boolean)) {
  about.textContent = `Gửi kèm: ${details.filter(Boolean).join(" - ")}`;
  about.hidden = false;
}
if (location.hash) history.replaceState(null, "", location.pathname + location.search);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = form.elements.namedItem("message");
  if (!message.value.trim()) {
    status.textContent = "Bạn viết vài chữ về chuyện đã xảy ra nhé.";
    message.focus();
    return;
  }
  const button = form.querySelector("button");
  button.disabled = true;
  status.textContent = "Đang gửi...";
  try {
    const reply = await fetch("/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: kind.value, message: message.value, ...app }),
    });
    if (!reply.ok) throw new Error(`HTTP ${reply.status}`);
    form.hidden = true;
    done.hidden = false;
    done.focus();
  } catch {
    status.textContent = "Chưa gửi được. Bạn kiểm tra kết nối mạng rồi bấm Gửi lại nhé.";
    button.disabled = false;
  }
});
