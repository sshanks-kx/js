# IPC fixtures

These frames were generated using `new com.kx.c().serialize(2, value, compress)`
from [KxSystems/javakdb at commit `2efe567`](https://github.com/KxSystems/javakdb/blob/2efe567bc6e239cdd0e531eeae735073105ceb69/javakdb/src/main/java/com/kx/c.java).
Message type `2` identifies an IPC response.

| File | Java value | Compression |
| --- | --- | --- |
| `table.ipc` | `c.Flip` with a symbol column `sym` (GBP, EUR) and a long column `size` (42, -2) | None |
| `keyed-table.ipc` | `c.Dict` with a one-column key `c.Flip` (`sym`) and a one-column value `c.Flip` (`size`) | None |
| `compressed-chars.ipc` | `"ABCD".repeat(1024).toCharArray()` | Standard IPC compression |
