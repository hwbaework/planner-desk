"""하이웍스 메일 → Planner Desk 동기화 (POP3S, 읽기 전용).

받은편지함에서 최근 메일 헤더를 훑어 [HO-001] 같은 전달 코드가 제목/본문에 있거나
지정한 개발자 주소에서 온 메일만 골라 mail_inbox.json 으로 저장한다.
Planner Desk [메일 수신] 탭에서 이 파일을 불러오면 전달 건에 자동 매칭된다.

- 메일을 삭제(DELE)하지 않는다. 이미 가져온 메일은 .mail_state.json 의 UIDL로 건너뛴다.
- 비밀번호는 환경변수 HIWORKS_PASSWORD 또는 mail_config.json 에 둔다 (둘 다 git 제외).

사용:
  python tools/hiworks_mail_sync.py --test     # 로그인/메일 수만 확인
  python tools/hiworks_mail_sync.py            # 동기화
  python tools/hiworks_mail_sync.py --days 30  # 최근 30일
"""
import argparse
import email
import email.policy
import email.utils
import getpass
import json
import os
import poplib
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONFIG = HERE / "mail_config.json"
STATE = HERE / ".mail_state.json"
DEFAULT_CONFIG = {
    "host": "pop3s.hiworks.com",
    "port": 995,
    "user": "me@company.co.kr",
    "password": "",
    "days": 14,
    "code_prefix": "HO",
    "dev_senders": [],
    "scan_limit": 400,
    "output": "../mail_inbox.json",
}
QUOTE_CUT = re.compile(r"\n\s*(-{2,}\s*(Original Message|원본 메시지)\s*-{2,}|보낸 ?사람\s*:|From\s*:|.*wrote:\s*\n|>)", re.I)


def load_config():
    if not CONFIG.exists():
        CONFIG.write_text(json.dumps(DEFAULT_CONFIG, ensure_ascii=False, indent=2), encoding="utf-8")
        sys.exit(f"설정 파일을 만들었어: {CONFIG}\nuser(메일 주소)를 채우고 다시 실행해줘. 비밀번호는 환경변수 HIWORKS_PASSWORD 추천.")
    cfg = {**DEFAULT_CONFIG, **json.loads(CONFIG.read_text(encoding="utf-8"))}
    cfg["password"] = os.environ.get("HIWORKS_PASSWORD") or cfg.get("password") or getpass.getpass(f"{cfg['user']} 비밀번호: ")
    return cfg


def text_body(msg):
    part = msg.get_body(preferencelist=("plain", "html"))
    if part is None:
        return ""
    try:
        txt = part.get_content()
    except (LookupError, UnicodeDecodeError):
        txt = part.get_payload(decode=True).decode("cp949", errors="replace")
    if part.get_content_type() == "text/html":
        txt = re.sub(r"(?is)<(style|script).*?</\1>", "", txt)
        txt = re.sub(r"(?i)<br\s*/?>|</p>|</div>", "\n", txt)
        txt = re.sub(r"<[^>]+>", "", txt).replace("&nbsp;", " ").replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&")
    txt = txt.replace("\r", "")
    m = QUOTE_CUT.search(txt)
    if m and m.start() > 0:
        txt = txt[: m.start()]
    return re.sub(r"\n{3,}", "\n\n", txt).strip()


def mail_date(msg):
    try:
        return email.utils.parsedate_to_datetime(msg["Date"]).astimezone()
    except (TypeError, ValueError):
        return None


def to_record(msg):
    d = mail_date(msg)
    return {
        "messageId": (msg["Message-ID"] or "").strip(),
        "from": str(msg["From"] or ""),
        "subject": str(msg["Subject"] or ""),
        "date": d.strftime("%Y-%m-%d") if d else "",
        "body": text_body(msg)[:4000],
    }


def wanted(msg, code_re, senders, body=""):
    subj = str(msg["Subject"] or "")
    if code_re.search(subj) or (body and code_re.search(body)):
        return True
    addr = email.utils.parseaddr(str(msg["From"] or ""))[1].lower()
    return bool(addr) and addr in senders


def sync(cfg, days, test=False):
    code_re = re.compile(rf"\b{re.escape(cfg['code_prefix'])}-\d{{2,4}}\b", re.I)
    senders = {s.lower() for s in cfg["dev_senders"]}
    since = datetime.now(timezone.utc).astimezone() - timedelta(days=days)
    state = json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {"seen": []}
    seen = set(state["seen"])

    box = poplib.POP3_SSL(cfg["host"], int(cfg["port"]), timeout=30)
    try:
        box.user(cfg["user"])
        box.pass_(cfg["password"])
        count, size = box.stat()
        print(f"로그인 OK · 받은편지함 {count}통 ({size // 1024 // 1024}MB)")
        if test:
            return
        uidl = {}
        for line in box.uidl()[1]:
            n, u = line.decode().split(" ", 1)
            uidl[int(n)] = u
        found, scanned = [], 0
        for n in range(count, max(0, count - int(cfg["scan_limit"])), -1):   # 최신 메일부터
            u = uidl.get(n)
            if u in seen:
                continue
            head = email.message_from_bytes(b"\r\n".join(box.top(n, 0)[1]), policy=email.policy.default)
            scanned += 1
            d = mail_date(head)
            if d and d < since:
                break
            if not wanted(head, code_re, senders):
                continue
            full = email.message_from_bytes(b"\r\n".join(box.retr(n)[1]), policy=email.policy.default)
            found.append(to_record(full))
            seen.add(u)
        print(f"새 메일 {scanned}통 확인 → 전달 건 관련 {len(found)}통")
    finally:
        box.quit()

    out = (HERE / cfg["output"]).resolve()
    old = json.loads(out.read_text(encoding="utf-8")).get("mails", []) if out.exists() else []
    ids = {m["messageId"] for m in found}
    merged = (found + [m for m in old if m["messageId"] not in ids])[:500]
    out.write_text(json.dumps({"source": "hiworks-pop3", "exportedAt": datetime.now().astimezone().isoformat(timespec="seconds"), "mails": merged}, ensure_ascii=False, indent=1), encoding="utf-8")
    STATE.write_text(json.dumps({"seen": sorted(seen)[-5000:]}), encoding="utf-8")
    print(f"저장: {out}  (Planner Desk → 메일 수신 → 동기화 파일 불러오기)")


def main():
    ap = argparse.ArgumentParser(description="하이웍스 메일 → Planner Desk mail_inbox.json")
    ap.add_argument("--test", action="store_true", help="로그인만 확인")
    ap.add_argument("--days", type=int, help="최근 며칠치 (기본: 설정 days)")
    a = ap.parse_args()
    cfg = load_config()
    try:
        sync(cfg, a.days or int(cfg["days"]), a.test)
    except poplib.error_proto as e:
        sys.exit(f"하이웍스 응답 오류: {e}\n- 비밀번호 확인\n- 하이웍스 환경설정 > 메일 > POP3/SMTP 사용이 켜져 있는지 확인 (관리자 차단 시 IT팀 문의)")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
