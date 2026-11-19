#!/usr/bin/env python3
"""Web Monitor server agent (Linux). Python 3.6+, standard library only.

Every minute it sends one snapshot of this server to Web Monitor:
  - CPU, memory, load, uptime; the top processes by CPU and by memory (name, user, pid; never full command lines)
  - every real filesystem: space and inodes
  - web-server access logs (nginx / Apache): requests, status codes, top IPs and their peak requests per second,
    and attack attempts (SQL injection, XSS, traversal, command injection, probes, scanners, login brute force)
  - web-server error logs: number of errors
It only reads. It never runs commands it receives: the connection is one-way (this server -> Web Monitor).
Query strings are inspected for attack signatures but never sent (they can carry personal data or tokens).

Config: /etc/webmonitor-agent.conf (written by the installer)
  token=...                 the site's agent token (Web Monitor -> site -> Advanced -> Server)
  endpoint=https://webmonitor.ruyalab.com/api/agent/ingest
  access_logs=/var/log/nginx/access.log,/var/log/apache2/access.log   (optional, globs allowed)
  error_logs=/var/log/nginx/error.log,/var/log/apache2/error.log       (optional)
"""
import glob
import json
import os
import pwd
import re
import socket
import sys
import time
import urllib.parse
import urllib.request

VERSION = "1.0.0"
CONF = os.environ.get("WEBMONITOR_AGENT_CONF", "/etc/webmonitor-agent.conf")
STATE = os.environ.get("WEBMONITOR_AGENT_STATE", "/var/lib/webmonitor-agent/state.json")
INTERVAL = 60
DEFAULT_ACCESS = ["/var/log/nginx/access.log", "/var/log/apache2/access.log", "/var/log/httpd/access_log", "/var/log/nginx/*access*.log", "/var/log/apache2/*access*.log"]
DEFAULT_ERROR = ["/var/log/nginx/error.log", "/var/log/apache2/error.log", "/var/log/httpd/error_log"]
REAL_FS = {"ext2", "ext3", "ext4", "xfs", "btrfs", "zfs", "f2fs", "jfs", "reiserfs", "vfat", "ntfs", "fuseblk"}
MAX_LOG_BYTES_PER_RUN = 50 * 1024 * 1024

# Same signatures as RuyaShield's log classifier (src/server/attacks/classify.ts), so both products agree.
ATTACK_RULES = [
    ("sqli", re.compile(r"(\bunion\b[\s+/*]+(all[\s+/*]+)?select\b|\bselect\b.+\bfrom\b.+\bwhere\b|\b(or|and)\b[\s+]+['\"]?\d+['\"]?\s*=\s*['\"]?\d|sleep\s*\(\s*\d|benchmark\s*\(|information_schema|waitfor[\s+]+delay|'\s*(or|and)\s*'|;\s*drop\s+table)", re.I)),
    ("xss", re.compile(r"(<\s*script|%3cscript|javascript:|onerror\s*=|onload\s*=|<\s*svg[^>]*on\w+=|alert\s*\(|document\.cookie)", re.I)),
    ("traversal", re.compile(r"(\.\./|\.\.%2f|%2e%2e%2f|%2e%2e/|\.\.\\|/etc/passwd|/proc/self|c:\\windows|boot\.ini|win\.ini)", re.I)),
    ("rce", re.compile(r"(\$\{jndi:|\bcmd=|;\s*(cat|wget|curl|bash|sh)\s|\|\s*(cat|id|whoami)\b|`[^`]*`|\$\((id|whoami|cat)|phpinfo\(|base64_decode\(|\beval\(|/bin/(ba)?sh)", re.I)),
    ("sensitive_probe", re.compile(r"(/\.env(\.\w+)?$|/\.git/|/\.svn/|/\.aws/|/\.ssh/|/\.htpasswd|/wp-config\.php(\.\w+)?$|/config\.(php|json|yml|yaml)\.(bak|old|save)|/backup\.(zip|sql|tar\.gz)|/(db|dump|database)\.sql|/\.DS_Store|/server-status|/phpinfo\.php|/actuator/(env|heapdump))", re.I)),
    ("shell_probe", re.compile(r"/(shell|c99|r57|wso|alfa|b374k|indoxploit|webshell|cmd|up|uploader|leaf|mini)\.(php|asp|aspx|jsp)$", re.I)),
    ("admin_bruteforce", re.compile(r"(/wp-login\.php|/xmlrpc\.php|/administrator/index\.php|/user/login|/phpmyadmin|/pma/|/adminer\.php|/manager/html|/admin/login)", re.I)),
]
SCANNER_UA = re.compile(r"(sqlmap|nikto|nmap|masscan|zgrab|nuclei|wpscan|acunetix|nessus|openvas|dirbuster|gobuster|ffuf|feroxbuster|wfuzz|hydra|joomscan|whatweb|netsparker|zmeu)", re.I)
# Combined / common log format: ip - user [time] "METHOD target PROTO" status size "ref" "ua"
LOG_LINE = re.compile(r'^(\S+) \S+ \S+ \[([^\]]+)\] "(\S+) (\S+)[^"]*" (\d{3}) \S+(?: "[^"]*" "([^"]*)")?')
MONTHS = {m: i for i, m in enumerate(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}


def read(path, default=""):
    try:
        with open(path) as f:
            return f.read()
    except OSError:
        return default


def load_conf():
    conf = {}
    for line in read(CONF).splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            conf[k.strip()] = v.strip()
    return conf


def load_state():
    try:
        with open(STATE) as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def save_state(state):
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    tmp = STATE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f)
    os.replace(tmp, STATE)


# ---------- system ----------

def cpu_times():
    parts = read("/proc/stat").splitlines()[0].split()[1:]
    vals = [int(x) for x in parts]
    idle = vals[3] + (vals[4] if len(vals) > 4 else 0)
    return sum(vals), idle


def memory():
    info = {}
    for line in read("/proc/meminfo").splitlines():
        k, _, v = line.partition(":")
        info[k] = int(v.split()[0]) * 1024 if v.strip() else 0
    total = info.get("MemTotal", 0)
    avail = info.get("MemAvailable", info.get("MemFree", 0))
    swap_total, swap_free = info.get("SwapTotal", 0), info.get("SwapFree", 0)
    return {"total": total, "used": total - avail, "percent": round((total - avail) / total * 100, 1) if total else None,
            "swap_percent": round((swap_total - swap_free) / swap_total * 100, 1) if swap_total else 0}


USERS = {}


def user_of(uid):
    if uid not in USERS:
        try:
            USERS[uid] = pwd.getpwuid(uid).pw_name
        except KeyError:
            USERS[uid] = str(uid)
    return USERS[uid]


def processes(prev, total_delta, ncpu):
    """Per-process CPU% since the last run (from /proc/<pid>/stat) and resident memory."""
    out, now = [], {}
    page = os.sysconf("SC_PAGE_SIZE")
    for pid in os.listdir("/proc"):
        if not pid.isdigit():
            continue
        stat = read("/proc/%s/stat" % pid)
        if not stat:
            continue
        try:
            name = stat[stat.index("(") + 1:stat.rindex(")")][:40]
            fields = stat[stat.rindex(")") + 2:].split()
            ticks = int(fields[11]) + int(fields[12])
            rss = int(fields[21]) * page
            uid = os.stat("/proc/%s" % pid).st_uid
        except (ValueError, IndexError, OSError):
            continue
        now[pid] = ticks
        cpu = None
        if pid in prev and total_delta > 0:
            cpu = round((ticks - prev[pid]) / total_delta * 100 * ncpu, 1)
        out.append({"pid": int(pid), "name": name, "user": user_of(uid), "cpu": cpu, "rss": rss})
    return out, now


def filesystems():
    seen, out = set(), []
    for line in read("/proc/mounts").splitlines():
        parts = line.split()
        if len(parts) < 3 or parts[2] not in REAL_FS or parts[0] in seen:
            continue
        seen.add(parts[0])
        try:
            st = os.statvfs(parts[1])
        except OSError:
            continue
        if not st.f_blocks:
            continue
        used = (st.f_blocks - st.f_bfree) * st.f_frsize
        total = st.f_blocks * st.f_frsize
        out.append({"mount": parts[1][:120], "fs": parts[2], "total": total, "used": used,
                    "percent": round(used / total * 100, 1) if total else None,
                    "inodes_percent": round((st.f_files - st.f_ffree) / st.f_files * 100, 1) if st.f_files else None})
    return out[:20]


# ---------- logs ----------

def log_files(conf_value, defaults):
    patterns = [p.strip() for p in conf_value.split(",") if p.strip()] if conf_value else defaults
    files = []
    for p in patterns:
        files.extend(sorted(glob.glob(p)))
    return [f for f in dict.fromkeys(files) if os.path.isfile(f)]


def new_lines(path, state):
    """Lines appended since the last run. Handles rotation (new inode) and truncation."""
    try:
        st = os.stat(path)
    except OSError:
        return []
    key = "log:" + path
    pos = state.get(key, {})
    offset = pos.get("offset", st.st_size)  # first run: start at the end, do not replay history
    if pos.get("inode") != st.st_ino or offset > st.st_size:
        offset = 0 if pos else st.st_size
    if st.st_size - offset > MAX_LOG_BYTES_PER_RUN:
        offset = st.st_size - MAX_LOG_BYTES_PER_RUN
    lines = []
    try:
        with open(path, "rb") as f:
            f.seek(offset)
            data = f.read(st.st_size - offset)
        lines = data.decode("utf-8", "replace").splitlines()
    except OSError:
        pass
    state[key] = {"inode": st.st_ino, "offset": st.st_size}
    return lines


def classify(target, ua):
    path = target.split("?", 1)[0]
    try:
        decoded = urllib.parse.unquote_plus(target)
    except Exception:
        decoded = target
    for kind, rx in ATTACK_RULES:
        subject = path if kind in ("sensitive_probe", "shell_probe", "admin_bruteforce") else decoded
        if rx.search(subject):
            return kind
    if ua and SCANNER_UA.search(ua):
        return "scanner"
    return None


def log_second(stamp):
    # 19/Nov/2026:12:00:01 +0000 -> epoch second (timezone offset applied)
    try:
        d, mon, rest = stamp.split("/", 2)
        y, hh, mm, ss_tz = rest.split(":", 3)
        ss, tz = ss_tz.split(" ")
        t = time.struct_time((int(y), MONTHS[mon], int(d), int(hh), int(mm), int(ss), 0, 1, 0))
        secs = int(time.mktime(t) - time.timezone)
        sign = -1 if tz[0] == "+" else 1
        return secs + sign * (int(tz[1:3]) * 3600 + int(tz[3:5]) * 60)
    except (ValueError, KeyError, IndexError):
        return None


def traffic(conf, state):
    files = log_files(conf.get("access_logs", ""), DEFAULT_ACCESS)
    total, statuses, by_ip, per_sec, attacks = 0, {"2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0}, {}, {}, {}
    for path in files:
        for line in new_lines(path, state):
            m = LOG_LINE.match(line)
            if not m:
                continue
            ip, stamp, method, target, status, ua = m.group(1), m.group(2), m.group(3), m.group(4), int(m.group(5)), m.group(6) or ""
            total += 1
            statuses["%dxx" % (status // 100)] = statuses.get("%dxx" % (status // 100), 0) + 1
            by_ip[ip] = by_ip.get(ip, 0) + 1
            sec = log_second(stamp)
            if sec is not None:
                k = (ip, sec)
                per_sec[k] = per_sec.get(k, 0) + 1
            kind = classify(target, ua)
            if kind:
                a = attacks.setdefault((ip, kind), {"ip": ip, "type": kind, "count": 0, "sample": ""})
                a["count"] += 1
                if not a["sample"]:
                    a["sample"] = (method + " " + target.split("?", 1)[0])[:160]  # never the query string
    peak = {}
    for (ip, _), n in per_sec.items():
        peak[ip] = max(peak.get(ip, 0), n)
    top = sorted(by_ip.items(), key=lambda x: -x[1])[:15]
    return {
        "logs": files[:10],
        "requests": total,
        "status": statuses,
        "top_ips": [{"ip": ip, "requests": n, "peak_rps": peak.get(ip, 0)} for ip, n in top],
        "attacks": sorted(attacks.values(), key=lambda a: -a["count"])[:30],
    }


def error_count(conf, state):
    files = log_files(conf.get("error_logs", ""), DEFAULT_ERROR)
    n = 0
    for path in files:
        for line in new_lines(path, state):
            if re.search(r"\[(error|crit|alert|emerg)\]|\b(error|crit|alert|emerg)\b:?", line, re.I):
                n += 1
    return {"logs": files[:10], "errors": n}


# ---------- main ----------

def snapshot(conf, state):
    total, idle = cpu_times()
    prev_total, prev_idle = state.get("cpu_total"), state.get("cpu_idle")
    total_delta = total - prev_total if prev_total else 0
    cpu = round((1 - (idle - prev_idle) / total_delta) * 100, 1) if prev_total and total_delta > 0 else None
    state["cpu_total"], state["cpu_idle"] = total, idle
    ncpu = os.cpu_count() or 1
    procs, ticks = processes(state.get("proc_ticks", {}), total_delta / ncpu if total_delta else 0, 1)
    state["proc_ticks"] = ticks
    load = read("/proc/loadavg").split()[:3]
    by_cpu = sorted([p for p in procs if p["cpu"] is not None], key=lambda p: -p["cpu"])[:10]
    by_mem = sorted(procs, key=lambda p: -p["rss"])[:10]
    return {
        "agent_version": VERSION,
        "hostname": socket.gethostname()[:80],
        "at": int(time.time()),
        "uptime_seconds": int(float(read("/proc/uptime", "0").split()[0])),
        "cpu": {"percent": cpu, "cores": ncpu, "load": [float(x) for x in load] if load else None},
        "memory": memory(),
        "processes": {"count": len(procs), "top_cpu": by_cpu, "top_memory": by_mem},
        "filesystems": filesystems(),
        "traffic": traffic(conf, state),
        "error_log": error_count(conf, state),
    }


def send(conf, payload):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(conf.get("endpoint", "https://webmonitor.ruyalab.com/api/agent/ingest"), data=body, method="POST",
                                 headers={"Content-Type": "application/json", "Authorization": "Bearer " + conf["token"],
                                          "User-Agent": "webmonitor-agent/" + VERSION})
    with urllib.request.urlopen(req, timeout=20) as res:
        return res.status


def run_once():
    conf = load_conf()
    if not conf.get("token"):
        print("No token in %s" % CONF, file=sys.stderr)
        return 2
    state = load_state()
    payload = snapshot(conf, state)
    save_state(state)
    try:
        status = send(conf, payload)
        print("sent: %s" % status)
        return 0
    except Exception as e:  # network errors: try again next minute
        print("send failed: %s" % e, file=sys.stderr)
        return 1


def main():
    if "--once" in sys.argv:
        sys.exit(run_once())
    if "--print" in sys.argv:  # show what would be sent (for checking)
        state = load_state()
        snapshot(load_conf(), state)
        time.sleep(2)
        print(json.dumps(snapshot(load_conf(), state), indent=1))
        return
    while True:
        started = time.time()
        try:
            run_once()
        except Exception as e:
            print("run failed: %s" % e, file=sys.stderr)
        time.sleep(max(5, INTERVAL - (time.time() - started)))


if __name__ == "__main__":
    main()
