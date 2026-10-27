# SmartAssistant for Anna

A weekly money and nutrition review, packaged as an Anna App (`@yido/smartassistant`).

## Layout

| Path | What it is |
|---|---|
| `app.json` | Listing fields and `bundled_executas` (handle `smartassistant`) |
| `manifest.json` | Schema 2 manifest. Uses `bundled:smartassistant` and `required:bundled:smartassistant` |
| `bundle/` | Static app: `index.html`, `app.js`, `engine.js`, `style.css`, `anna-tool-ids.js` |
| `executas/smartassistant/` | Python Executa (standard library only) with `plan_targets` and `weekly_review` |
| `tests/` | Python unit tests, JS parity tests and a browser smoke test |
| `../.github/workflows/executa-build.yml` | Builds the Executa for linux-x86_64, darwin-arm64 and darwin-x86_64 |

## How it works

- **Data layer.** `app.js` saves one JSON document under the key `smartassistant:v1`. Inside Anna it uses `anna.storage`. Outside Anna it uses `localStorage`. Entries older than 120 days are pruned because storage values are capped at 256 KB.
- **Calculations.** Inside Anna, the app requires the bundled Executa through `anna.tools.invoke` and shows an error if it is unavailable. The standalone browser preview uses `bundle/engine.js`. `tests/parity.json` is generated from the Python code and checked against the JS code, so the two cannot drift silently.
- **LLM.** The review does not need a model. If the host allows `llm.complete`, a "Short plain-text note" button rewrites the review in three sentences using only its numbers.
- **Run counter.** Each completed review adds a small record (date, days logged) to the user's own storage. Nothing is sent anywhere. It is shown in Settings so you can confirm a run produced a real result.

## Develop

```bash
anna-app validate --strict
anna-app dev                      # needs uv; opens http://localhost:5180/

python -m unittest discover -s tests -v          # Executa
python tests/make_parity.py                      # regenerate parity.json after a rule change
node --test tests/parity.test.mjs                # JS engine matches Python
node tests/e2e.mjs                               # browser smoke test (npm i puppeteer-core, Chrome installed)
```

On Windows the CLI prints a libuv assertion on exit. It is harmless.

## Linux binary and release

Cloud Agent runs on Linux, so a `linux-x86_64` Executa build must exist before you cut a version.

1. Push a tag: `git tag executa-v0.1.6 && git push origin executa-v0.1.6`.
2. `.github/workflows/executa-build.yml` runs the tests, builds all three binaries with PyInstaller, smoke-tests them, and attaches the `.tar.gz` and `.sha256` files to the release.
3. `executas/smartassistant/executa.json` points at the matching `executa-v0.1.6` release. The archive contains `manifest.json` and a `bin/` entrypoint. Change the tag, URLs, and Executa versions together for a future release.

Check the v0.1.6 release workflow and its release assets before cutting the app version.

## Tracking real usage

A qualified run needs a signed-in user, a successful primary function and a non-trivial result. Here that is a weekly review that returns `status: "ok"` (at least 3 of the last 7 days logged). Use the Anna Developer Console for the official numbers. Do not add paid, bot or incentivized usage.

<a id="privacy"></a>
## Privacy

The Anna App saves profile, expense, meal, water, and review records under `smartassistant:v1` in Anna's user-isolated App storage. Anna operates this persistent storage service. The App sends inputs to its bundled Executa for target calculations and weekly reviews; it does not send these records to a separate SmartAssistant server or third-party analytics service.

- **Retention:** Expense, meal, and water entries older than 120 days are removed when the App saves data. The 26 most recent reviews are kept.
- **Export and deletion:** Settings lets users export a JSON backup, restore it, or permanently delete the App's stored profile and entries. Exported files remain wherever users save them until they delete those files themselves.
- **Health information:** Calorie, macronutrient, and metabolic estimates are informational and are not medical advice.

## Before you publish (you do these)

- [ ] Run `anna-app validate --strict` and confirm the current Executa release assets exist on GitHub.
- [ ] Check that the English screenshots shown in Anna match the current app.
- [ ] Review the description in `app.json` and the categories in the Developer Console.
- [ ] Join the Builder Discord and post a short demo.
- [ ] Submit for review, then publish.
- [ ] Share where it fits: personal finance and fitness communities, with a short demo and a plain description. One post per community, no repeated posting.
