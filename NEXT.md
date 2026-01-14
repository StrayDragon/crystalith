# NEXT

## Dependencies
- sqlite-vss requires native BLAS (`libblas.so.3`, OpenBLAS). Without it, sqlite vector store tests are skipped.

## Warnings
- FastAPI `on_event` deprecation warnings emitted from startup/shutdown hooks; migrate to lifespan handlers when convenient.
