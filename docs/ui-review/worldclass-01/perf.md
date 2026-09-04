# Performance baseline

Captured 2026-09-04 before product changes.

## Build and test

| Check | Baseline |
| --- | --- |
| TypeScript | `npx --no-install tsc -b` passed |
| Unit/component tests | 97 files passed after isolated retry; 706 tests passed |
| Full test wall time | 144.19 s |
| Production build | Passed in 13.36 s; 1,998 modules transformed |
| First-load JS | 179.7 KB gzip (200 KB budget) |
| PWA precache | 55 entries; 1,251.46 KiB |
| Extension build | Passed in 2.87 s; 669.69 kB output |

The initial full test run had one timeout in `extension/app/app-shell.test.tsx` under concurrent load. Its isolated rerun passed all 6 tests in 8.45 s, so the baseline is treated as green but the timeout remains worth watching.

## Browser navigation

These measurements come from the local Vite development server, not the compressed production bundle. Transferred bytes therefore include development modules and are useful as a same-environment comparison only.

| Persona / route | State | DCL | Load | LCP | Transfer | Requests |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Rep `/rep` | Cold | 127.7 ms | 128.8 ms | 232 ms | 5,398,055 B | 113 |
| Rep `/rep` | Warm | 103.8 ms | 104.7 ms | 152 ms | 5,398,055 B | 113 |
| Manager `/manage/dashboard` | Cold | 129.3 ms | 130.5 ms | 248 ms | 5,411,973 B | 106 |
| Manager `/manage/dashboard` | Warm | 103.4 ms | 104.4 ms | 176 ms | 5,411,973 B | 106 |

## Largest production JavaScript chunks

| Chunk | Gzip |
| --- | ---: |
| `index-C4KE6bBO.js` | 58,701 B |
| `vendor-supabase-CEIP6ZHu.js` | 54,413 B |
| `vendor-react-YY-YlRwC.js` | 49,568 B |
| `PreviewGallery-BCmAYtTk.js` | 21,388 B |
| `ManageView-BywaZYbl.js` | 15,340 B |
| `CrmScreen-Cb20PYZK.js` | 14,114 B |

## After-change comparison

Pending Phase 4. Repeat the same build and browser measurements and record deltas here.
