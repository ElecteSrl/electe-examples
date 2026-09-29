"""Minimal client for the ELECTE Platform API v1. Standard library only, Python 3.9+.

    export ELECTE_API_KEY=...        # created in the platform's API keys panel
    python whoami.py

Every v1 route is a GET authenticated with `Authorization: Bearer <key>`.
Errors are RFC 9457 problem documents; they surface as ElecteApiError with the
problem's `status`, `code` and `detail`. A 429 is retried once after `Retry-After`.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable, Iterator
from typing import Any

DEFAULT_BASE_URL = "https://api.electe.net"
USER_AGENT = "electe-examples/python (+https://github.com/ElecteSrl/electe-examples)"


class ElecteApiError(Exception):
    """A non-2xx answer, carrying the problem document the API returned."""

    def __init__(self, status: int, problem: dict[str, Any], headers: dict[str, str]):
        self.status = status
        self.problem = problem
        self.headers = headers
        code = problem.get("code", "UNKNOWN")
        detail = problem.get("detail") or problem.get("title") or ""
        super().__init__(f"{status} {code}: {detail}")

    @property
    def code(self) -> str:
        return str(self.problem.get("code", "UNKNOWN"))


class ElecteApi:
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        timeout: float = 30.0,
    ):
        self.api_key = api_key if api_key is not None else os.environ.get("ELECTE_API_KEY", "")
        self.base_url = (base_url or os.environ.get("ELECTE_API_BASE") or DEFAULT_BASE_URL).rstrip("/")
        self.timeout = timeout
        #: X-RateLimit-* and Retry-After from the most recent response.
        self.last_rate_limit: dict[str, str] = {}

    # -- transport ---------------------------------------------------------

    def get(self, path: str, params: dict[str, Any] | None = None, *, retry_on_429: bool = True) -> Any:
        url = f"{self.base_url}{path}"
        if params:
            query = {k: v for k, v in params.items() if v is not None}
            if query:
                url += "?" + urllib.parse.urlencode(query)
        request = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": USER_AGENT})
        if self.api_key:
            request.add_header("Authorization", f"Bearer {self.api_key}")
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                self._remember_rate_limit(response.headers)
                return json.load(response)
        except urllib.error.HTTPError as error:
            body = error.read()
            self._remember_rate_limit(error.headers)
            try:
                problem = json.loads(body) if body else {}
            except ValueError:
                problem = {"title": body.decode("utf-8", "replace")[:200], "status": error.code, "code": "NON_JSON"}
            if error.code == 429 and retry_on_429:
                wait = float(error.headers.get("Retry-After") or 1)
                time.sleep(min(wait, 60))
                return self.get(path, params, retry_on_429=False)
            raise ElecteApiError(error.code, problem, dict(error.headers)) from None

    def _remember_rate_limit(self, headers: Any) -> None:
        self.last_rate_limit = {
            key: value
            for key, value in headers.items()
            if key.lower().startswith("x-ratelimit") or key.lower() == "retry-after"
        }

    # -- routes (all GET, all need the `read` scope) -------------------------

    def me(self) -> dict[str, Any]:
        """The calling key: its user, its scopes, the workspaces it can reach."""
        return self.get("/v1/me")

    def workspaces(self, limit: int = 25, offset: int = 0) -> dict[str, Any]:
        return self.get("/v1/workspaces", {"limit": limit, "offset": offset})

    def workspace(self, workspace_id: str) -> dict[str, Any]:
        return self.get(f"/v1/workspaces/{workspace_id}")

    def data_sources(self, workspace_id: str, limit: int = 25, offset: int = 0) -> dict[str, Any]:
        """Connection credentials are never returned."""
        return self.get(f"/v1/workspaces/{workspace_id}/data-sources", {"limit": limit, "offset": offset})

    def reports(self, workspace_id: str, limit: int = 25, offset: int = 0) -> dict[str, Any]:
        """The list; a report's body is on `report()`."""
        return self.get(f"/v1/workspaces/{workspace_id}/reports", {"limit": limit, "offset": offset})

    def report(self, report_id: str) -> dict[str, Any]:
        """One report, including its generated content."""
        return self.get(f"/v1/reports/{report_id}")

    def report_status(self, report_id: str) -> dict[str, Any]:
        """Generation stage: queued, analysing, writing, exporting, completed or failed."""
        return self.get(f"/v1/reports/{report_id}/status")

    def usage(self, workspace_id: str, limit: int = 25, offset: int = 0) -> dict[str, Any]:
        """Metered usage for the key's user — the records Stripe is billed from."""
        return self.get(f"/v1/workspaces/{workspace_id}/usage", {"limit": limit, "offset": offset})

    def webhooks(self, workspace_id: str, limit: int = 25, offset: int = 0) -> dict[str, Any]:
        """Outbound webhooks; the signing secret is never returned."""
        return self.get(f"/v1/workspaces/{workspace_id}/webhooks", {"limit": limit, "offset": offset})

    # -- helpers -----------------------------------------------------------

    @staticmethod
    def iterate(fetch_page: Callable[..., dict[str, Any]], page_size: int = 100) -> Iterator[Any]:
        """Walk a paginated list (`limit`/`offset`, max 100 per page) to the end.

            for workspace in api.iterate(api.workspaces):
                ...
        """
        offset = 0
        while True:
            page = fetch_page(limit=page_size, offset=offset)
            rows = page.get("data", []) if isinstance(page, dict) else []
            yield from rows
            if len(rows) < page_size:
                return
            offset += page_size
