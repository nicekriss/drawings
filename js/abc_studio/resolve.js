// abc 악보가 실제로 읽히는 자리를 찾는다.
//
// ComfyUI 에서 텍스트 위젯은 입력 소켓으로 바꿀 수 있고, 소켓에 선이 꽂히면
// 노드 자신의 위젯 값은 무시되고 연결된 노드의 출력이 쓰인다. 그래서 버튼이
// 노드 위젯에만 값을 넣으면 선이 꽂혀 있을 때 조용히 묻힌다. 선을 따라가
// 근원 노드의 텍스트 위젯에 넣어야 실제로 생성에 반영된다.
const TEXT_WIDGET_NAMES = ["value", "text", "string", "abc"];

function textWidgetOf(node) {
  if (!node || !node.widgets) return null;
  const usable = node.widgets.filter(
    (w) => w && w.type !== "button" && typeof w.value === "string"
  );
  for (const name of TEXT_WIDGET_NAMES) {
    const hit = usable.find((w) => w.name === name);
    if (hit) return hit;
  }
  return usable.length === 1 ? usable[0] : null;
}

// 꺼진 노드(mute 2, bypass 4)의 출력은 생성 노드에 닿지 않는다.
function isDisabled(node) {
  return !!node && node.mode !== 0 && node.mode !== undefined;
}

function resolveAbcTarget(node, graph) {
  if (!node) return null;
  const input = (node.inputs || []).find((i) => i && i.name === "abc");
  if (input && input.link != null && graph) {
    const link = (graph.links || {})[input.link];
    const source = link && graph.getNodeById ? graph.getNodeById(link.origin_id) : null;
    if (source) {
      const widget = textWidgetOf(source);
      return {
        node: source,
        widget: widget,
        viaLink: true,
        disabled: isDisabled(source),
        reason: widget ? null : "linked-node-has-no-text-box",
      };
    }
    return { node: null, widget: null, viaLink: true, disabled: false, reason: "link-source-missing" };
  }
  const own = (node.widgets || []).find(
    (w) => w && w.name === "abc" && w.type !== "button"
  );
  if (own) return { node: node, widget: own, viaLink: false, disabled: false, reason: null };
  return null;
}

export { resolveAbcTarget, textWidgetOf, isDisabled };
