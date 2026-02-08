# {{cookiecutter.package_name}}

{{cookiecutter.description}}

## Install (editable)

```bash
pip install -e .
```

## Register

This project registers a plugin via:

```toml
[project.entry-points."crystalith.plugins"]
{{cookiecutter.plugin_id}} = "{{cookiecutter.module_name}}.plugin:plugin"
```
