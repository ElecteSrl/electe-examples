#!/usr/bin/env python3
"""A minimal MCP client for the ELECTE server: JSON-RPC over HTTP POST, standard library only.

    export ELECTE_MCP_KEY=...            # created on the platform's MCP Server screen
    python mcp_client.py                 # initialize, then tools/list
    python mcp_client.py <tool> ['{"arg": "value"}']   # initialize, then tools/call

Each request is one POST. The server answers plain JSON; an `event-stream` answer, which
the streamable-HTTP transport allows, is also read (the last `data:` line wins). A session
id the server hands back on `initialize` is echoed on the following requests.
"""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

ENDPOINT = os.environ.get("ELECTE_MCP_ENDPOINT", "https://mcp.electe.net/sse")
PROTOCOL_VERSION = "2025-06-18"
USER_AGENT = "electe-examples/mcp (+https://github.com/ElecteSrl/electe-examples)"


class McpClient:
    def __init__(self, api_key: str, endpoint: str = ENDPOINT, timeout: float = 60.0):
        self.api_key = api_key
        self.endpoint = endpoint
        self.timeout = timeout
        self.session_id: str | None = None
        self._next_id = 0

    def _post(self, payload: dict) -> dict | None:
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "Authorization": f"Bearer {self.api_key}",
            "MCP-Protocol-Version": PROTOCOL_VERSION,
            "User-Agent": USER_AGENT,
        }
        if self.session_id:
            headers["Mcp-Session-Id"] = self.session_id
        request = urllib.request.Request(self.endpoint, data=json.dumps(payload).encode(), headers=headers, method="POST")
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                self.session_id = response.headers.get("Mcp-Session-Id") or self.session_id
                return self._read(response.read(), response.headers.get("Content-Type", ""))
        except urllib.error.HTTPError as error:
            body = error.read().decode("utf-8", "replace")
            try:
                parsed = json.loads(body)
            except ValueError:
                parsed = {"error": {"code": error.code, "message": body[:300]}}
            sys.exit(f"HTTP {error.code}: {json.dumps(parsed.get('error', parsed))}")

    @staticmethod
    def _read(raw: bytes, content_type: str) -> dict | None:
        text = raw.decode("utf-8", "replace").strip()
        if not text:
            return None  # a notification gets 202 and no body
        if "text/event-stream" in content_type:
            data_lines = [line[5:].strip() for line in text.splitlines() if line.startswith("data:")]
            text = data_lines[-1] if data_lines else "{}"
        return json.loads(text)

    def request(self, method: str, params: dict | None = None) -> dict:
        self._next_id += 1
        answer = self._post({"jsonrpc": "2.0", "id": self._next_id, "method": method, "params": params or {}})
        if answer is None:
            sys.exit(f"{method}: empty answer")
        if "error" in answer:
            sys.exit(f"{method}: {json.dumps(answer['error'])}")
        return answer.get("result", {})

    def notify(self, method: str, params: dict | None = None) -> None:
        self._post({"jsonrpc": "2.0", "method": method, "params": params or {}})

    def initialize(self) -> dict:
        result = self.request(
            "initialize",
            {
                "protocolVersion": PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": {"name": "electe-examples", "version": "1.0.0"},
            },
        )
        self.notify("notifications/initialized")
        return result

    def list_tools(self) -> list[dict]:
        return self.request("tools/list").get("tools", [])

    def call_tool(self, name: str, arguments: dict | None = None) -> dict:
        return self.request("tools/call", {"name": name, "arguments": arguments or {}})


def main(argv: list[str]) -> None:
    api_key = os.environ.get("ELECTE_MCP_KEY") or os.environ.get("ELECTE_API_KEY", "")
    if not api_key:
        sys.exit("Set ELECTE_MCP_KEY — create one on the platform's MCP Server screen at https://platform.electe.net")
    client = McpClient(api_key)
    server = client.initialize()
    print("server:", json.dumps(server.get("serverInfo", server)), file=sys.stderr)

    if len(argv) == 0:
        for tool in client.list_tools():
            print(f"- {tool['name']}: {tool.get('description', '').strip()}")
            print("  input:", json.dumps(tool.get("inputSchema", {})))
        return

    name = argv[0]
    arguments = json.loads(argv[1]) if len(argv) > 1 else {}
    print(json.dumps(client.call_tool(name, arguments), indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1:])
