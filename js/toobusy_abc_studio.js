// ABC 악보 스튜디오 - ComfyUI 붙임 스크립트
// abc 텍스트 위젯을 가진 노드에 "악보 스튜디오 열기" 버튼을 붙인다.
import { app } from "../../scripts/app.js";

const STUDIO_URL = new URL("./abc_studio/index.html", import.meta.url).href;
const STYLE_ID = "abcst-style";

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const st = document.createElement("style");
  st.id = STYLE_ID;
  st.textContent = `
.abcst-back{position:fixed;inset:0;background:rgba(6,8,12,.62);z-index:10000;display:flex;align-items:center;justify-content:center}
.abcst-box{width:min(1400px,95vw);height:min(900px,92vh);background:#10131a;border:1px solid #2b313a;border-radius:14px;
 box-shadow:0 24px 70px rgba(0,0,0,.6);display:flex;flex-direction:column;overflow:hidden}
.abcst-bar{display:flex;align-items:center;gap:10px;padding:9px 14px;background:#161a21;border-bottom:1px solid #0b0e13;
 color:#e8eaee;font:600 14px "Malgun Gothic","Segoe UI",system-ui,sans-serif}
.abcst-bar .sp{flex:1}
.abcst-bar .tip{color:#9aa1ad;font-weight:400;font-size:12.5px}
.abcst-bar button{background:#1f242c;color:#e8eaee;border:1px solid #2b313a;border-radius:8px;padding:6px 14px;
 cursor:pointer;font:inherit;font-weight:400}
.abcst-bar button:hover{background:#272d37}
.abcst-frame{flex:1;border:0;width:100%;background:#10131a}`;
  document.head.appendChild(st);
}

// 편집기를 띄운다. getAbc()로 지금 악보를 넘기고,
// 사용자가 "이 악보 쓰기"를 누르면 setAbc(text)로 돌려받는다.
function openStudio(getAbc, setAbc) {
  ensureStyle();
  const back = document.createElement("div");
  back.className = "abcst-back";
  const box = document.createElement("div");
  box.className = "abcst-box";
  const bar = document.createElement("div");
  bar.className = "abcst-bar";

  const title = document.createElement("span");
  title.textContent = "ABC 악보 스튜디오";
  const tip = document.createElement("span");
  tip.className = "tip";
  tip.textContent = setAbc ? "다 그린 뒤 아래 '이 악보 쓰기'를 누르면 노드에 들어갑니다" : "미리보기";
  const sp = document.createElement("span");
  sp.className = "sp";
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "닫기";
  bar.append(title, tip, sp, closeBtn);

  const frame = document.createElement("iframe");
  frame.className = "abcst-frame";
  frame.src = STUDIO_URL;
  box.append(bar, frame);
  back.appendChild(box);
  document.body.appendChild(back);

  const onMsg = (e) => {
    const d = e.data;
    if (!d || d.source !== "abc-studio") return;
    if (frame.contentWindow && e.source !== frame.contentWindow) return;
    if (d.type === "ready") {
      let abc = "";
      try { abc = getAbc() || ""; } catch (_) {}
      frame.contentWindow.postMessage({ source: "abc-studio-host", type: "load", abc }, "*");
    } else if (d.type === "apply") {
      if (setAbc) setAbc(String(d.abc || ""));
      close();
    }
  };
  const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
  function close() {
    window.removeEventListener("message", onMsg);
    window.removeEventListener("keydown", onKey, true);
    back.remove();
  }
  window.addEventListener("message", onMsg);
  window.addEventListener("keydown", onKey, true);
  closeBtn.onclick = close;
  back.addEventListener("mousedown", (e) => { if (e.target === back) close(); });
}

function findAbcWidget(node) {
  return (node.widgets || []).find(
    (w) => w.name === "abc" && w.type !== "button" && typeof w.value !== "undefined"
  );
}

function attachButton(node) {
  if (node.__abcStudioReady) return;
  if (!findAbcWidget(node)) return;
  node.__abcStudioReady = true;
  const btn = node.addWidget("button", "🎼 악보 스튜디오 열기", null, () => {
    const w = findAbcWidget(node);
    openStudio(
      () => (w ? w.value : ""),
      (text) => {
        if (!w) return;
        w.value = text;
        if (w.callback) w.callback(text, app.canvas, node);
        app.graph.setDirtyCanvas(true, true);
      }
    );
  });
  btn.serialize = false;
  const idx = node.widgets.indexOf(btn);
  const wIdx = node.widgets.indexOf(findAbcWidget(node));
  if (idx > -1 && wIdx > -1 && idx > wIdx) {
    node.widgets.splice(idx, 1);
    node.widgets.splice(wIdx, 0, btn);
  }
  node.setSize(node.computeSize());
}

app.registerExtension({
  name: "toobusy.abc-studio",
  async nodeCreated(node) {
    // 위젯이 다 만들어진 뒤에 붙인다.
    setTimeout(() => { try { attachButton(node); } catch (_) {} }, 0);
  },
  async loadedGraphNode(node) {
    try { attachButton(node); } catch (_) {}
  },
  commands: [{
    id: "toobusy.abcStudio.open",
    label: "ABC 악보 스튜디오",
    function: () => openStudio(() => "", null),
  }],
  menuCommands: [{ path: ["Extensions"], commands: ["toobusy.abcStudio.open"] }],
});
