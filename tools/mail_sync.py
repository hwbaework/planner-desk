"""회사 메일 → Planner Desk 동기화 (읽기 전용, POP3S 또는 IMAP).

최근 메일 헤더를 훑어 [HO-001] 같은 전달 코드가 제목에 있거나
지정한 개발자 주소에서 온 메일만 골라 mail_inbox.json 으로 저장한다.
Planner Desk [메일 수신] 탭에서 이 파일을 불러오면 전달 건에 자동 매칭된다.

- 메일을 지우거나 읽음 처리하지 않는다. 이미 가져온 메일은 .mail_state.json 으로 건너뛴다.
- 연결 설정(mail_config.json)은 Planner Desk [메일 수신] > 메일 연동 설정에서 만들 수 있다.
- 비밀번호는 설정 파일에 넣지 않는다. 환경변수 MAIL_PASSWORD 가 없으면 실행할 때 묻는다.

사용:
  python tools/mail_sync.py --test     # 로그인만 확인
  python tools/mail_sync.py            # 동기화
  python tools/mail_sync.py --days 30  # 최근 30일
"""
import argparse
import email
import email.policy
import email.utils
import getpass
import imaplib
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
    "provider": "hiworks",
    "protocol": "pop3",
    "host": "pop3s.hiworks.com",
    "port": 995,
    "user": "me@company.co.kr",
    "folder": "INBOX",
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
        sys.exit(f"설정 파일을 만들었어: {CONFIG}\n"
                 "Planner Desk > 메일 수신 > 메일 연동 설정에서 저장한 파일로 바꾸거나, user(메일 주소)를 채우고 다시 실행해줘.")
    cfg = {**DEFAULT_CONFIG, **json.loads(CONFIG.read_text(encoding="utf-8"))}
    cfg.pop("password", None)
    pw = os.environ.get("MAIL_PASSWORD") or os.environ.get("HIWORKS_PASSWORD")
    cfg["password"] = pw or getpass.getpass(f"{cfg['user']} 비밀번호 (화면에 안 보임): ")
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


def wanted(msg, code_re, senders):
    if code_re.search(str(msg["Subject"] or "")):
        return True
    addr = email.utils.parseaddr(str(msg["From"] or ""))[1].lower()
    return bool(addr) and addr in senders


def parse(raw):
    return email.message_from_bytes(raw, policy=email.policy.default)


def fetch_pop3(cfg, since, keep, seen, test):
    box = poplib.POP3_SSL(cfg["host"], int(cfg["port"]), timeout=30)
    try:
        box.user(cfg["user"])
        box.pass_(cfg["password"])
        count, size = box.stat()
        print(f"로그인 OK · 받은편지함 {count}통 ({size // 1024 // 1024}MB)")
        if test:
            return [], 0
        uidl = dict((int(n), u) for n, u in (line.decode().split(" ", 1) for line in box.uidl()[1]))
        found, scanned = [], 0
        for n in range(count, max(0, count - int(cfg["scan_limit"])), -1):   # 최신 메일부터
            key = "pop:" + uidl.get(n, str(n))
            if key in seen:
                continue
            head = parse(b"\r\n".join(box.top(n, 0)[1]))
            scanned += 1
            d = mail_date(head)
            if d and d < since:
                break
            if keep(head):
                found.append(to_record(parse(b"\r\n".join(box.retr(n)[1]))))
                seen.add(key)
        return found, scanned
    finally:
        box.quit()


def fetch_imap(cfg, since, keep, seen, test):
    box = imaplib.IMAP4_SSL(cfg["host"], int(cfg["port"]), timeout=30)
    try:
        box.login(cfg["user"], cfg["password"])
        folder = cfg.get("folder") or "INBOX"
        typ, data = box.select(f'"{folder}"', readonly=True)
        if typ != "OK":
            sys.exit(f"폴더를 열 수 없어: {folder}")
        print(f"로그인 OK · {folder} {int(data[0])}통")
        if test:
            return [], 0
        _, data = box.uid("SEARCH", None, "SINCE", since.strftime("%d-%b-%Y"))
        uids = data[0].split()[-int(cfg["scan_limit"]):]
        found, scanned = [], 0
        for u in reversed(uids):
            key = f"imap:{folder}:{u.decode()}"
            if key in seen:
                continue
            _, h = box.uid("FETCH", u, "(BODY.PEEK[HEADER])")
            scanned += 1
            if not h or not isinstance(h[0], tuple) or not keep(parse(h[0][1])):
                continue
            _, b = box.uid("FETCH", u, "(BODY.PEEK[])")
            found.append(to_record(parse(b[0][1])))
            seen.add(key)
        return found, scanned
    finally:
        try:
            box.logout()
        except Exception:
            pass


def sync(cfg, days, test=False):
    code_re = re.compile(rf"\b{re.escape(cfg['code_prefix'])}-\d{{2,4}}\b", re.I)
    senders = {s.lower() for s in cfg["dev_senders"]}
    since = datetime.now(timezone.utc).astimezone() - timedelta(days=days)
    seen = set(json.loads(STATE.read_text(encoding="utf-8"))["seen"]) if STATE.exists() else set()
    fetch = fetch_imap if cfg["protocol"] == "imap" else fetch_pop3
    found, scanned = fetch(cfg, since, lambda m: wanted(m, code_re, senders), seen, test)
    if test:
        return
    print(f"새 메일 {scanned}통 확인 → 전달 건 관련 {len(found)}통")

    out = (HERE / cfg["output"]).resolve()
    old = json.loads(out.read_text(encoding="utf-8")).get("mails", []) if out.exists() else []
    ids = {m["messageId"] for m in found}
    merged = (found + [m for m in old if m["messageId"] not in ids])[:500]
    out.write_text(json.dumps({
        "source": f"{cfg['provider']}-{cfg['protocol']}", "account": cfg["user"], "host": cfg["host"],
        "exportedAt": datetime.now().astimezone().isoformat(timespec="seconds"), "mails": merged,
    }, ensure_ascii=False, indent=1), encoding="utf-8")
    STATE.write_text(json.dumps({"seen": sorted(seen)[-5000:]}), encoding="utf-8")
    print(f"저장: {out}  (Planner Desk → 메일 수신 → 동기화 파일 불러오기)")


def main():
    ap = argparse.ArgumentParser(description="회사 메일 → Planner Desk mail_inbox.json")
    ap.add_argument("--test", action="store_true", help="로그인만 확인")
    ap.add_argument("--days", type=int, help="최근 며칠치 (기본: 설정 days)")
    ap.add_argument("--quiet", action="store_true", help="작업 스케줄러용 (창 멈춤 없음)")
    a = ap.parse_args()
    cfg = load_config()
    try:
        sync(cfg, a.days or int(cfg["days"]), a.test)
    except (poplib.error_proto, imaplib.IMAP4.error) as e:
        sys.exit(f"메일 서버 응답 오류: {e}\n- 메일 주소·비밀번호 확인\n- 메일 환경설정에서 {cfg['protocol'].upper()} 사용이 켜져 있는지 확인 (관리자 차단 시 IT팀 문의)")
    except OSError as e:
        sys.exit(f"메일 서버에 연결 못 함 ({cfg['host']}:{cfg['port']}): {e}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
