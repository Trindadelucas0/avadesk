import os, sys
import paramiko
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("179.199.149.12", username="root", password=os.environ["VPS_PASS"], timeout=20, allow_agent=False, look_for_keys=False)
cmd = r"""
set +e
echo '--- dns ---'
getent hosts chamados.avadesk.com.br avadesk.com.br www.avadesk.com.br 2>/dev/null
echo '--- curl public from vps ---'
curl -sSI -m 10 https://chamados.avadesk.com.br/login | head -20
echo '--- cloudflared logs ---'
journalctl -u cloudflared -n 40 --no-pager 2>/dev/null
echo '--- token dir ---'
ls -la /etc/cloudflared/
echo '--- other yml ---'
find /etc /root /opt -name '*tunnel*' -o -name '*cloudflare*' 2>/dev/null | head -40
echo '--- grep 3105 hostnames ---'
grep -RIn '3105\|chamados\|avadesk.com' /etc/cloudflared /root/.cloudflared 2>/dev/null | head -40
"""
_, stdout, stderr = c.exec_command(cmd, timeout=40)
print(stdout.read().decode("utf-8", "replace"))
print(stderr.read().decode("utf-8", "replace")[-3000:])
c.close()
