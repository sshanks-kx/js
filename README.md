# kdb-js

`kdb-js` serializes JavaScript values to kdb+ IPC bytes and deserializes kdb+ IPC bytes to JavaScript values. Use it with kdb+ WebSocket messages or with IPC frames produced by q's `-8!`. The application manages connections and message handling.

## Install

Use Node.js **22.12 or later**. CI covers Node.js 22, 24, and 26. The package has no runtime dependencies. A q process is needed only for examples or applications that connect to kdb+.

From this repository, run `npm pack`. In your application, install the resulting archive. An archive is also available as an Actions artifact after a successful GitHub Release build.

```sh
npm install /path/to/kdb-js-0.1.0.tgz
```

```js
// ES modules
import { serialize, deserialize } from 'kdb-js';

const frame = serialize({ sym: '`GBP', size: 42, active: true });
console.log(deserialize(frame));
// { sym: 'GBP', size: 42, active: true }
```

For CommonJS, use `const { serialize, deserialize } = require('kdb-js');`. In a browser, serve `c.js` from your application and load it with `<script src="./c.js"></script>`. Load it before any script that calls the global `serialize` and `deserialize` functions.

## API

| Function | Input | Output |
| --- | --- | --- |
| `serialize(value)` | A supported JavaScript value | An `ArrayBuffer` containing one uncompressed, little-endian IPC frame with an eight-byte header and async message type |
| `deserialize(frame)` | One complete little-endian IPC frame in an `ArrayBuffer`, `Uint8Array`, or Node.js `Buffer` | A JavaScript value. Standard kdb+ IPC compression is supported on input. |

Pass binary data from a trusted source. The original codec assumes well-formed frames and a little-endian host. It has no streaming parser or separate handling for IPC error messages. WebSocket compression, when negotiated, is handled by the WebSocket implementation.

## WebSocket example

In a local q session, install a handler that decodes the incoming value and sends its binary encoding back. Then open port 5000.

```q
.z.ws:{neg[.z.w] -8!(-9!x);}
\p 5000
```

After installing the package, save the client as `echo.mjs` and run `node echo.mjs`. Node.js provides the `WebSocket` API used here. For a browser page, load `c.js` with the script tag shown above, omit the import, and remove the line that sets `process.exitCode`.

```js
import { serialize, deserialize } from 'kdb-js';

const websocket = new WebSocket('ws://127.0.0.1:5000/');
websocket.binaryType = 'arraybuffer';

websocket.addEventListener('open', () => {
  websocket.send(serialize({ sym: '`GBP', size: 42 }));
});

websocket.addEventListener('message', (event) => {
  try {
    console.log(deserialize(event.data)); // { sym: 'GBP', size: 42 }
  } finally {
    websocket.close();
  }
}, { once: true });

websocket.addEventListener('error', (event) => {
  console.error('WebSocket error', event.error ?? event.message ?? '');
  process.exitCode = 1;
});
```

For q-side details, see [kdb+ WebSockets](https://code.kx.com/q/kb/websockets/) and [IPC serialization](https://code.kx.com/q/basics/internal/#serialization).

## Type mappings

### JavaScript to q

| JavaScript value | q type or representation |
| --- | --- |
| `boolean` | Boolean atom (`-1h`) |
| `number` | Float atom (`-9h`), including whole numbers and IEEE-754 NaN and infinities |
| String beginning with a backtick, such as `` "`GBP" `` | Symbol atom (`-11h`), with the leading backtick removed |
| Other string | UTF-8 char vector (`10h`), including the empty string |
| `Date` | Datetime atom (`-15h`), using local calendar and clock fields |
| `null` | Generic null (`::`) |
| Dense array | General list (`0h`), including arrays of a single JavaScript type |
| Plain object | Dictionary (`99h`), with general lists of symbol keys and encoded values |

Use plain data objects with own enumerable string keys. Symbols and dictionary keys must avoid embedded NULs. The codec has no dedicated encoding for `BigInt`, typed arrays, `Map`, GUIDs, or q tables. `undefined` and sparse arrays cause a serialization error.

### q to JavaScript

| q type or representation | JavaScript value |
| --- | --- |
| Boolean | `boolean` |
| GUID | Lowercase hyphenated string |
| Byte, short, int, long, real, float | `number`. Short and int nulls become `NaN`, and their infinity sentinels become `±Infinity`. |
| Char atom | Single JavaScript character. ASCII char atoms are supported. |
| Char vector | UTF-8 string |
| Symbol | String without a backtick |
| General list or supported typed vector other than a char vector | Array, with elements converted using their atom mappings |
| Timestamp, month, date, datetime | `Date` using the UTC q epoch |
| Timespan, minute, second, time | `Date` with the duration added to the UTC q epoch of 2000-01-01 |
| Dictionary | Plain object with keys converted to property names |
| Table | Array of row objects |
| Keyed table | Two-element array `[keyRows, valueRows]` |
| Generic null | `null` |
| Functions | Lambda body or the string `"func"`, depending on the q function type |

The mapping is lossy. A q long can lose precision outside JavaScript's safe integer range, and long null/infinity sentinels become ordinary numbers. JavaScript dates have millisecond resolution, so timestamps and timespans lose sub-millisecond data. A JavaScript date serialized and then deserialized can shift by its original local UTC offset. The legacy text decoder supports UTF-8 through three-byte sequences. Supplementary characters such as emoji may be written, but do not round-trip through that decoder. See [q data types](https://code.kx.com/q/basics/datatypes/).

## Develop and test

```sh
npm ci
npm run build          # syntax-check c.js
npm test               # run node:test
npm run test:coverage  # write a console summary and LCOV/HTML reports
npm pack               # build and create the npm archive
```

The tests run without q, a network connection, or a browser. They include exact IPC byte checks, round trips, a classic browser script test, and reference fixtures generated independently with KX's Java API. After a coverage run, open `coverage/lcov-report/index.html` for the HTML report. The LCOV file is `coverage/lcov.info`.

## GitHub Actions and SonarQube Cloud

CI builds and tests pull requests targeting `main`, pushes to `main` (including merges), published GitHub Releases, and manual runs. The Node.js 24 job uploads the `coverage` artifact. The workflow checks that `npm pack` succeeds after the matrix passes. Published releases also have an `npm-package` workflow artifact containing the installable tarball.

To enable SonarQube Cloud for the new repository, import the GitHub repository into SonarQube Cloud, turn off **Automatic Analysis**, and add these settings under **Settings → Secrets and variables → Actions**.

| GitHub setting | Value |
| --- | --- |
| Variable `SONAR_ORGANIZATION` | SonarQube Cloud organization key |
| Variable `SONAR_PROJECT_KEY` | SonarQube Cloud project key |
| Secret `SONAR_TOKEN` | Token with Execute Analysis permission for the project |
| Optional variable `SONAR_REGION` | `us` or `au` for those instances. Leave empty for Europe. |

When configured, the Node.js 24 job sends coverage and analysis for `main` and same-repository pull requests other than Dependabot runs. Fork pull requests still build, test, and generate coverage without repository secrets. Release tags generate their own coverage and package artifacts while SonarQube Cloud tracks branches and pull requests. See [SonarQube Cloud's JavaScript coverage setup](https://docs.sonarsource.com/sonarqube-cloud/enriching/test-coverage/javascript-typescript-test-coverage/).

## License and origin

Apache-2.0. The codec comes from [KxSystems/kdb at commit `1daebf7`](https://github.com/KxSystems/kdb/blob/1daebf73349199b1318649fc2c5656cab2b4a7f2/c/c.js). See [LICENSE](LICENSE).
