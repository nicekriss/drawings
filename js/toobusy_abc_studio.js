// ABC 악보 스튜디오 - ComfyUI 붙임 스크립트
// abc 텍스트 위젯을 가진 노드에 "악보 스튜디오 열기" 버튼을 붙인다.
import { app } from "../../scripts/app.js";
import { resolveAbcTarget } from "./abc_studio/resolve.js";

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
function openStudio(getAbc, setAbc, describe) {
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
  const sp = document.createElement("span");
  sp.className = "sp";
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "닫기";
  bar.append(title, tip, sp, closeBtn);

  function setTip(text, warn) {
    tip.textContent = text;
    tip.style.color = warn ? "#ffb4ac" : "#9aa1ad";
  }
  setTip(describe ? describe() : "미리보기");

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
      if (!setAbc) { close(); return; }
      const result = setAbc(String(d.abc || ""));
      // 넣을 자리를 못 찾으면 창을 닫지 않는다. 닫아 버리면 악보가 사라진다.
      if (result && result.ok === false) setTip(result.message, true);
      else close();
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

function describeTarget(node) {
  const t = resolveAbcTarget(node, app.graph);
  if (!t) return "이 노드에는 abc 칸이 없습니다";
  if (!t.node) return "abc 칸에 꽂힌 선의 출처를 찾지 못했습니다";
  const where = t.node.title || t.node.type || "연결된 노드";
  if (!t.widget) return `${where} 에는 글자를 넣을 칸이 없습니다`;
  if (t.disabled) return `${where} 에 넣습니다. 다만 그 노드가 꺼져 있어 지금은 악보가 전달되지 않습니다`;
  if (t.viaLink) return `abc 칸에 선이 꽂혀 있어 ${where} 쪽에 넣습니다`;
  return "다 그린 뒤 아래 '이 악보 쓰기'를 누르면 이 노드에 들어갑니다";
}

function readAbc(node) {
  const t = resolveAbcTarget(node, app.graph);
  return t && t.widget ? t.widget.value : "";
}

function writeAbc(node, text) {
  const t = resolveAbcTarget(node, app.graph);
  if (!t) return { ok: false, message: "이 노드에는 abc 칸이 없습니다" };
  if (!t.node) return { ok: false, message: "abc 칸에 꽂힌 선의 출처를 찾지 못했습니다. 선을 빼고 다시 시도하세요" };
  if (!t.widget) {
    const where = t.node.title || t.node.type || "연결된 노드";
    return { ok: false, message: `${where} 에는 글자를 넣을 칸이 없습니다. abc 칸의 선을 빼고 다시 누르세요` };
  }
  t.widget.value = text;
  if (t.widget.callback) t.widget.callback(text, app.canvas, t.node);
  app.graph.setDirtyCanvas(true, true);
  if (t.disabled) {
    const where = t.node.title || t.node.type || "연결된 노드";
    return { ok: false, message: `${where} 에 넣었습니다. 그 노드가 꺼져 있으니 켜야 악보가 반영됩니다` };
  }
  return { ok: true };
}

// abc 위젯이 입력 소켓으로 바뀌어도 버튼은 계속 붙어 있어야 한다.
function hasAbcSlot(node) {
  if ((node.widgets || []).some((w) => w && w.name === "abc" && w.type !== "button")) return true;
  return (node.inputs || []).some((i) => i && i.name === "abc");
}

function attachButton(node) {
  if (node.__abcStudioReady) return;
  if (!hasAbcSlot(node)) return;
  node.__abcStudioReady = true;
  const btn = node.addWidget("button", "🎼 악보 스튜디오 열기", null, () => {
    openStudio(
      () => readAbc(node),
      (text) => writeAbc(node, text),
      () => describeTarget(node)
    );
  });
  btn.serialize = false;
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
    function: () => openStudio(() => "", null, () => "미리보기"),
  }],
  menuCommands: [{ path: ["Extensions"], commands: ["toobusy.abcStudio.open"] }],
});
