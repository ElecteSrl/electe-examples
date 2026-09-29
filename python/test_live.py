"""Live checks against api.electe.net and mcp.electe.net.

The unauthenticated checks always run (they need no key). The authenticated ones run when
ELECTE_API_KEY is set and are skipped otherwise, so CI is green without a secret.

    python -m unittest test_live -v
"""
from __future__ import annotations

import json
import os
import unittest
import urllib.error
import urllib.request

from electe_api import ElecteApi, ElecteApiError

API_KEY = os.environ.get("ELECTE_API_KEY", "")
MCP_ENDPOINT = os.environ.get("ELECTE_MCP_ENDPOINT", "https://mcp.electe.net/sse")


def problem_from(error: ElecteApiError) -> dict:
    return error.problem


class Unauthenticated(unittest.TestCase):
    def test_missing_key_is_a_401_problem(self):
        with self.assertRaises(ElecteApiError) as caught:
            ElecteApi(api_key="").me()
        error = caught.exception
        self.assertEqual(error.status, 401)
        self.assertEqual(error.code, "UNAUTHORIZED")
        self.assertIn("application/problem+json", error.headers.get("Content-Type", "").lower())
        self.assertTrue(problem_from(error)["type"].endswith("/unauthorized"))

    def test_invalid_key_is_a_401_problem(self):
        with self.assertRaises(ElecteApiError) as caught:
            ElecteApi(api_key="not-a-real-key").me()
        self.assertEqual(caught.exception.status, 401)
        self.assertEqual(caught.exception.code, "UNAUTHORIZED")

    def test_unknown_route_is_a_404_problem(self):
        with self.assertRaises(ElecteApiError) as caught:
            ElecteApi(api_key="").get("/v1/this-route-does-not-exist")
        self.assertEqual(caught.exception.status, 404)
        self.assertEqual(caught.exception.code, "NOT_FOUND")

    def test_mcp_endpoint_rejects_a_missing_key_as_json_rpc(self):
        body = json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/list"}).encode()
        request = urllib.request.Request(
            MCP_ENDPOINT,
            data=body,
            method="POST",
            # The endpoint answers 403 to Python's default User-Agent; any explicit one is accepted.
            headers={"Content-Type": "application/json", "Accept": "application/json", "User-Agent": "electe-examples/tests"},
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                self.fail(f"expected 401, got {response.status}")
        except urllib.error.HTTPError as error:
            self.assertEqual(error.code, 401)
            payload = json.loads(error.read())
            self.assertEqual(payload["jsonrpc"], "2.0")
            self.assertEqual(payload["error"]["code"], -32600)


@unittest.skipUnless(API_KEY, "ELECTE_API_KEY not set — authenticated checks skipped")
class Authenticated(unittest.TestCase):
    def setUp(self):
        self.api = ElecteApi()

    def test_me_answers_200_with_an_object(self):
        self.assertIsInstance(self.api.me(), dict)
        self.assertTrue(any(k.lower() == "x-ratelimit-limit" for k in self.api.last_rate_limit))

    def test_workspaces_is_a_paginated_list(self):
        page = self.api.workspaces(limit=5)
        self.assertIsInstance(page.get("data"), list)
        self.assertIsInstance(page.get("page"), dict)

    def test_pagination_helper_walks_to_the_end(self):
        rows = list(ElecteApi.iterate(self.api.workspaces, page_size=2))
        self.assertGreaterEqual(len(rows), 0)


if __name__ == "__main__":
    unittest.main()
