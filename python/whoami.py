#!/usr/bin/env python3
"""GET /v1/me — describe the calling key: its user, its scopes, the workspaces it can reach.

Expected: 200 and a JSON object. Without a key: the 401 problem in fixtures/401-missing-key.json.
"""
from _common import run

run(lambda api: api.me())
