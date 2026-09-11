"""ABC 악보 스튜디오.

ABC 텍스트 위젯(`abc`)을 가진 노드라면 어떤 노드든 위젯 위에
"악보 스튜디오 열기" 버튼이 붙는다. YuE2 · Generate Song 노드가 그 대상이다.
아래 두 노드는 악보를 따로 보관하거나 확인할 때 쓰는 보조 노드다.
"""

DEFAULT_ABC = "\n".join([
    "X:1",
    "T:",
    "M:4/4",
    "L:1/16",
    "Q:1/4=91",
    "K:Am",
    "V:1",
    "z16|z16|z16|z16|",
    "",
])


class ABCScoreInput:
    """피아노롤로 그린 멜로디를 ABC 악보 텍스트로 내보낸다."""

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"abc": ("STRING", {
            "multiline": True,
            "default": DEFAULT_ABC,
            "tooltip": "위의 '악보 스튜디오 열기' 버튼을 누르면 피아노롤로 그릴 수 있다.",
        })}}

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("abc",)
    FUNCTION = "run"
    CATEGORY = "toobusy/ABC"

    def run(self, abc):
        return (abc,)


class ABCScoreInfo:
    """ABC 악보에서 조, 박자, 템포, 마디 수를 읽어 본다."""

    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"abc": ("STRING", {"forceInput": True})}}

    RETURN_TYPES = ("STRING", "STRING", "INT", "INT")
    RETURN_NAMES = ("key", "meter", "bpm", "bars")
    FUNCTION = "run"
    CATEGORY = "toobusy/ABC"

    def run(self, abc):
        import re

        key, meter, bpm, bars = "C", "4/4", 120, 0
        seen_key = False
        for line in (abc or "").splitlines():
            line = line.strip()
            if line.startswith("K:") and not seen_key:
                key, seen_key = (line[2:].strip() or "C"), True
            elif line.startswith("M:"):
                m = re.search(r"(\d+)\s*/\s*(\d+)", line)
                if m:
                    meter = "%s/%s" % (m.group(1), m.group(2))
            elif line.startswith("Q:"):
                m = re.search(r"=\s*(\d+)", line)
                if m:
                    bpm = int(m.group(1))
            elif line and line[1:2] != ":" and not line.startswith("%"):
                bars += line.count("|")
        return (key, meter, bpm, bars)


NODE_CLASS_MAPPINGS = {
    "ABCScoreInput": ABCScoreInput,
    "ABCScoreInfo": ABCScoreInfo,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "ABCScoreInput": "ABC 악보 입력",
    "ABCScoreInfo": "ABC 악보 정보",
}
