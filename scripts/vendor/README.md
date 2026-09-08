# Language NVS codec

`language-nvs.js` is an unchanged copy of `nvs.js` from
[smartrosary-language-editor](https://gitea.drlechk.net/lech/smartrosary-language-editor)
at commit `66225d226ca6c74b6bf1da4e5f6a07277c00fbd1`.

Copyright (c) 2026 SmartRosary contributors. Credit: SmartRosary project and
contributors. Distributed under the [PolyForm Noncommercial License](LICENSE).

The installer uses this codec only while building language partitions. This
keeps the public Pages build independent of the privately hosted editor.
When updating the codec, copy the reviewed version and its license, record the
commit here, and rerun the NVS CRC and content round-trip checks in the build.
