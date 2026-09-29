#!/usr/bin/env python3
"""GET /v1/workspaces — every workspace the key can reach, walking all pages.

Expected: one line per workspace. api.electe.net documents the list envelope as
{"data": [{"id": "…", "name": "…", "role": "owner"}], "page": {"limit": 25, "offset": 0}}.
"""
from _common import run


def main(api):
    return list(api.iterate(api.workspaces))


run(main)
