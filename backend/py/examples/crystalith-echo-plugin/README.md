# crystalith-echo-plugin

An example Crystalith plugin that registers an `echo` AI provider via:

```toml
[project.entry-points."crystalith.plugins"]
echo = "crystalith_echo_plugin.plugin:plugin"
```

This provider is intentionally simple and is mainly useful for testing plugin discovery.
