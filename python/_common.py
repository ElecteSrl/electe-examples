"""Shared bits for the example scripts: build the client, print JSON, exit on a problem."""
from __future__ import annotations

import json
import os
import sys
from collections.abc import Callable
from typing import Any

from electe_api import ElecteApi, ElecteApiError


def require_env(name: str, hint: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        sys.exit(f"Set {name} — {hint}")
    return value


def run(call: Callable[[ElecteApi], Any]) -> None:
    require_env("ELECTE_API_KEY", "create a key in the platform's API keys panel at https://platform.electe.net")
    api = ElecteApi()
    try:
        result = call(api)
    except ElecteApiError as error:
        print(json.dumps(error.problem, indent=2), file=sys.stderr)
        sys.exit(f"→ HTTP {error.status} {error.code}")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    if api.last_rate_limit:
        print("→ " + ", ".join(f"{k}: {v}" for k, v in sorted(api.last_rate_limit.items())), file=sys.stderr)
