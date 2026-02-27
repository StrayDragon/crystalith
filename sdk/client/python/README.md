# Crystalith Python SDK

This package is the official Python client SDK for the Crystalith API. It is generated from the
repository OpenAPI schema using Fern.

## Install

```bash
pip install crystalith-sdk
```

## Minimal example

```python
import os

from crystalith_sdk import CrystalithClient

api_key = os.environ.get("CRYSTALITH_API_KEY")
headers = {"Authorization": f"Bearer {api_key}"} if api_key else None

client = CrystalithClient(base_url="http://127.0.0.1:8032", headers=headers)
notebooks = client.notebooks.list_notebooks()
print(notebooks)
```

## Development

From repo root:

```bash
just sdk-gen-python
```
