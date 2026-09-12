// abc 칸이 입력 소켓으로 바뀌고 선이 꽂혔을 때, 악보가 실제로 읽히는 자리를
// 찾아내는지 본다. 이걸 틀리면 스튜디오가 쓴 악보가 조용히 묻힌다.
import { resolveAbcTarget } from "../../js/abc_studio/resolve.js";

const graph = {
  links: { 8: { origin_id: 12, origin_slot: 0 } },
  nodes: {},
  getNodeById(id) { return this.nodes[id] || null; },
};
const primitive = { id: 12, mode: 0, widgets: [{ name: "value", type: "customtext", value: "OLD" }] };
graph.nodes[12] = primitive;

const linked = {
  id: 3,
  inputs: [{ name: "model" }, { name: "style" }, { name: "lyrics" }, { name: "abc", link: 8 }],
  widgets: [{ name: "seed", type: "number", value: 1 }, { name: "abc", type: "customtext", value: "IGNORED" }],
};
const plain = {
  id: 4,
  inputs: [{ name: "model" }],
  widgets: [{ name: "abc", type: "customtext", value: "MINE" }],
};
const unlinkedSocket = {
  id: 5,
  inputs: [{ name: "abc", link: null }],
  widgets: [{ name: "abc", type: "customtext", value: "MINE" }],
};

let fails = 0;
const check = (label, cond) => { if (!cond) { console.log("FAIL " + label); fails++; } else console.log("ok " + label); };

let t = resolveAbcTarget(linked, graph);
check("선이 꽂히면 근원 노드를 가리킨다", t.node === primitive && t.viaLink === true);
check("근원 노드의 텍스트 위젯을 찾는다", t.widget === primitive.widgets[0]);
check("켜져 있으면 disabled 아님", t.disabled === false);

primitive.mode = 4;
t = resolveAbcTarget(linked, graph);
check("꺼진 근원 노드를 알아챈다", t.disabled === true);
primitive.mode = 0;

t = resolveAbcTarget(plain, graph);
check("선이 없으면 자기 위젯", t.node === plain && t.widget === plain.widgets[0] && t.viaLink === false);

t = resolveAbcTarget(unlinkedSocket, graph);
check("소켓만 있고 선이 없으면 자기 위젯", t.node === unlinkedSocket && t.viaLink === false);

graph.nodes[12] = { id: 12, mode: 0, widgets: [{ name: "image", type: "combo", value: 3 }] };
t = resolveAbcTarget(linked, graph);
check("텍스트 칸 없는 노드가 꽂히면 이유를 준다", t.widget === null && t.reason === "linked-node-has-no-text-box");

check("abc 가 아예 없으면 null", resolveAbcTarget({ id: 9, widgets: [] }, graph) === null);
console.log(fails ? "FAILED " + fails : "ALL PASS");
process.exit(fails ? 1 : 0);
