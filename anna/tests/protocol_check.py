"""Check the Executa's real JSON-RPC stdio lifecycle.

Run from anna/: python tests/protocol_check.py [path-to-packaged-binary]
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "executas" / "smartassistant" / "smartassistant_plugin.py"
COMMAND = [sys.argv[1]] if len(sys.argv) > 1 else [sys.executable, str(SOURCE)]


def request(identifier, method, params=None):
    data = {"jsonrpc": "2.0", "id": identifier, "method": method}
    if params is not None:
        data["params"] = params
    return json.dumps(data)


requests = [
    request("first", "describe"),
    request(2, "describe"),
    request("ping", "invoke", {"tool": "ping", "arguments": {}}),
    request("invalid", "invoke", {"tool": "plan_targets", "arguments": {}}),
    request("recovered", "describe"),
]

process = subprocess.Popen(
    COMMAND, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    text=True, encoding="utf-8",
)
try:
    stdout, stderr = process.communicate("\n".join(requests) + "\n", timeout=30)
except subprocess.TimeoutExpired:
    process.kill()
    process.communicate()
    raise AssertionError("Executa did not answer and exit on EOF")

assert process.returncode == 0, f"Executa exited {process.returncode}: {stderr}"
responses = [json.loads(line) for line in stdout.splitlines()]
assert len(responses) == len(requests), f"Unexpected stdout: {stdout!r}"
assert [response["id"] for response in responses] == ["first", 2, "ping", "invalid", "recovered"]
assert all(response["jsonrpc"] == "2.0" for response in responses)
for index in (0, 1, 4):
    result = responses[index]["result"]
    assert result["version"] == "0.1.6"
    assert [tool["name"] for tool in result["tools"]] == ["ping", "plan_targets", "weekly_review"]
assert responses[2]["result"] == {"success": True, "data": {"pong": True, "version": "0.1.6"}}
assert responses[3]["result"]["success"] is False
print("protocol check passed: describe, invoke, failure, recovery, EOF")
