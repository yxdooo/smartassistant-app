/**
 * Anna App Runtime SDK — v0.26.0
 *
 * v0.26.0 — Agent run output cap + truncation signal (forum #403;
 *   docs/bug/forum-403-agent-session-output-cap-8192-regression.md;
 *   dispatcher 0.30.0, host >= 1.1.0-beta.200). Contract-only release —
 *   `AgentSession.run` / `anna.agent.session.run` already pass every arg
 *   through; this documents the new wire fields:
 *   • `sess.run({content, maxTokens?})` — optional per-call output cap for
 *     every model call in the run (1..65536). Effective value is
 *     `min(maxTokens, model output cap, 65536)` further clamped to the
 *     model's context-budget reserve (10 % of context, ≤ 65 536); it can
 *     only lower the cap, never raise it above platform ∩ model. Omit to
 *     use the model's own output cap (the beta.179–199 fixed 8192 default
 *     is gone).
 *   • `run_meta.max_output_tokens` — the effective per-call cap for THIS
 *     run (after ceiling + clamp), published before any token.
 *   • `task_complete.{stop_reason, truncated, max_output_tokens}` —
 *     `status: "completed"` ONLY means the graph finished normally;
 *     `truncated === true` (⇔ `stop_reason === "maxTokens"`) flags that the
 *     FINAL assistant message hit the per-call cap and is incomplete
 *     (`history()` stores it as-is). `stop_reason` shares the
 *     `llm.complete` `stopReason` set: `endTurn | maxTokens |
 *     contentFilter | toolUse`. Older hosts omit all three fields.
 *
 * v0.25.0 — Image async jobs + artifact re-signing (design:
 *   platform-media-generation-image-jobs.md §7 / §12.1; dispatcher 0.29.0).
 *   Image becomes the third media line with the video / music job shape —
 *   as an *opt-in* next to the unchanged synchronous `anna.image.generate`
 *   / `anna.image.edit` (byte-for-byte identical contract):
 *   • `anna.image.generateAsync(args & {clientTag?, idempotencyKey?})` /
 *     `anna.image.editAsync(...)` → `{jobId:"ijob_…", kind:"image",
 *     state:"queued", estimatedCostCU, deadlineAt, idempotentReplay}`.
 *     Request body = the sync body; one job = one user action = `n` images
 *     (held up-front, settled on actual output, refunded on failure /
 *     cancel). Same `idempotencyKey` rules as music (≤64 chars, 24 h).
 *   • `anna.image.getJob({jobId})` (re-signs every `result.images[].url`,
 *     ~30 min), `listJobs({state?, clientTag?, limit?, cursor?})`,
 *     `cancelJob({jobId})` (queued = full refund; running = best-effort).
 *   • `anna.image.generateAwait(args, {onProgress, signal, timeoutMs})` /
 *     `editAwait(...)` — the image twins of `video.generateAwait`
 *     (shared `mediaGenerateAwaitImpl`, now parameterised by the create
 *     method and filtering `media_job` events by `kind === "image"` /
 *     `ijob_` prefix). Resolve with the terminal job view whose
 *     `result.images[]` carry `{url, r2Key, mimeType, width, height,
 *     expiresIn}`; `url` is `null` once the object was GC'd (7 days).
 *   • `anna.image.resign({r2Keys})` → `{urls:[{r2Key, url, expiresIn}]}` —
 *     re-sign any already-paid artifact (sync result `r2_key` or job
 *     `r2Key`) for 7 days; one foreign / malformed key fails the whole call
 *     with `IMAGE_ASSET_NOT_FOUND` (`details.data.index`).
 *   • `anna.image.onJobEvent(fn)` — raw `media_job` stream (kind "image").
 *   Errors: `IMAGE_JOB_NOT_FOUND` / `IMAGE_JOB_NOT_CANCELLABLE` /
 *   `IMAGE_CONTENT_REJECTED` / `IMAGE_JOB_EXPIRED` / `IMAGE_ASSET_NOT_FOUND`
 *   via `HostRpcError` (name + `details.jsonrpc_code`; `details.data` now
 *   carries the facade `data` — `allowed`, `alternatives`, `index`). The sync
 *   path's provider content rejection moved from `APP_PROVIDER_ERROR` to
 *   `IMAGE_CONTENT_REJECTED` (-32115). `llm.catalog` image entries gain
 *   `capabilities.jobs` and `image_edit` entries report the real
 *   `options.n.max` (= grant `maxPerCallEdit`). Grant: `image_grant`
 *   (`allowGenerate` / `allowEdit`) — no new grant; manifest `host_api.image`
 *   must list the new method names. Coordinated: dispatcher / schema 0.29.0,
 *   anna-app-core 0.26.0, runtime-local a30, cli 0.1.60.
 *
 * v0.24.0 — Theme & locale propagation (design:
 *   anna-app-theme-propagation.md §2/§4, extended with locale per
 *   docs/design/apps/anna-music.md §12.2-G8).
 *   The host now tells every App which theme and UI language the user has
 *   chosen, so Apps no longer have to guess from `prefers-color-scheme` /
 *   `navigator.language`:
 *   • Initial values ride on the iframe URL (`?theme=light|dark&themeMode=
 *     light|dark|system&lang=en|zh-CN`) and are read synchronously in
 *     `connect()` — before any RPC, so the first paint is already right.
 *   • Live changes arrive as one-way host→app broadcast events
 *     `theme.changed {theme, mode}` and `locale.changed {lang}` (same
 *     envelope as `auth.refresh`; no `host_api` grant involved).
 *   • Read-only mirrors `rt.theme`, `rt.themeMode`, `rt.locale` are kept
 *     fresh even without subscribers; `rt.onThemeChange(fn)` /
 *     `rt.onLocaleChange(fn)` subscribe AND replay the current value once.
 *   Hosts older than this release send neither — the SDK falls back to
 *   `prefers-color-scheme` / `navigator.language` so old+new combinations
 *   keep working. No dispatcher / schema / backend change (additive).
 *
 * v0.23.0 — Music generation surface (design:
 *   platform-media-generation-music.md §7/§9/§12.1).
 *   Adds `anna.music.{generate,getJob,cancelJob,listJobs}` (async music
 *   jobs, `mjob_…` ids; same state machine / `media_job` events /
 *   pre-hold→settle→refund billing as video) and
 *   `anna.music.generateAwait(args, {onProgress, signal, timeoutMs})` —
 *   the music twin of `video.generateAwait` (shared implementation).
 *   `music.generate` args: `{prompt, lyrics?, instrumental?, durationSec?,
 *   format?, referenceImageUrl?, options?, model?, clientTag?,
 *   idempotencyKey?}`; replies carry `idempotentReplay` — when a replay is
 *   already terminal, `generateAwait` resolves immediately without polling.
 *   Unsupported features raise `MUSIC_FEATURE_UNSUPPORTED` (-32165) with
 *   `error.data.alternatives` (model names that support the feature) —
 *   never a silent downgrade. Terminal result: `{url, mimeType,
 *   durationSec|null, lyrics|null, seed, expiresIn}`.
 *   `video.generate` additionally accepts `idempotencyKey` (same 24h replay
 *   semantics). Requires manifest `ui.host_api.music` + per-app
 *   `media_grant.music`. Coordinated versions: dispatcher_version 0.28.0 +
 *   schema 0.28.0 + anna-app-core 0.25.0. Additive: old hosts reject the new
 *   namespace with `unknown_method`.
 *
 * v0.22.0 — Schema-driven media options (design:
 *   developer-model-playground-and-tts-options-schema.md §5.12, PR1/PR2).
 *   Contract-only release — every namespace is a pass-through proxy, so no
 *   runtime code changes; this documents the new wire fields:
 *   • `anna.llm.catalog()` models carry `isPlatformDefault` (who the host
 *     routes to when the user has no preference; `isUserPreferred` unchanged)
 *     and `capabilities.options` is a self-describing schema v2
 *     (`{type: "range"|"select"|"boolean"|"text"|"size", min, max, step,
 *     values, default, scope, label?, help?, affectsPrice?, custom?}`).
 *     `catalog({serviceType: "tts", voiceLanguage: "zh"})` filters
 *     `capabilities.voices[]`, whose entries now carry
 *     `gender? | accent? | age? | tags?`. `image_gen` / `image_edit` entries
 *     are populated (`options`, `sizeInput: "size"|"aspect_ratio"|"both"`,
 *     `edit: {referenceImages, maxReferenceImages?, mask}`, per-image CU
 *     `pricing`). `video_gen` entries add `capabilities.options` too, keyed
 *     by the `video.generate` request fields (`durationSec`, `resolution`,
 *     `aspectRatio`, `generateAudio`) so a rendered form merges 1:1 into the
 *     request; the legacy `duration / resolutions / aspectRatios` keys stay.
 *   • `anna.audio.speak({…, params?})` — `params` = any key of
 *     `capabilities.options`; legacy top-level `speed/language/timestamps/
 *     format` still work (merged, `params` wins). Response adds `params`
 *     (normalised, as sent to the provider) and `ignoredParams` (keys the
 *     model does not declare — dropped, never surcharged). New error
 *     `-32149 AUDIO_OPTION_INVALID` (`data.{key, reason, allowed}`).
 *   • `anna.image.generate/edit({…, model?, params?, fit?, aspect_ratio?})`
 *     — `model` = exact catalogue name (unknown → `-32110
 *     IMAGE_MODEL_UNAVAILABLE` + `data.allowed`); `modelPreferences.hints`
 *     stays as a legacy input. `fit: "nearest"` (default — closest size,
 *     same orientation) | `"strict"` (`-32111 IMAGE_SIZE_UNSUPPORTED` +
 *     `data.allowed`). `params` validated per model (`-32112
 *     IMAGE_OPTION_INVALID`). Response adds `requestedSize`, `size`,
 *     `sizeAdjusted`, `aspectRatio`, `fit`, `params`, `ignoredParams`;
 *     `images[].width/height` are the real decoded dimensions.
 *   Additive — old hosts ignore the new request fields.
 *
 * v0.21.0 — App realtime voice session (design:
 *   app-realtime-voice-session-and-executa-transcribe.md §5.2 / §5.3, PB2).
 *   Adds `anna.audio.session(config)` → `VoiceSession` handle over the host
 *   bridge relay (`audio.session.*` are handled IN the host page, which owns
 *   the `wss://…/anna-apps/runtime/voice` socket — the iframe never holds a
 *   token nor opens a network connection). Full-duplex pipeline: streaming
 *   ASR → LLM (`llm: "agent"` = this app's agent session, or `"none"`) →
 *   streaming TTS with barge-in. Handle API: `sendAudio(pcm16)` (16 kHz
 *   mono; auto-chunked ≤ 32 KB, fire-and-forget), `flushAudio()` (push-to-talk
 *   released → finalize the pending sentence), `setContext(text)`
 *   (≤ 4 KB live context injected into the NEXT turn's system prompt — not
 *   into history), `say(text, {priority, interrupt})` (TTS-only, no LLM),
 *   `interrupt()`, `end()`; events `asr_partial | asr_final | llm_start |
 *   llm_partial | llm_done | tts_audio | tts_done | interrupted | say_start |
 *   say_done | context_updated | asr_paused | asr_resumed | quota_warning |
 *   error | ended` (the host pauses ASR after `asrIdleTimeoutSec` without
 *   audio and reconnects on the next frame — push-to-talk is safe). Pure
 *   client helpers `anna.audio.mic({sampleRate})` (AudioWorklet 16 kHz PCM16
 *   capture, ScriptProcessor fallback) and `anna.audio.player({sampleRate})`
 *   (gapless 24 kHz PCM queue) share ONE source with the dashboard main-chat
 *   voice call (`static/js/anna-voice-client-core.js`, embedded below).
 *   Requires manifest `ui.host_api.audio ∋ "session"` (implies the outer
 *   iframe gets `allow="microphone"`) + user `media_grant.audio.{speak,
 *   transcribe}`; `llm:"agent"` additionally needs `host_api.agent.session`.
 *   Hosts without the relay reply `unknown_method`/`not_supported`.
 *   Additive — `audio.speak` / `audio.transcribe` unchanged.
 *
 * v0.20.0 — Media generation surface (design:
 *   platform-media-generation-video-audio.md §7/§9/§10).
 *   Adds `anna.video.{generate,getJob,cancelJob,listJobs}` (async video
 *   jobs; `generate` returns `{jobId, state, estimatedCostCU, deadlineAt}`),
 *   `anna.video.generateAwait(args, {onProgress, signal, timeoutMs})` —
 *   submit + `media_job` host-event subscription + adaptive `getJob`
 *   polling fallback, mirroring `tools.invokeAsyncAwait`; resolves with the
 *   terminal job view (`result.url` = presigned GET, ~30 min TTL — re-sign
 *   by calling `getJob` again on 403). AbortSignal → `video.cancelJob`
 *   (queued = full refund; running cancel is best-effort).
 *   Adds `anna.audio.{speak,transcribe}` (sync TTS ≤ model char cap / STT
 *   ≤10 min) and `anna.llm.catalog({serviceType?})` capability discovery
 *   (models + CU pricing + remaining quota). All gated by the per-app
 *   `media_grant`; manifest must declare `ui.host_api.video` / `.audio`.
 *   Coordinated versions: dispatcher_version 0.26.0 + schema 0.26.0.
 *   Additive: old hosts reject the new namespaces with `unknown_method`.
 *
 * v0.18.0 — Run-recovery pull surface (forum #341 P3: push pairs with pull).
 *   Adds `anna.agent.session.runStatus({app_session_uuid, run_id})` →
 *   `{status: "queued"|"running"|"completed"|"failed"|"cancelled", task_id,
 *   stream_id, started_at?, finished_at?, model?, error?}` (wire method
 *   `agent/session.run.status`; also `.runStatus(runId)` sugar on the
 *   AgentSession handle) and `anna.agent.session.frames({stream_id,
 *   after_seq?, limit?})` → `{frames, complete}` (archived rpc.stream
 *   replay; rate limit 30/min/user shared with the dashboard backfill
 *   endpoint; ~1h archive window). Check `runStatus` BEFORE re-running a
 *   silent stream — `completed` means the run executed and was charged;
 *   recover its output via `frames` instead of re-running.
 *   `AgentSession.run()` additionally arms an automatic first-frame
 *   fallback: if NO frame arrives within `opts.firstFrameTimeoutMs`
 *   (default 20s, stripped from the wire args) the stream self-recovers by
 *   polling `agent.session.frames` (3s→30s backoff, seq-deduped against
 *   late realtime frames) until a `done` frame — a dead realtime leg
 *   degrades to "late frames", never "permanent silence".
 *   Fix: seq=0 status frames (queued / watchdog terminal) no longer advance
 *   the reassembly cursor — previously ONE seq=0 frame silently dropped the
 *   first worker frame (started) via an off-by-one in `_push`.
 *   Coordinated versions: dispatcher_version 0.24.0 + schema 0.24.0 +
 *   anna-app-core 0.22.0. Additive: old hosts reject the new methods with
 *   `unknown_method`; the fallback then disarms silently.
 *
 * v0.17.0 — `anna.llm.complete(req)` transparently delivers LONG outputs over
 *   the streaming channel: when `req.maxTokens > 8192` (the platform's sync
 *   output ceiling — nexus `AppLlmLimits.SYNC_OUTPUT_CEILING`) the SDK
 *   routes the call through `llm.stream`, accumulates the `model_token`
 *   frames, and resolves with the exact `llm.complete` response shape
 *   (`{role, content:{type:'text',text}, model, stopReason, usage, _meta}`).
 *   Single-call semantics are unchanged — no code change needed in apps.
 *   Terminal frames with `_meta.textOmitted` (host slims frames > 48KB) are
 *   reassembled from the accumulated token text and verified against
 *   `_meta.textLength`. Stream `error` frames reject with the same
 *   `.code`-carrying Error shape as a plain RPC failure. Sync-path calls
 *   (`maxTokens` ≤ 8192 or omitted) are byte-identical to v0.16.x.
 *   Pure client-side sugar — no host/dispatcher change; design:
 *   matrix-nexus docs/design/app-llm-output-cap-unification.md Phase F.
 *
 * v0.16.1 — invokeAsyncAwait's wait_timeout message no longer embeds a
 *   call-shaped literal (`anna.tools.getJob({jobId})`): naïve source
 *   scanners (grep-class) treated the diagnostic string as a real host
 *   API call (forum #296). Wording only — no behavior change.
 *
 * v0.16.0 — Adds the `anna.mobile.*` native-bridge namespace (design
 *   anna-app-mobile-runtime-phase3.md P1): `anna.mobile.share({title?,
 *   text?, url?, filename?, data_url?})` → `{shared}` (user cancel is
 *   `{shared: false}`, not an error), `anna.mobile.haptics({type, style?})`
 *   → `{ok}` and `anna.mobile.camera_capture({camera?, quality?,
 *   max_bytes?})` → `{data_url, mime, width, height, byte_size}`.
 *   Requires manifest `ui.host_api.mobile`. Only executable inside the
 *   anna-mobile shell — the shell intercepts granted envelopes client-side;
 *   desktop containers reject with `.code = "unsupported_container"`
 *   (distinct from `permission_denied` = grant missing) so apps can render
 *   a clean degradation notice. Structured non-error rejections from the
 *   native layer: `permission_denied_by_user` / `cancelled` / `too_large`.
 *   Coordinated versions: dispatcher_version 0.22.0 + schema 0.22.0 +
 *   anna-app-core 0.20.0. Additive: old hosts reject with `unknown_method`.
 *
 * v0.15.0 — Adds the async tool-job family (design
 *   anna-app-tools-invoke-async-jobs.md §3): `anna.tools.invokeAsync`
 *   (returns `{jobId, state:"queued", deadlineMs}` immediately — no
 *   long-held HTTP request), `anna.tools.getJob({jobId, sinceSeq?, limit?})`
 *   (authoritative snapshot + incremental progress; also the reload-recovery
 *   read), `anna.tools.cancelJob({jobId, reason?})` (idempotent) and
 *   `anna.tools.listJobs({tool_id?, state?, clientTag?, since?, limit?})`.
 *   Plus the high-level `anna.tools.invokeAsyncAwait(args, opts?)` —
 *   invokeAsync + `tool_job` host-event subscription + adaptive polling
 *   fallback (2s before the first event, 15s once events flow) +
 *   `opts.onProgress(ev)` + `opts.signal` (abort → cancelJob) + wall-clock
 *   `opts.timeoutMs` (default job deadline + 30s); resolves with the plugin
 *   result payload, rejects with `.code` = `tool_failed` / `tool_timeout` /
 *   `cancelled` / `wait_timeout`. Use the async family for any tool call
 *   that may exceed the 90s synchronous ceiling.
 *   Coordinated versions: dispatcher_version 0.19.0 + schema 0.19.0 +
 *   anna-app-core 0.18.0 (all shipped in nexus ≥ 1.1.0-beta.108; jobs
 *   execute end-to-end from beta.110). Additive: old hosts reject the new
 *   methods with `not_implemented`.
 *
 * v0.14.0 — Adds `anna.agent.session.catalog()` — pre-create discovery of
 *   the platform-tool universe for agent sessions. Returns
 *   `{platform_tools: [{name, description, dev_safe, declared_in_manifest,
 *   user_granted, eligible, blocked_by?}], inherit_host_tools_granted,
 *   manifest_declared, user_granted}` so apps can learn which names are
 *   legal in create-time `quotaCaps.allowed_tools` / per-run
 *   `allowed_tools` — previously only discoverable after-the-fact via the
 *   create response's `granted_tools` echo. Read-only; mints no session.
 *   Coordinated bump: wire method `agent/session.catalog` —
 *   dispatcher_version 0.18.0 + schema 0.18.0 + anna-app-core 0.17.0.
 *   Additive: old hosts reject with `not_implemented`.
 *
 * v0.11.0 — Adds the `anna.credentials.*` namespace — platform-credentials
 *   multi-account access (design platform-credentials-multi-account.md §7).
 *   `anna.credentials.list_accounts({provider})` lists the user's authorized
 *   accounts (metadata only — never tokens); `anna.credentials.get_token(
 *   {provider, account_id?})` returns a short-lived access_token for one
 *   account (`account_id` omitted → the user's default account). Gated by
 *   manifest `ui.host_api.credentials` (a list of PROVIDER IDS, e.g.
 *   ["google"]) plus the user-enabled per-app `credentials_grant`.
 *   Coordinated bump: wire namespace `credentials/*` — dispatcher_version
 *   0.13.0 + schema 0.13.0 + anna-app-core 0.12.0. Additive: old hosts
 *   return `-32601 Method not found` for `credentials.*`.
 *
 * v0.10.0 — Adds `anna.llm.stream(req)` — streaming L1 completion. Takes the
 *   SAME request shape as `anna.llm.complete(req)` but returns an
 *   AgentRunStream (async-iterable) instead of a single result; the host
 *   streams `{event:"model_token", text}` frames followed by a terminal
 *   `{event:"complete", role, content, model, stopReason, usage, _meta}` frame
 *   over the shared `rpc.stream` topic (same reassembly machinery as
 *   `agent.session.run`):
 *     for await (const ev of anna.llm.stream({ messages, maxTokens })) {
 *       if (ev.event === "model_token") render(ev.text);
 *     }
 *   Coordinated bump: wire method `llm/stream` — dispatcher_version 0.12.0 +
 *   schema 0.12.0 + anna-app-core 0.11.0. Additive: old hosts return
 *   `-32601 Method not found` for `llm.stream` (apps should feature-detect
 *   and fall back to `llm.complete`).
 *
 * v0.9.0 — Adds the `anna.apps.*` launcher namespace and view `chrome`
 *   support. New raw RPCs `apps.list` / `apps.search` / `apps.get` /
 *   `apps.launch` browse and open other installed Anna Apps, and the nested
 *   `anna.apps.deck.{list,add,remove,reorder}` namespace manages the user's
 *   pinned app deck (wire methods `apps/deck.*`). `app_ref` accepts a numeric
 *   app id or an `@handle/slug` string. Also surfaces the per-view `chrome`
 *   ("solid" | "vibrancy") and `transparent` flags on `viewMeta`, which the
 *   host window manager uses to render translucent / transparent chrome.
 *   Coordinated bump: wire namespace `apps/*` + manifest `ui.host_api.apps`
 *   and `ui.views[].chrome` / `.transparent` — dispatcher_version 0.11.0 +
 *   schema 0.11.0 + anna-app-core 0.10.0. Additive: old hosts return
 *   `-32601 Method not found` for `apps.*` and ignore `chrome`/`transparent`.
 *
 * v0.8.0 — Adds `anna.agent.session.refresh(args)` plus the same `.refresh()`
 *   sugar on the AgentSession handle, and surfaces session lifecycle metadata
 *   (`expires_at`, `max_lifetime_at`, `idle_ttl_seconds`, `session_expires_in`)
 *   on every AgentSession. `refresh` re-mints the short-lived capability token
 *   for an EXISTING session (by `app_session_uuid`) AND slides its idle window,
 *   so a session survives long idle gaps, iframe reloads and host restarts:
 *     await anna.agent.session.refresh({ app_session_uuid })   // raw RPC
 *     await sess.refresh()                                     // handle sugar
 *   `refresh` is identity-authed (it does NOT require a live token), which is
 *   what lets it recover a session whose token already lapsed
 *   (`APP_SESSION_TOKEN_EXPIRED`). It fails with `APP_SESSION_EXPIRED` /
 *   `APP_SESSION_REVOKED` only when the underlying session is genuinely gone.
 *   The handle's lifecycle fields are refreshed in place from the response.
 *   Coordinated bump: wire method `agent/session.refresh` —
 *   dispatcher_version 0.10.0 + schema 0.10.0 + anna-app-core 0.9.0.
 *   Additive: old hosts return `-32601 Method not found`.
 *
 * v0.7.0 — Adds `anna.agent.session.attach(app_session_uuid)` — returns an
 *   AgentSession handle bound to an EXISTING session you already know the
 *   uuid of (e.g. one returned by `anna.agent.session.list()` after an
 *   iframe reload / in another tab). Unlike `anna.agent.session(opts)` it
 *   does NOT mint a new session — it is a pure client-side wrapper, so
 *   there is no new wire method and no dispatcher/schema change. The
 *   returned handle exposes the same streaming `.run()`, `.cancel()`,
 *   `.history()`, `.delete()` sugar over the existing `agent.session.*`
 *   RPCs (all of which are keyed by `app_session_uuid`). Accepts either a
 *   bare uuid string or a `{ app_session_uuid, ... }` info object (e.g. a
 *   row from `list()`), which also seeds submode/label metadata.
 *
 * v0.6.0 — Adds `anna.agent.session.list(args)` — account/app-scoped
 *   enumeration of the current app's active agent sessions. Lives only on
 *   the `agent.session` namespace (raw RPC), NOT on the per-session
 *   AgentSession wrapper, since it returns a list across sessions. Args:
 *     { include_expired?: boolean, limit?: number (1-100, default 50) }
 *   Returns { sessions: [{ app_session_uuid, kind, submode,
 *     fixed_client_id, label, created_at, last_active_at, expires_at }] }.
 *   Lets an app re-attach to / clean up sessions after an iframe reload or
 *   crash. Coordinated bump: dispatcher_version 0.9.0 + schema 0.9.0 +
 *   anna-app-core 0.8.0. No breaking changes.
 *
 * v0.4.1 — Per-namespace default RPC timeouts and per-call override.
 *   image.* / upload.* / agent.* / llm.* used to share the 30s default,
 *   but real LLM / image-gen latency easily exceeds that on high-res
 *   prompts (Seedream 5.0 @ 2048x2048 can take 60-120s). New defaults:
 *     image:   180s   upload:  120s   agent:  300s   llm:  180s
 *     storage:  30s   chat/window/...: 30s (unchanged)
 *   Any call can override via a second arg, e.g.
 *     await anna.image.generate(args, { timeoutMs: 240000 })
 *
 * Loaded by every Anna App iframe as a native ES module via
 *   `import { AnnaAppRuntime } from "/static/anna-apps/_sdk/latest/index.js"`.
 * Provides a typed proxy over the postMessage RPC bridge to the host
 * (Anna dashboard). All host calls go through the host page (parent
 * window), which validates them against the app's manifest ACL before
 * forwarding to the backend.
 *
 * v0.4.0 — BREAKING: removed the cross-origin HTTP shim and the
 * `AnnaHostError` class. `anna.image.{generate,edit}` and
 * `anna.upload.{inline,negotiate,confirm}` now go through the same
 * postMessage → `/api/v1/anna-apps/runtime/rpc` dispatcher channel as
 * every other namespace (symmetric with `anna.storage.*` /
 * `anna.llm.complete`). The dispatcher mints the underlying
 * `app_session_token` server-side; the iframe never holds capability
 * credentials. Errors arrive as the standard RPC error shape:
 * `Error` with `.code` (e.g. `APP_ERR_NOT_GRANTED`,
 * `APP_ERR_QUOTA_EXCEEDED`, `not_implemented`) and `.details`. Apps
 * that previously branched on `err.status === 403/415/429` must rewrite
 * to branch on `err.code` (see VERSIONS.md changelog for the mapping).
 *
 * v0.3.1 — packaged as pure ESM (no IIFE / window-global). Consumers must
 * use `<script type="module">` + `import`. Legacy `<script src=...>`
 * loading is no longer supported.
 *
 * Envelope: { kind:"req"|"res"|"event", id, ns, method, args | result | error }
 *
 * Usage inside the iframe:
 *
 *     import { AnnaAppRuntime } from "/static/anna-apps/_sdk/latest/index.js";
 *     const anna = await AnnaAppRuntime.connect();
 *     // Mint-only tool_ids (tool-{handle}-{slug}-{uniq}) carry no separator,
 *     // so the target plugin method is supplied via `method`:
 *     const out  = await anna.tools.invoke({
 *       tool_id: "tool-twitter-handle-twitter-tool-abcd1234",
 *       method: "post_tweet",
 *       args: { text: "hi" },
 *     });
 *     await anna.window.set_title({ title: "My App" });
 *     anna.on("entry_payload", (p) => console.log(p));
 *     // Host pushes `entry_payload` when a single-instance view is re-invoked
 *     // with a fresh payload (forum #376); `p` is the full merged payload and
 *     // `anna.entryPayload` is refreshed automatically (SDK >= 0.19.0).
 */

// ---- Internals ----
  function uuid() {
    return (
      Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10)
    );
  }

  // Per-namespace default RPC timeout (ms). Picked to comfortably cover
  // upstream provider P99 latency (host bridge fetch is unbounded; backend
  // httpx is 180s for image). Apps can override per-call via the second
  // arg: `anna.image.generate(args, { timeoutMs: 240000 })`.
  const DEFAULT_TIMEOUTS_BY_NS = {
    image: 180000,   // image gen/edit; matches src/tools/image_generation_tool.py httpx=180s
    upload: 120000,  // large multipart / negotiate+confirm
    agent: 300000,   // session.run can loop through model+tools many turns
    llm: 180000,     // long completions / large context
    // `tools.invoke` host bound = 65s plugin + 2s grace + 3s SDK margin.
    // Apps requesting longer per call must pass { timeoutMs }; bounded
    // server-side by ANNA_APP_TOOLS_INVOKE_TIMEOUT_MAX_MS.
    tools: 70000,
    // `files.*` covers R2 presign + DB write (upload_init/finalize); the
    // browser→R2 PUT itself is direct (not via this SDK), but the host
    // round-trip for finalize needs DB+R2 head ~ up to a few seconds.
    files: 60000,
    // `web.*` — search is usually <5s but fetch crawls up to 10 pages with
    // a 30s per-page budget under host-side concurrency limits. Apps doing
    // large fetch batches should pass { timeoutMs: 90000 } per call.
    web: 60000,
  };
  const DEFAULT_TIMEOUT_MS = 30000;

  // Build a target proxy that exposes namespace.method(args, opts?) calls.
  // The optional second arg accepts `{ timeoutMs }`; missing → namespace
  // default → 30000 fallback.
  function buildNamespace(rt, ns) {
    return new Proxy(
      {},
      {
        get(_, method) {
          if (typeof method !== "string") return undefined;
          return (args, opts) => rt.call(ns, method, args || {}, opts);
        },
      }
    );
  }

  // ---- Web namespace (v0.13.0; Phase 2 adds image_search / image_fetch) ----
  //
  // Plain proxy over the `web` namespace with camelCase aliases so both
  // `anna.web.image_search(...)` (wire name, matches the manifest
  // `ui.host_api.web` entry) and `anna.web.imageSearch(...)` (RFC §2.3
  // spelling) hit the same dispatcher method.
  const WEB_METHOD_ALIASES = {
    imageSearch: "image_search",
    imageFetch: "image_fetch",
  };
  function buildWebNamespace(rt) {
    return new Proxy(
      {},
      {
        get(_, method) {
          if (typeof method !== "string") return undefined;
          const wire = WEB_METHOD_ALIASES[method] || method;
          return (args, opts) => rt.call("web", wire, args || {}, opts);
        },
      }
    );
  }

  // ---- Tools namespace (v0.12.0; async job family v0.15.0) ----
  //
  // Plain RPC proxy (`anna.tools.invoke`, `anna.tools.list`,
  // `anna.tools.invokeAsync`, `anna.tools.getJob`, `anna.tools.cancelJob`,
  // `anna.tools.listJobs`) plus two client-side helpers:
  //
  //     const off = anna.tools.onChanged(({ client_id, deployed }) => {
  //       // deploy reconciliation just landed tools on the agent —
  //       // re-run anna.tools.list() and re-enable buttons.
  //     });
  //
  //     const result = await anna.tools.invokeAsyncAwait(
  //       { tool_id, method, args, timeoutMs: 300000, clientTag: "render-1" },
  //       { onProgress: (ev) => bar.update(ev), signal: abortCtl.signal },
  //     );
  //
  // `invokeAsyncAwait` = invokeAsync + `tool_job` host-event subscription +
  // adaptive polling fallback + abort→cancelJob. It resolves with the
  // plugin's result payload and rejects with `.code` set to `tool_failed`,
  // `tool_timeout` (job expired), `cancelled` or `wait_timeout` (client
  // wall clock elapsed — the job may still be running; keep the `.jobId`
  // property and recover via getJob/listJobs).

  const JOB_TERMINAL_STATES = new Set([
    "succeeded",
    "failed",
    "cancelled",
    "expired",
  ]);
  // Poll cadence for invokeAsyncAwait: tight before the first host event
  // proves the push channel is alive, relaxed afterwards (events reset the
  // timer, so polling is purely a safety net once they flow).
  const JOB_POLL_NO_EVENTS_MS = 2000;
  const JOB_POLL_WITH_EVENTS_MS = 15000;

  function jobErrorFromSnapshot(snap) {
    const e = snap.error || {};
    const code =
      e.code ||
      (snap.state === "expired"
        ? "tool_timeout"
        : snap.state === "cancelled"
          ? "cancelled"
          : "tool_failed");
    const err = new Error(
      e.message || `tool job ${snap.jobId} ended as ${snap.state}`
    );
    err.code = code;
    err.details = e.details;
    err.jobId = snap.jobId;
    err.state = snap.state;
    return err;
  }

  function invokeAsyncAwaitImpl(rt, args, opts = {}) {
    const onProgress =
      typeof opts.onProgress === "function" ? opts.onProgress : null;
    const signal = opts.signal || null;

    return new Promise((resolve, reject) => {
      let settled = false;
      let jobId = null;
      let lastSeq = 0;
      let eventSeen = false;
      let pollTimer = null;
      let wallTimer = null;
      let pollInFlight = false;
      let offEvent = null;
      let onAbort = null;

      const cleanup = () => {
        if (pollTimer) clearTimeout(pollTimer);
        if (wallTimer) clearTimeout(wallTimer);
        if (offEvent) offEvent();
        if (signal && onAbort) signal.removeEventListener("abort", onAbort);
      };
      const settleOk = (v) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(v);
      };
      const settleErr = (e) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (jobId && e && typeof e === "object" && !e.jobId) e.jobId = jobId;
        reject(e);
      };

      const deliverProgress = (events) => {
        for (const ev of events || []) {
          if (!ev || typeof ev.seq !== "number" || ev.seq <= lastSeq) continue;
          lastSeq = ev.seq;
          if (onProgress) {
            try {
              onProgress(ev);
            } catch (_) {}
          }
        }
      };

      const schedulePoll = (delayMs) => {
        if (settled) return;
        if (pollTimer) clearTimeout(pollTimer);
        const delay = Number.isFinite(delayMs)
          ? delayMs
          : eventSeen
            ? JOB_POLL_WITH_EVENTS_MS
            : JOB_POLL_NO_EVENTS_MS;
        pollTimer = setTimeout(poll, delay);
      };

      const poll = async () => {
        if (settled || pollInFlight || !jobId) return;
        pollInFlight = true;
        try {
          const snap = await rt.call("tools", "getJob", {
            jobId,
            sinceSeq: lastSeq,
          });
          deliverProgress(snap.progress);
          if (JOB_TERMINAL_STATES.has(snap.state)) {
            if (snap.state === "succeeded") settleOk(snap.result ?? {});
            else settleErr(jobErrorFromSnapshot(snap));
            return;
          }
        } catch (e) {
          // job_not_found after creation = retention raced us — fatal;
          // transient RPC errors just wait for the next cycle.
          if (e && e.code === "job_not_found") {
            settleErr(e);
            return;
          }
        } finally {
          pollInFlight = false;
        }
        schedulePoll();
      };

      const onJobEvent = (payload) => {
        if (settled || !payload || payload.job_id !== jobId) return;
        eventSeen = true;
        if (
          payload.event &&
          typeof payload.seq === "number" &&
          payload.seq > lastSeq
        ) {
          deliverProgress([
            { seq: payload.seq, ts: null, type: payload.event.type, data: payload.event.data || {} },
          ]);
        }
        // Terminal push → fetch the authoritative snapshot immediately
        // (the event never carries the result); otherwise just reset the
        // poll backoff — events are flowing, polling is a safety net.
        schedulePoll(payload.terminal ? 0 : JOB_POLL_WITH_EVENTS_MS);
      };

      const start = async () => {
        if (signal && signal.aborted) {
          const err = new Error("invokeAsyncAwait aborted before start");
          err.code = "cancelled";
          settleErr(err);
          return;
        }
        let created;
        try {
          created = await rt.call("tools", "invokeAsync", args || {});
        } catch (e) {
          settleErr(e);
          return;
        }
        jobId = created.jobId;
        const wallMs = Number.isFinite(opts.timeoutMs)
          ? opts.timeoutMs
          : Math.max(0, created.deadlineMs - Date.now()) + 30000;
        wallTimer = setTimeout(() => {
          const err = new Error(
            `invokeAsyncAwait wall clock elapsed after ${wallMs}ms; ` +
              `job ${jobId} may still be running — recover it with the ` +
              `tools.getJob host method using this jobId`
          );
          err.code = "wait_timeout";
          settleErr(err);
        }, wallMs);
        offEvent = rt.on("tool_job", onJobEvent);
        if (signal) {
          onAbort = () => {
            // Fire-and-forget cancel; the job transitions to cancelled and
            // the terminal event/poll settles the promise with .code
            // "cancelled". Errors here are non-fatal (job may already be
            // terminal — cancelJob is idempotent).
            rt.call("tools", "cancelJob", {
              jobId,
              reason: "aborted by app (AbortSignal)",
            }).catch(() => {});
            schedulePoll(0);
          };
          signal.addEventListener("abort", onAbort, { once: true });
        }
        schedulePoll(JOB_POLL_NO_EVENTS_MS);
      };

      start();
    });
  }

  function buildToolsNamespace(rt) {
    return new Proxy(
      {},
      {
        get(_, method) {
          if (typeof method !== "string") return undefined;
          if (method === "onChanged") {
            return (fn) => rt.on("tools.changed", fn);
          }
          if (method === "onJobEvent") {
            // Low-level escape hatch: raw `tool_job` host events
            // ({job_id, tool_id, state, seq, event, terminal}). Most apps
            // should prefer invokeAsyncAwait / getJob.
            return (fn) => rt.on("tool_job", fn);
          }
          if (method === "invokeAsyncAwait") {
            return (args, opts) => invokeAsyncAwaitImpl(rt, args, opts || {});
          }
          return (args, opts) => rt.call("tools", method, args || {}, opts);
        },
      }
    );
  }

  // ---- Video namespace (v0.20.0) ----
  //
  // `anna.video.generateAwait(args, {onProgress, signal, timeoutMs})` =
  // video.generate + `media_job` host-event subscription + adaptive
  // video.getJob polling fallback — the media twin of
  // `tools.invokeAsyncAwait`. Resolves with the terminal job view
  // ({jobId, state:"succeeded", result:{url, mimeType, durationSec, ...},
  // billedCostCU}); `result.url` is a ~30 min presigned GET — call
  // `anna.video.getJob({jobId})` again to re-sign after expiry.

  function mediaJobErrorFromView(view, ns = "video") {
    const e = view.error || {};
    const code =
      e.code ||
      (view.state === "expired"
        ? `${ns}_timeout`
        : view.state === "cancelled"
          ? "cancelled"
          : `${ns}_failed`);
    const err = new Error(
      e.message || `media job ${view.jobId} ended as ${view.state}`
    );
    err.code = code;
    err.jobId = view.jobId;
    err.state = view.state;
    return err;
  }

  // Shared by video (v0.20.0), music (v0.23.0) and image (v0.25.0): `ns`
  // selects the RPC namespace; wire shapes are identical except the music /
  // image job views carry `idempotentReplay` (a terminal replay resolves
  // without polling). `impl.createMethod` (default "generate") lets image
  // submit through `generateAsync` / `editAsync` while the sync `generate` /
  // `edit` keep their contract; `impl.kindFilter` (default = ns) drops
  // `media_job` events of other kinds sharing the stream.
  function mediaGenerateAwaitImpl(rt, ns, args, opts = {}, impl = {}) {
    const onProgress =
      typeof opts.onProgress === "function" ? opts.onProgress : null;
    const signal = opts.signal || null;
    const createMethod = impl.createMethod || "generate";
    const kindFilter = impl.kindFilter || ns;
    const label = `${ns}.${impl.awaitName || "generateAwait"}`;

    return new Promise((resolve, reject) => {
      let settled = false;
      let jobId = null;
      let lastSeq = 0;
      let eventSeen = false;
      let pollTimer = null;
      let wallTimer = null;
      let pollInFlight = false;
      let offEvent = null;
      let onAbort = null;

      const cleanup = () => {
        if (pollTimer) clearTimeout(pollTimer);
        if (wallTimer) clearTimeout(wallTimer);
        if (offEvent) offEvent();
        if (signal && onAbort) signal.removeEventListener("abort", onAbort);
      };
      const settleOk = (v) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(v);
      };
      const settleErr = (e) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (jobId && e && typeof e === "object" && !e.jobId) e.jobId = jobId;
        reject(e);
      };

      const deliverProgress = (seq, progress, state) => {
        if (typeof seq !== "number" || seq <= lastSeq) return;
        lastSeq = seq;
        if (onProgress) {
          try {
            onProgress({ seq, state: state || null, ...(progress || {}) });
          } catch (_) {}
        }
      };

      const schedulePoll = (delayMs) => {
        if (settled) return;
        if (pollTimer) clearTimeout(pollTimer);
        const delay = Number.isFinite(delayMs)
          ? delayMs
          : eventSeen
            ? JOB_POLL_WITH_EVENTS_MS
            : JOB_POLL_NO_EVENTS_MS;
        pollTimer = setTimeout(poll, delay);
      };

      const poll = async () => {
        if (settled || pollInFlight || !jobId) return;
        pollInFlight = true;
        try {
          const view = await rt.call(ns, "getJob", { jobId });
          if (view.progress) {
            deliverProgress(view.progress.seq, view.progress, view.state);
          }
          if (JOB_TERMINAL_STATES.has(view.state)) {
            if (view.state === "succeeded") settleOk(view);
            else settleErr(mediaJobErrorFromView(view, ns));
            return;
          }
        } catch (e) {
          if (
            e &&
            (e.code === "VIDEO_JOB_NOT_FOUND" ||
              e.code === "MUSIC_JOB_NOT_FOUND" ||
              e.code === "IMAGE_JOB_NOT_FOUND" ||
              e.code === "job_not_found")
          ) {
            settleErr(e);
            return;
          }
          // transient RPC errors: wait for the next cycle
        } finally {
          pollInFlight = false;
        }
        schedulePoll();
      };

      const onJobEvent = (payload) => {
        if (settled || !payload || payload.jobId !== jobId) return;
        if (payload.kind && payload.kind !== kindFilter) return;
        eventSeen = true;
        deliverProgress(payload.seq, payload.progress, payload.state);
        // Terminal push → fetch the authoritative view immediately (the
        // forwarded event never carries the result / re-signed URL).
        schedulePoll(payload.terminal ? 0 : JOB_POLL_WITH_EVENTS_MS);
      };

      const start = async () => {
        if (signal && signal.aborted) {
          const err = new Error(`${label} aborted before start`);
          err.code = "cancelled";
          settleErr(err);
          return;
        }
        let created;
        try {
          created = await rt.call(ns, createMethod, args || {});
        } catch (e) {
          settleErr(e);
          return;
        }
        jobId = created.jobId;
        // Idempotent replay of an already-terminal job: nothing to wait for.
        if (created.idempotentReplay && JOB_TERMINAL_STATES.has(created.state)) {
          if (created.state === "succeeded") settleOk(created);
          else settleErr(mediaJobErrorFromView(created, ns));
          return;
        }
        const deadlineMs = created.deadlineAt
          ? Date.parse(created.deadlineAt)
          : NaN;
        const wallMs = Number.isFinite(opts.timeoutMs)
          ? opts.timeoutMs
          : Number.isFinite(deadlineMs)
            ? Math.max(0, deadlineMs - Date.now()) + 30000
            : 35 * 60 * 1000;
        wallTimer = setTimeout(() => {
          const err = new Error(
            `${label} wall clock elapsed after ${wallMs}ms; ` +
              `job ${jobId} may still be rendering — recover it with ` +
              `anna.${ns}.getJob({jobId})`
          );
          err.code = "wait_timeout";
          settleErr(err);
        }, wallMs);
        offEvent = rt.on("media_job", onJobEvent);
        if (signal) {
          onAbort = () => {
            // queued cancel = full refund; running cancel is best-effort
            // (provider may refuse — the job then runs to terminal).
            rt.call(ns, "cancelJob", { jobId }).catch(() => {});
            schedulePoll(0);
          };
          signal.addEventListener("abort", onAbort, { once: true });
        }
        schedulePoll(JOB_POLL_NO_EVENTS_MS);
      };

      start();
    });
  }

  function buildMediaJobNamespace(rt, ns) {
    return new Proxy(
      {},
      {
        get(_, method) {
          if (typeof method !== "string") return undefined;
          if (method === "onJobEvent") {
            // Raw `media_job` host events ({jobId, state, seq, progress,
            // error, terminal}) — shared stream; filter by `jobId` prefix
            // (`vjob_` / `mjob_`) or `kind` when both namespaces are used.
            return (fn) => rt.on("media_job", fn);
          }
          if (method === "generateAwait") {
            return (args, opts) => mediaGenerateAwaitImpl(rt, ns, args, opts || {});
          }
          return (args, opts) => rt.call(ns, method, args || {}, opts);
        },
      }
    );
  }

  function buildVideoNamespace(rt) {
    return buildMediaJobNamespace(rt, "video");
  }

  // v0.23.0 — anna.music.* (platform-media-generation-music.md §12.1)
  function buildMusicNamespace(rt) {
    return buildMediaJobNamespace(rt, "music");
  }

  // v0.25.0 — anna.image.* (platform-media-generation-image-jobs.md §12.1):
  // the plain `image` proxy (sync generate / edit / resign + job four-pack)
  // wrapped with `generateAwait` / `editAwait` (submit via generateAsync /
  // editAsync, then the shared await loop filtered to kind "image") and
  // `onJobEvent` (raw `media_job` stream, image events only).
  function buildImageNamespace(rt) {
    const base = buildNamespace(rt, "image");
    return new Proxy(base, {
      get(target, method) {
        if (typeof method !== "string") return undefined;
        if (method === "onJobEvent") {
          return (fn) =>
            rt.on("media_job", (payload) => {
              if (!payload) return;
              const isImage =
                payload.kind === "image" ||
                (!payload.kind &&
                  typeof payload.jobId === "string" &&
                  payload.jobId.startsWith("ijob_"));
              if (isImage) fn(payload);
            });
        }
        if (method === "generateAwait") {
          return (args, opts) =>
            mediaGenerateAwaitImpl(rt, "image", args, opts || {}, {
              createMethod: "generateAsync",
              kindFilter: "image",
              awaitName: "generateAwait",
            });
        }
        if (method === "editAwait") {
          return (args, opts) =>
            mediaGenerateAwaitImpl(rt, "image", args, opts || {}, {
              createMethod: "editAsync",
              kindFilter: "image",
              awaitName: "editAwait",
            });
        }
        return target[method];
      },
    });
  }

  // ---- Agent namespace (v0.2.0) ----
  //
  // Exposes both raw RPCs (`anna.agent.session.create({submode, ...})`,
  // `anna.agent.session.run({...})`, etc.) AND a higher-level helper
  // `anna.agent.session(opts)` that returns an AgentSession instance
  // for ergonomic use in apps:
  //
  //     const sess = await anna.agent.session({ submode: "auto" });
  //     for await (const ev of sess.run({ content: "hi" })) {
  //       if (ev.event === "model_token") render(ev.text);
  //     }
  //
  // `sess.run(opts)` wire args (all optional except `content`):
  //   `{content, run_id?, recursion_limit?, systemPrompt?, allowed_tools?,
  //     modelPreferences?, attachments?, maxTokens?}` — `maxTokens`
  //   (v0.26.0 / dispatcher 0.30.0) caps every model call in the run; the
  //   host discloses the effective value in `run_meta.max_output_tokens`
  //   and flags a cut-off final message via `task_complete.truncated`.
// ==== BEGIN anna-voice-client-core ====
var AnnaVoiceClientCore = (function () {
  "use strict";

  const VERSION = "1.0.0";
  const DEFAULT_MIC_SAMPLE_RATE = 16000;
  const DEFAULT_FRAME_SIZE = 4096; // samples → 256 ms @ 16 kHz, 8 KB PCM16
  const MAX_CHUNK_BYTES = 32 * 1024; // server-side single audio_data cap

  // ───────────────────────── PCM / base64 helpers ─────────────────────────

  /** Float32 [-1,1] → Int16 LE (clamped). */
  function float32ToPcm16(float32) {
    const out = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  /** Uint8Array → base64 (chunked String.fromCharCode to avoid arg limits). */
  function bytesToBase64(bytes) {
    let binary = "";
    const STEP = 0x8000;
    for (let i = 0; i < bytes.length; i += STEP) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + STEP));
    }
    return btoa(binary);
  }

  /** Int16Array | ArrayBuffer | Uint8Array → base64 of the raw little-endian bytes. */
  function pcm16ToBase64(pcm) {
    const bytes =
      pcm instanceof Uint8Array
        ? pcm
        : pcm instanceof ArrayBuffer
          ? new Uint8Array(pcm)
          : new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    return bytesToBase64(bytes);
  }

  /** base64 → Uint8Array. */
  function base64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  /**
   * Split PCM16 into ≤ `maxBytes` slices (even byte boundary) and base64 each.
   * Returns `string[]`; an empty input yields `[]`.
   */
  function chunkPcm16(pcm, maxBytes = MAX_CHUNK_BYTES) {
    const bytes =
      pcm instanceof Uint8Array
        ? pcm
        : pcm instanceof ArrayBuffer
          ? new Uint8Array(pcm)
          : new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength);
    const step = Math.max(2, maxBytes - (maxBytes % 2));
    const out = [];
    for (let i = 0; i < bytes.length; i += step) {
      out.push(bytesToBase64(bytes.subarray(i, Math.min(i + step, bytes.length))));
    }
    return out;
  }

  // ───────────────────────── MicCapture ─────────────────────────

  // AudioWorkletProcessor source. Accumulates 128-frame render quanta into
  // `frameSize` samples and posts one Float32Array per frame.
  const WORKLET_SOURCE = `
    class AnnaPcmCaptureProcessor extends AudioWorkletProcessor {
      constructor(options) {
        super();
        const fs = (options && options.processorOptions && options.processorOptions.frameSize) || 4096;
        this._fs = fs;
        this._buf = new Float32Array(fs);
        this._pos = 0;
      }
      process(inputs) {
        const ch = inputs[0] && inputs[0][0];
        if (!ch) return true;
        let i = 0;
        while (i < ch.length) {
          const n = Math.min(ch.length - i, this._buf.length - this._pos);
          this._buf.set(ch.subarray(i, i + n), this._pos);
          this._pos += n; i += n;
          if (this._pos === this._buf.length) {
            const out = this._buf;
            this.port.postMessage(out, [out.buffer]);
            // out is detached after the transfer (length 0) — never size the
            // next buffer from it, or process() spins forever on a 0-length buf.
            this._buf = new Float32Array(this._fs);
            this._pos = 0;
          }
        }
        return true;
      }
    }
    registerProcessor("anna-pcm-capture", AnnaPcmCaptureProcessor);
  `;

  /**
   * Microphone → PCM16 frames.
   *
   *   const mic = new MicCapture({ onChunk(pcm16, float32) { ... } });
   *   await mic.start();          // prompts for permission
   *   mic.setMuted(true);         // keeps the stream, stops emitting
   *   mic.analyser                // AnalyserNode (fftSize 256) for visualizers
   *   mic.stop();                 // releases tracks + closes the AudioContext
   *
   * `onChunk(pcm16: Int16Array, float32: Float32Array)` fires once per
   * `frameSize` samples at `sampleRate`. `onLevel(rms)` is optional cheap VAD
   * input (RMS of the frame). Errors from the browser surface via `onError`
   * and the rejected `start()` promise.
   */
  class MicCapture {
    constructor(opts = {}) {
      this.sampleRate = opts.sampleRate || DEFAULT_MIC_SAMPLE_RATE;
      this.frameSize = opts.frameSize || DEFAULT_FRAME_SIZE;
      this.onChunk = opts.onChunk || null;
      this.onLevel = opts.onLevel || null;
      this.onError = opts.onError || null;
      this.preferWorklet = opts.preferWorklet !== false;
      this.constraints = opts.constraints || {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };
      this.stream = null;
      this.ctx = null;
      this.analyser = null;
      this.muted = false;
      this.active = false;
      this.mode = null; // "worklet" | "script"
      this._source = null;
      this._node = null;
      this._workletUrl = null;
    }

    async start() {
      if (this.active) return this;
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // `navigator.mediaDevices` is [SecureContext]-only: on http://<lan-ip>
        // (RN dev builds, LAN testing) it is simply undefined. Say so, instead
        // of a generic "not available" that reads like a missing device.
        const insecure = typeof window !== "undefined" && window.isSecureContext === false;
        throw new Error(
          insecure
            ? "getUserMedia unavailable: insecure context (page must be served over https or from localhost)"
            : "getUserMedia not available"
        );
      }
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: Object.assign({ sampleRate: this.sampleRate }, this.constraints),
      });
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new Ctx({ sampleRate: this.sampleRate });
        if (this.ctx.state === "suspended") {
          try { await this.ctx.resume(); } catch (_) {}
        }
        this._source = this.ctx.createMediaStreamSource(this.stream);
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.7;
        this._source.connect(this.analyser);

        let ok = false;
        if (this.preferWorklet && this.ctx.audioWorklet && typeof Blob !== "undefined") {
          ok = await this._startWorklet();
        }
        if (!ok) this._startScriptProcessor();
      } catch (e) {
        // Never leave the mic indicator on after a failed start.
        this.stop();
        throw e;
      }
      this.active = true;
      return this;
    }

    async _startWorklet() {
      try {
        this._workletUrl = URL.createObjectURL(
          new Blob([WORKLET_SOURCE], { type: "application/javascript" })
        );
        await this.ctx.audioWorklet.addModule(this._workletUrl);
        const node = new AudioWorkletNode(this.ctx, "anna-pcm-capture", {
          numberOfInputs: 1,
          numberOfOutputs: 0,
          channelCount: 1,
          processorOptions: { frameSize: this.frameSize },
        });
        node.port.onmessage = (ev) => this._emit(ev.data);
        this._source.connect(node);
        this._node = node;
        this.mode = "worklet";
        return true;
      } catch (e) {
        // CSP without blob: workers, old WebViews, … → ScriptProcessor.
        if (this._workletUrl) { try { URL.revokeObjectURL(this._workletUrl); } catch (_) {} }
        this._workletUrl = null;
        return false;
      }
    }

    _startScriptProcessor() {
      const node = this.ctx.createScriptProcessor(this.frameSize, 1, 1);
      node.onaudioprocess = (e) => {
        // Copy: the input buffer is reused by the engine.
        this._emit(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      this._source.connect(node);
      node.connect(this.ctx.destination); // required for onaudioprocess to fire
      this._node = node;
      this.mode = "script";
    }

    _emit(float32) {
      if (!this.active || this.muted) return;
      if (this.onLevel) {
        let sumSq = 0;
        for (let i = 0; i < float32.length; i++) sumSq += float32[i] * float32[i];
        try { this.onLevel(Math.sqrt(sumSq / (float32.length || 1)), float32); } catch (e) { this._err(e); }
      }
      if (this.onChunk) {
        try { this.onChunk(float32ToPcm16(float32), float32); } catch (e) { this._err(e); }
      }
    }

    _err(e) {
      if (this.onError) { try { this.onError(e); } catch (_) {} }
      else console.warn("[anna-voice-core] MicCapture handler error", e);
    }

    /** Mute keeps the track live (fast unmute) but stops emitting frames. */
    setMuted(muted) {
      this.muted = !!muted;
      if (this.stream) this.stream.getAudioTracks().forEach((t) => { t.enabled = !this.muted; });
    }

    stop() {
      this.active = false;
      if (this._node) {
        try { this._node.disconnect(); } catch (_) {}
        if (this._node.port) this._node.port.onmessage = null;
        this._node = null;
      }
      if (this._source) { try { this._source.disconnect(); } catch (_) {} this._source = null; }
      if (this.stream) { this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; }
      if (this.ctx) { this.ctx.close().catch(() => {}); this.ctx = null; }
      if (this._workletUrl) { try { URL.revokeObjectURL(this._workletUrl); } catch (_) {} this._workletUrl = null; }
      this.analyser = null;
      this.muted = false;
    }
  }

  // ───────────────────────── VoiceAudioPlayer ─────────────────────────

  /**
   * Gapless audio player for streamed TTS. Sample-accurate
   * AudioBufferSourceNode scheduling eliminates gaps between chunks.
   * Supports PCM (Int16 LE) and MP3 with a small jitter buffer.
   *
   *   const player = new VoiceAudioPlayer({ sampleRate: 24000 });
   *   player.onPlaybackEnd = () => ...;
   *   player.enqueue(base64Chunk);  // per tts_audio
   *   player.flush();               // on tts_done
   *   player.stop();                // on interrupted / barge-in
   */
  class VoiceAudioPlayer {
    constructor(opts = {}) {
      this.ctx = null;
      this.nextPlayTime = 0;
      this.pendingChunks = []; // jitter buffer
      this.started = false;
      this.playing = false;
      this.activeSources = []; // scheduled sources (for stop)
      this.onPlaybackEnd = opts.onPlaybackEnd || null;
      this.format = opts.format || "pcm";
      this.sampleRate = opts.sampleRate || 24000;
      this.channels = opts.channels || 1;
      this.JITTER_CHUNKS = opts.jitterChunks || 3;
    }

    /** Apply `session_started.audio_config` ({format, sample_rate, channels}). */
    configure(config) {
      if (!config) return;
      if (config.format) this.format = config.format;
      if (config.sample_rate) this.sampleRate = config.sample_rate;
      if (config.sampleRate) this.sampleRate = config.sampleRate;
      if (config.channels) this.channels = config.channels;
    }

    _ensureContext() {
      if (!this.ctx || this.ctx.state === "closed") {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
    }

    _decodePCM(base64Data) {
      const bytes = base64ToBytes(base64Data);
      const int16 = new Int16Array(bytes.buffer, 0, bytes.byteLength >> 1);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;
      return float32;
    }

    _onSourceEnded(source) {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) this.activeSources.splice(idx, 1);
      if (this.activeSources.length === 0 && this.pendingChunks.length === 0) {
        this.playing = false;
        if (this.onPlaybackEnd) this.onPlaybackEnd();
      }
    }

    _scheduleBuffer(buffer) {
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.ctx.destination);
      const startTime = Math.max(this.nextPlayTime, this.ctx.currentTime);
      source.start(startTime);
      this.nextPlayTime = startTime + buffer.duration;
      this.activeSources.push(source);
      source.onended = () => this._onSourceEnded(source);
    }

    _scheduleFloat32(float32Data) {
      this._ensureContext();
      const buffer = this.ctx.createBuffer(this.channels, float32Data.length, this.sampleRate);
      buffer.copyToChannel(float32Data, 0);
      this._scheduleBuffer(buffer);
    }

    _scheduleMP3(base64Data) {
      this._ensureContext();
      const bytes = base64ToBytes(base64Data);
      this.ctx
        .decodeAudioData(bytes.buffer.slice(0))
        .then((audioBuffer) => this._scheduleBuffer(audioBuffer))
        .catch((err) => console.warn("VoiceAudioPlayer: MP3 decode error, skipping chunk", err));
    }

    _flushPending() {
      this.started = true;
      this.playing = true;
      this._ensureContext();
      this.nextPlayTime = this.ctx.currentTime + 0.05; // jitter headroom
      const chunks = this.pendingChunks.splice(0);
      for (const chunk of chunks) this._scheduleChunk(chunk);
    }

    _scheduleChunk(base64Audio) {
      if (this.format === "pcm") this._scheduleFloat32(this._decodePCM(base64Audio));
      else this._scheduleMP3(base64Audio);
    }

    /** Enqueue a base64 audio chunk (jitter-buffered until JITTER_CHUNKS). */
    enqueue(base64Audio) {
      if (!base64Audio) return;
      if (!this.started) {
        this.pendingChunks.push(base64Audio);
        if (this.pendingChunks.length >= this.JITTER_CHUNKS) this._flushPending();
      } else {
        this.playing = true;
        this._scheduleChunk(base64Audio);
      }
    }

    /** Flush the jitter buffer (call when the TTS stream ends). */
    flush() {
      if (this.pendingChunks.length > 0) this._flushPending();
    }

    /** Stop everything immediately (barge-in / interrupt). */
    stop() {
      for (const source of this.activeSources) {
        try { source.onended = null; source.stop(); } catch (_) {}
      }
      this.activeSources = [];
      this.pendingChunks = [];
      this.started = false;
      this.playing = false;
      this.nextPlayTime = 0;
    }

    /** Full cleanup (closes the AudioContext). */
    destroy() {
      this.stop();
      if (this.ctx) { this.ctx.close().catch(() => {}); this.ctx = null; }
    }

    get isPlaying() {
      return this.playing;
    }
  }

  return {
    VERSION,
    DEFAULT_MIC_SAMPLE_RATE,
    DEFAULT_FRAME_SIZE,
    MAX_CHUNK_BYTES,
    float32ToPcm16,
    bytesToBase64,
    pcm16ToBase64,
    base64ToBytes,
    chunkPcm16,
    MicCapture,
    VoiceAudioPlayer,
  };
})();
// ==== END anna-voice-client-core ====

  // ───────────────────────── audio namespace (v0.21.0) ─────────────────────────

  const VOICE_SESSION_EVENTS = new Set([
    "asr_partial", "asr_final", "llm_start", "llm_partial", "llm_done",
    "tts_audio", "tts_done", "interrupted", "say_start", "say_done",
    "context_updated", "quota_warning", "error", "session_ended",
    "asr_paused", "asr_resumed",
  ]);
  const VOICE_MAX_CONTEXT_CHARS = 4 * 1024;
  const VOICE_MAX_SAY_CHARS = 1000;

  /**
   * App realtime voice session handle (design §5.2). Obtained via
   * `await anna.audio.session({...})`; the host bridge owns the WebSocket.
   *
   *   const vs = await anna.audio.session({ llm: "agent", context: "..." });
   *   vs.on("asr_final", ({text}) => ...);
   *   vs.on("tts_audio", ({audio}) => player.enqueue(audio));
   *   vs.on("tts_done", () => player.flush());
   *   vs.on("interrupted", () => player.stop());
   *   mic.onChunk = (pcm16) => vs.sendAudio(pcm16);   // push-to-talk: only while pressed!
   *   vs.setContext("hp=30% gold=1200");               // replaces; next turn
   *   await vs.say("小心上路", { priority: "high" });   // TTS-only, preempts
   *   await vs.end();
   *
   * ASR is billed per second of audio you send — gate `sendAudio` behind
   * push-to-talk / a wake word instead of streaming continuously.
   */
  class VoiceSession {
    constructor(rt, info) {
      this._rt = rt;
      this.sessionId = info.sessionId || null;
      this.audioConfig = info.audio_config || null;
      this.models = info.models || null;
      this.maxDurationSec = info.max_duration_sec ?? null;
      // Host pauses the ASR connection after this many idle seconds (no
      // sendAudio); the next frame reconnects transparently (`asr_paused` /
      // `asr_resumed` events). Expect the first word after a long pause to be
      // ~0.3–0.6 s slower. null on hosts without idle management.
      this.asrIdleTimeoutSec = info.asr_idle_timeout_sec ?? null;
      this.ended = false;
      this.usage = null;
      this._handlers = new Map();
      this._endResolvers = [];
    }

    on(event, fn) {
      let set = this._handlers.get(event);
      if (!set) { set = new Set(); this._handlers.set(event, set); }
      set.add(fn);
      return () => set.delete(fn);
    }

    off(event, fn) {
      const set = this._handlers.get(event);
      if (set) set.delete(fn);
    }

    _emit(event, payload) {
      const set = this._handlers.get(event);
      if (set) for (const fn of set) try { fn(payload); } catch (e) { console.warn("[anna-sdk] voice handler threw", e); }
      const all = this._handlers.get("*");
      if (all) for (const fn of all) try { fn(event, payload); } catch (_) {}
    }

    /** Bridge → SDK dispatch (payload = raw server event + sessionId). */
    _dispatch(payload) {
      if (this.ended) return;
      const type = payload.type;
      if (type === "session_ended") {
        this.ended = true;
        this.usage = {
          duration: payload.duration ?? null,
          total_asr_seconds: payload.total_asr_seconds ?? null,
          total_tts_characters: payload.total_tts_characters ?? null,
          reason: payload.reason || null,
        };
        this._emit("ended", Object.assign({ sessionId: this.sessionId }, this.usage));
        for (const r of this._endResolvers.splice(0)) r(this.usage);
        this._rt._voiceSessions.delete(this.sessionId || "__single__");
        return;
      }
      if (!VOICE_SESSION_EVENTS.has(type)) return; // forward-compat: ignore unknown
      this._emit(type, payload);
    }

    /**
     * Send 16 kHz mono PCM16 (`Int16Array` | `ArrayBuffer` | `Uint8Array`).
     * Auto-chunked to ≤ 32 KB; fire-and-forget (no per-chunk round trip).
     * Returns the number of chunks posted.
     */
    sendAudio(pcm16) {
      if (this.ended || !pcm16) return 0;
      const chunks = AnnaVoiceClientCore.chunkPcm16(pcm16);
      for (const b64 of chunks) {
        this._rt._post({
          kind: "req",
          id: uuid(),
          ns: "audio",
          method: "session.send",
          args: { sessionId: this.sessionId, audio_b64: b64 },
        });
      }
      return chunks.length;
    }

    /**
     * Signal end of the current utterance (push-to-talk released). Streaming
     * ASR only finalizes a sentence after enough trailing *silence frames*;
     * once you stop calling `sendAudio` the pending sentence would never
     * finalize — `flushAudio()` asks the host to finalize it now
     * (`asr_final` follows, then `asr_paused{reason:"flushed"}`; the next
     * `sendAudio` reconnects transparently). Fire-and-forget.
     */
    flushAudio() {
      if (this.ended) return;
      this._rt._post({ kind: "req", id: uuid(), ns: "audio", method: "session.flush", args: { sessionId: this.sessionId } });
    }

    /** Replace the live context (≤ 4 KB); takes effect from the next utterance. */
    setContext(text) {
      const t = text == null ? "" : String(text);
      if (t.length > VOICE_MAX_CONTEXT_CHARS) {
        return Promise.reject(Object.assign(new Error(`context exceeds ${VOICE_MAX_CONTEXT_CHARS} chars`), { code: "context_too_large" }));
      }
      return this._rt.call("audio", "session.context", { sessionId: this.sessionId, text: t });
    }

    /**
     * Speak `text` through the session's streaming TTS without the LLM.
     * `priority:"high"` or `interrupt:true` preempts the current reply;
     * `"normal"` queues in the server's single pending slot (newer replaces
     * older — `say_done{status:"replaced"}`). Resolves `{sayId}` once queued;
     * listen to `say_start` / `say_done` for playback lifecycle.
     */
    say(text, opts = {}) {
      const t = text == null ? "" : String(text);
      if (!t.trim()) return Promise.reject(Object.assign(new Error("say: text required"), { code: "invalid_request" }));
      if (t.length > VOICE_MAX_SAY_CHARS) {
        return Promise.reject(Object.assign(new Error(`say exceeds ${VOICE_MAX_SAY_CHARS} chars`), { code: "say_too_long" }));
      }
      return this._rt
        .call("audio", "session.say", {
          sessionId: this.sessionId,
          text: t,
          priority: opts.priority || "normal",
          interrupt: !!opts.interrupt,
          say_id: opts.sayId || opts.say_id || undefined,
        })
        .then((r) => ({ sayId: r && r.sayId }));
    }

    /** Stop the current LLM reply + TTS playback server-side. */
    interrupt() {
      return this._rt.call("audio", "session.interrupt", { sessionId: this.sessionId });
    }

    /** End the session; resolves with the usage summary (`session_ended`). */
    end() {
      if (this.ended) return Promise.resolve(this.usage);
      if (this._ending) return this._ending; // concurrent end() share one close
      this._ending = (async () => {
        const done = new Promise((resolve) => this._endResolvers.push(resolve));
        const res = await this._rt.call("audio", "session.close", { sessionId: this.sessionId }, { timeoutMs: 10000 });
        if (!this.ended) {
          // Bridge timed out waiting for session_ended — synthesize from the close reply.
          this._dispatch(Object.assign({ type: "session_ended", reason: "closed" }, res || {}));
        }
        return done;
      })();
      return this._ending;
    }
  }

  function buildAudioNamespace(rt) {
    const ns = buildNamespace(rt, "audio"); // speak / transcribe (v0.20.0)
    return {
      speak: ns.speak,
      transcribe: ns.transcribe,
      /** Open a realtime voice session (see VoiceSession). */
      session: async (config = {}) => {
        const result = await rt.call("audio", "session.open", { config: config || {} }, { timeoutMs: 20000 });
        const vs = new VoiceSession(rt, result || {});
        rt._voiceSessions.set(vs.sessionId || "__single__", vs);
        return vs;
      },
      /** Microphone → PCM16 frames (`MicCapture`, see anna-voice-client-core). */
      mic: (opts = {}) => new AnnaVoiceClientCore.MicCapture(opts),
      /** Gapless streamed-TTS player (`VoiceAudioPlayer`). */
      player: (opts = {}) => new AnnaVoiceClientCore.VoiceAudioPlayer(opts),
      /** Low-level helpers (chunking / base64 / PCM conversion). */
      core: AnnaVoiceClientCore,
    };
  }

  function buildAgentNamespace(rt) {
    const sessionRpcs = new Proxy(
      {},
      {
        get(_, method) {
          if (typeof method !== "string") return undefined;
          return (args, opts) =>
            rt.call("agent", "session." + method, args || {}, opts);
        },
      }
    );
    const ns = {
      // Higher-level: mint and return an AgentSession wrapper.
      session: async (opts = {}) => {
        const result = await rt.call("agent", "session.create", opts);
        return new AgentSession(rt, result);
      },
    };
    // Also expose raw RPC sub-methods on the function — apps can do
    // `anna.agent.session.create(...)` if they want to manage state manually.
    // `list` is account/app-scoped (enumerate this app's sessions), so it
    // lives only here, not on the per-session AgentSession wrapper. `refresh`
    // is identity-authed (re-mints token + slides idle window by uuid) and is
    // also exposed as `.refresh()` sugar on the AgentSession handle.
    // `catalog` is the pre-create discovery surface (platform-tool universe
    // + per-app eligibility) — read-only, no session required.
    for (const m of ["create", "run", "cancel", "history", "delete", "list", "refresh", "catalog", "frames"]) {
      ns.session[m] = sessionRpcs[m];
    }
    // Wire method `session.run.status` contains a dot — expose it as the
    // camelCase `runStatus` (the proxy would map `runStatus` →
    // `session.runStatus`, which is not a wire method).
    ns.session.runStatus = (args, opts) =>
      rt.call("agent", "session.run.status", args || {}, opts);
    // `attach` re-wraps an EXISTING session (known uuid) as an AgentSession
    // handle WITHOUT minting a new one — pure client-side, no RPC. Accepts a
    // bare uuid string or an info object (e.g. a row from `list()`).
    ns.session.attach = (info) => {
      const norm =
        typeof info === "string" ? { app_session_uuid: info } : info || {};
      if (!norm.app_session_uuid) {
        throw new Error("agent.session.attach: app_session_uuid is required");
      }
      return new AgentSession(rt, norm);
    };
    return ns;
  }

  // ---- LLM namespace (L1) ----
  //
  // `anna.llm.complete(req)` / `anna.llm.embed(req)` are plain RPCs that
  // resolve to a single result. `anna.llm.stream(req)` mirrors
  // `AgentSession.run`: it returns an AgentRunStream (async-iterable) and the
  // host streams `{event:"model_token", text}` frames followed by a terminal
  // `{event:"complete", ...}` frame over the shared `rpc.stream` topic.
  //
  //     for await (const ev of anna.llm.stream({ messages, maxTokens })) {
  //       if (ev.event === "model_token") render(ev.text);
  //       else if (ev.event === "complete") done(ev.content.text);
  //     }
  //
  // `stream(req)` takes the SAME request shape as `complete(req)`
  // (`{messages, maxTokens?, temperature?, systemPrompt?, stopSequences?,
  // modelPreferences?, metadata?}`).
  //
  // v0.17.0: `complete(req)` with `maxTokens > SYNC_OUTPUT_CEILING` is
  // transparently delivered over `llm.stream` (the held-HTTP sync channel
  // is edge-capped at 8192 output tokens server-side) and reshaped back to
  // the single-result `complete` contract. See header changelog.
  //
  // ⚠ Locked to nexus src/core/constants.py AppLlmLimits.SYNC_OUTPUT_CEILING
  // (app-llm-output-cap-unification §2.2) — change both together.
  const LLM_SYNC_OUTPUT_CEILING = 8192;

  function startLlmStream(rt, req) {
    const stream = new AgentRunStream(null, (req && req.run_id) || null);
    rt.call("llm", "stream", req || {}).then(
      (res) => {
        stream.streamId = res.stream_id || stream.streamId;
        stream.runId = res.run_id || stream.runId;
        if (stream.streamId) rt._registerStream(stream.streamId, stream);
        // Host returned no stream_id (e.g. cached error) → close.
        if (!stream.streamId) stream._emit(null, true);
      },
      (err) => {
        stream._emit(
          { event: "error", code: err.code, message: err.message },
          true
        );
      }
    );
    return stream;
  }

  async function completeOverStream(rt, req) {
    let text = "";
    for await (const ev of startLlmStream(rt, req)) {
      if (!ev || typeof ev !== "object") continue;
      if (ev.event === "model_token") {
        if (ev.text) text += ev.text;
      } else if (ev.event === "complete") {
        const meta = ev._meta || {};
        // Slimmed terminal frame (>48KB): the accumulated token text is
        // authoritative; textLength (chars) is the integrity check.
        let finalText =
          (ev.content && typeof ev.content.text === "string" && ev.content.text) ||
          text;
        if (meta.textOmitted) {
          finalText = text;
          if (
            typeof meta.textLength === "number" &&
            meta.textLength !== text.length
          ) {
            const err = new Error(
              `llm.complete (over stream): accumulated ${text.length} chars ` +
                `but host reported ${meta.textLength} — dropped token frames`
            );
            err.code = "stream_incomplete";
            throw err;
          }
        }
        return {
          role: ev.role || "assistant",
          content: { type: "text", text: finalText },
          model: ev.model,
          stopReason: ev.stopReason,
          usage: ev.usage,
          _meta: meta,
        };
      } else if (ev.event === "error") {
        const err = new Error(ev.message || "llm.stream failed");
        if (ev.code != null) err.code = ev.code;
        throw err;
      }
      // status frames (queued/started/keepalive/end) are transport noise here
    }
    const err = new Error(
      "llm.complete (over stream): stream ended without a terminal complete frame"
    );
    err.code = "stream_closed";
    throw err;
  }

  function buildLlmNamespace(rt) {
    return new Proxy(
      {},
      {
        get(_, method) {
          if (typeof method !== "string") return undefined;
          if (method === "stream") {
            return (req = {}) => startLlmStream(rt, req);
          }
          if (method === "complete") {
            return (args, opts) => {
              const requested = Number(args && args.maxTokens);
              if (requested > LLM_SYNC_OUTPUT_CEILING) {
                return completeOverStream(rt, args || {});
              }
              return rt.call("llm", method, args || {}, opts);
            };
          }
          return (args, opts) => rt.call("llm", method, args || {}, opts);
        },
      }
    );
  }

  // ---- Apps namespace (v0.9.0) ----
  //
  // The Apps launcher surface lets an app browse/launch other installed
  // Anna Apps and manage the user's pinned "deck":
  //
  //     await anna.apps.list({ search })          // installed apps
  //     await anna.apps.search({ q })             // alias of list w/ search
  //     await anna.apps.get({ app_ref })          // single card
  //     await anna.apps.launch({ app_ref, view, payload })  // open a window
  //     await anna.apps.deck.list()               // pinned deck
  //     await anna.apps.deck.add({ app_ref })
  //     await anna.apps.deck.remove({ app_ref })
  //     await anna.apps.deck.reorder({ ordered })
  //
  // `app_ref` accepts either a numeric app id or an `@handle/slug` string.
  // The nested `deck.*` methods map to wire methods `apps/deck.<m>`.
  function buildAppsNamespace(rt) {
    const deck = new Proxy(
      {},
      {
        get(_, method) {
          if (typeof method !== "string") return undefined;
          return (args, opts) =>
            rt.call("apps", "deck." + method, args || {}, opts);
        },
      }
    );
    return new Proxy(
      {},
      {
        get(_, method) {
          if (typeof method !== "string") return undefined;
          if (method === "deck") return deck;
          return (args, opts) => rt.call("apps", method, args || {}, opts);
        },
      }
    );
  }

  // ---- HTTP-backed namespaces removed in v0.4.0 ----
  //
  // `anna.image.*` and `anna.upload.*` are now plain postMessage RPCs
  // (see the dispatcher's `image.*` / `upload.*` handlers in
  // anna-app-core 0.3.0+). The dispatcher mints the underlying
  // app_session_token in-process; the iframe never holds capability
  // credentials. Errors arrive on the standard RPC envelope with
  // `.code` set to the facade's `APP_ERR_*` value.

  // AsyncIterable view over `rpc.stream` event chunks. Reassembles by `seq`
  // so out-of-order arrivals are normalised; back-pressure is bounded only
  // by the iframe's heap (events are small JSON blobs).
  class AgentRunStream {
    constructor(streamId, runId) {
      this.streamId = streamId;
      this.runId = runId;
      this._queue = [];     // ordered by seq
      this._waiters = [];   // resolvers awaiting next event
      this._buffer = new Map(); // seq -> payload (out-of-order holding)
      this._nextSeq = 1;
      this._done = false;
      this._gotFrame = false;   // any frame received (cancels the fallback timer)
      this._pollTimer = null;   // first-frame fallback (forum #341 P3)
      this._polling = false;
      this._rt = null;
    }
    // First-frame fallback (v0.18.0): if no frame arrives within timeoutMs,
    // poll `agent.session.frames` until done. Layered with the host shells'
    // own gate-level fallback — seq dedup makes double delivery harmless.
    _armPollFallback(rt, timeoutMs) {
      if (this._pollTimer || this._polling || this._done || this._gotFrame) return;
      this._rt = rt;
      const deadline =
        typeof timeoutMs === "number" && timeoutMs > 0 ? timeoutMs : 20000;
      this._pollTimer = setTimeout(() => {
        this._pollTimer = null;
        if (!this._gotFrame && !this._done) this._pollLoop();
      }, deadline);
    }
    async _pollLoop() {
      if (this._polling || !this._rt || !this.streamId) return;
      this._polling = true;
      let interval = 3000;
      try {
        while (!this._done) {
          try {
            const res = await this._rt.call("agent", "session.frames", {
              stream_id: this.streamId,
              after_seq: this._nextSeq - 1,
              limit: 500,
            });
            const frames = (res && Array.isArray(res.frames) ? res.frames : [])
              .filter((f) => f && typeof f.seq === "number" && f.seq >= this._nextSeq)
              .sort((a, b) => a.seq - b.seq);
            for (const f of frames) {
              this._push({ seq: f.seq, payload: f.payload, done: !!f.done });
              if (this._done) return;
            }
            interval = frames.length ? 3000 : Math.min(interval * 2, 30000);
          } catch (e) {
            // Old host (`unknown_method`/`not_implemented`) → disarm; the
            // archive window aged out (`not_found`) → nothing to recover.
            const code = e && e.code;
            if (
              code === "unknown_method" ||
              code === "not_implemented" ||
              code === "not_found"
            ) {
              return;
            }
            interval = Math.min(interval * 2, 30000);
          }
          await new Promise((r) => setTimeout(r, interval));
        }
      } finally {
        this._polling = false;
      }
    }
    _push(frame) {
      this._gotFrame = true;
      if (this._pollTimer) {
        clearTimeout(this._pollTimer);
        this._pollTimer = null;
      }
      const seq = Number(frame.seq || 0);
      const payload = frame.payload;
      const done = !!frame.done;
      if (seq && seq !== this._nextSeq) {
        this._buffer.set(seq, { payload, done });
        return;
      }
      this._emit(payload, done);
      if (seq) this._nextSeq += 1;
      // Drain consecutive buffered frames.
      while (this._buffer.has(this._nextSeq)) {
        const next = this._buffer.get(this._nextSeq);
        this._buffer.delete(this._nextSeq);
        this._emit(next.payload, next.done);
        this._nextSeq += 1;
      }
    }
    _emit(payload, done) {
      if (payload != null) this._queue.push(payload);
      if (done) {
        this._done = true;
        if (this._pollTimer) {
          clearTimeout(this._pollTimer);
          this._pollTimer = null;
        }
      }
      while (this._waiters.length && (this._queue.length || this._done)) {
        const w = this._waiters.shift();
        if (this._queue.length) w({ value: this._queue.shift(), done: false });
        else w({ value: undefined, done: true });
      }
    }
    [Symbol.asyncIterator]() {
      const self = this;
      return {
        next() {
          if (self._queue.length) {
            return Promise.resolve({ value: self._queue.shift(), done: false });
          }
          if (self._done) return Promise.resolve({ value: undefined, done: true });
          return new Promise((resolve) => self._waiters.push(resolve));
        },
        return() {
          self._done = true;
          if (self._pollTimer) {
            clearTimeout(self._pollTimer);
            self._pollTimer = null;
          }
          while (self._waiters.length) self._waiters.shift()({ value: undefined, done: true });
          return Promise.resolve({ value: undefined, done: true });
        },
      };
    }
  }

  // Higher-level agent session wrapper. Holds the dispatcher-managed
  // app_session_uuid; its methods are sugar around the raw `agent.session.*`
  // RPCs.
  class AgentSession {
    constructor(rt, info) {
      this._rt = rt;
      this.app_session_uuid = info.app_session_uuid;
      this.expires_in = info.expires_in;
      this.submode = info.submode;
      this.fixed_client_id = info.fixed_client_id || null;
      this.granted_tools = info.granted_tools || [];
      // Lifecycle metadata (v0.8.0). `expires_at` is the authoritative idle
      // deadline; `max_lifetime_at` is the absolute cap; `idle_ttl_seconds` is
      // how far each activity slides the window; `session_expires_in` is the
      // seconds-until-`expires_at` snapshot at mint/refresh time. All are
      // refreshed in place by `.refresh()`.
      this._applyLifecycle(info);
    }
    // Copy lifecycle fields from a create/refresh response onto the handle.
    _applyLifecycle(info) {
      if (info == null) return;
      if ("expires_in" in info) this.expires_in = info.expires_in;
      this.expires_at = info.expires_at ?? this.expires_at ?? null;
      this.max_lifetime_at =
        info.max_lifetime_at ?? this.max_lifetime_at ?? null;
      this.idle_ttl_seconds =
        info.idle_ttl_seconds ?? this.idle_ttl_seconds ?? null;
      this.session_expires_in =
        info.session_expires_in ?? this.session_expires_in ?? null;
    }
    run(opts = {}) {
      // `firstFrameTimeoutMs` is SDK-local (first-frame fallback arm delay,
      // v0.18.0) — strip it from the wire args.
      const { firstFrameTimeoutMs, ...runOpts } = opts || {};
      const args = Object.assign(
        { app_session_uuid: this.app_session_uuid },
        runOpts
      );
      const stream = new AgentRunStream(null, args.run_id || null);
      // Kick off the RPC; once the host returns {stream_id, run_id} we
      // register the stream so subsequent rpc.stream events flow into it.
      this._rt.call("agent", "session.run", args).then(
        (res) => {
          stream.streamId = res.stream_id || stream.streamId;
          stream.runId = res.run_id || stream.runId;
          if (stream.streamId) this._rt._registerStream(stream.streamId, stream);
          // If host returns done immediately (e.g. cached error), close.
          if (!stream.streamId) stream._emit(null, true);
          // forum #341 P3: no first frame within the deadline → the stream
          // self-recovers by polling agent.session.frames until done.
          else stream._armPollFallback(this._rt, firstFrameTimeoutMs);
        },
        (err) => {
          stream._emit({ event: "error", code: err.code, message: err.message }, true);
        }
      );
      return stream;
    }
    cancel(runId) {
      return this._rt.call("agent", "session.cancel", {
        app_session_uuid: this.app_session_uuid,
        run_id: runId,
      });
    }
    // Point-in-time run status (v0.18.0, forum #341 P3). Check this BEFORE
    // re-running after a silent stream — `completed` means the run executed
    // and was charged; recover its output via `agent.session.frames`.
    runStatus(runId) {
      return this._rt.call("agent", "session.run.status", {
        app_session_uuid: this.app_session_uuid,
        run_id: runId,
      });
    }
    history(opts = {}) {
      return this._rt.call("agent", "session.history", Object.assign(
        { app_session_uuid: this.app_session_uuid }, opts
      ));
    }
    // Re-mint the capability token AND slide the idle window for this session.
    // Identity-authed — works even if the previous token already lapsed
    // (recovers from APP_SESSION_TOKEN_EXPIRED). Updates the handle's
    // lifecycle fields in place from the response and returns it.
    async refresh(opts = {}) {
      const res = await this._rt.call("agent", "session.refresh", Object.assign(
        { app_session_uuid: this.app_session_uuid }, opts
      ));
      this._applyLifecycle(res || {});
      return res;
    }
    delete() {
      return this._rt.call("agent", "session.delete", {
        app_session_uuid: this.app_session_uuid,
      });
    }
  }

  class AnnaAppRuntime {
    constructor(opts) {
      this.windowUuid = opts.windowUuid;
      this.token = opts.token;
      this.targetOrigin = opts.targetOrigin || "*"; // host enforces sandbox
      this.parent = opts.parent || window.parent;
      this._pending = new Map();   // id -> {resolve, reject, retries}
      this._handlers = new Map();  // event kind -> Set<fn>
      this._closed = false;
      this._handshake = null;
      this._heartbeatTimer = null;
      this.capabilities = null;
      this.viewMeta = null;
      this.entryPayload = null;
      this.app = null;
      this.runtimeState = null;
      this.geometry = null;
      // v0.24.0 host context mirrors (filled by connect() from the URL, then
      // kept fresh by `theme.changed` / `locale.changed` broadcasts).
      this.theme = null;      // 'light' | 'dark'
      this.themeMode = null;  // 'light' | 'dark' | 'system'
      this.locale = null;     // BCP-47-ish host tag, e.g. 'en' | 'zh-CN'

      // namespace proxies
      this.tools = buildToolsNamespace(this);
      this.chat = buildNamespace(this, "chat");
      this.artifact = buildNamespace(this, "artifact");
      this.llm = buildLlmNamespace(this);
      this.fs = buildNamespace(this, "fs");
      this.storage = buildNamespace(this, "storage");
      this.prefs = buildNamespace(this, "prefs");
      this.window = buildNamespace(this, "window");

      // ---- agent namespace (v0.2.0) ----
      // Exposes session.{create,run,cancel,history,delete}; SDK also offers
      // a higher-level `anna.agent.session(opts)` helper that returns an
      // AgentSession bound to a fresh AnnaAppSession.
      this.agent = buildAgentNamespace(this);

      // ---- image / upload namespaces (v0.4.0; postMessage) ----
      // anna.image.generate({prompt, n?, size?, aspect_ratio?, model?, params?,
      //   fit?: "nearest"|"strict", reference_image_urls?, metadata?})
      //   → {images:[{url,width,height,…}], model, requestedSize, size,
      //      sizeAdjusted, aspectRatio, fit, params, ignoredParams, usage}
      // anna.image.edit({image_url, prompt, n?, size?, aspect_ratio?, model?,
      //   params?, fit?, mask_url?, metadata?}) → same shape (v0.22.0 fields)
      // anna.upload.inline({filename, mime_type, content_b64, purpose?, metadata?})
      // anna.upload.negotiate({filename, mime_type, size_bytes, purpose?, metadata?})
      // anna.upload.confirm({r2_key})
      this.image = buildImageNamespace(this);
      this.upload = buildNamespace(this, "upload");

      // ---- video / audio namespaces (v0.20.0; media generation) ----
      // anna.video.generate({prompt, imageUrl?, durationSec?, resolution?,
      //   aspectRatio?, generateAudio?, model?, clientTag?}) → {jobId, ...}
      // anna.video.{getJob,cancelJob,listJobs}({jobId|filters})
      // anna.video.generateAwait(args, {onProgress, signal, timeoutMs})
      // anna.audio.speak({text, model?, voice?, params?, language?, format?,
      //   speed?, delivery?}) → {url|audioBase64, mimeType, charCount,
      //   billedCostCU, model, voice, params, ignoredParams}  (v0.22.0 fields)
      // anna.audio.transcribe({audioUrl|audioBase64, language?}) → {text, ...}
      // Capability discovery: anna.llm.catalog({serviceType?, voiceLanguage?})
      //   → {models:[{modelName, isUserPreferred, isPlatformDefault,
      //      capabilities:{options (schema v2), voices?, sizeInput?, edit?, …},
      //      pricing}], quota}.
      // Requires manifest ui.host_api.video / .audio + per-app media_grant.
      this.video = buildVideoNamespace(this);
      // v0.23.0: anna.music.{generate,getJob,cancelJob,listJobs,generateAwait}
      //   ({prompt, lyrics?, instrumental?, durationSec?, format?,
      //    referenceImageUrl?, options?, model?, clientTag?, idempotencyKey?})
      //   → {jobId:"mjob_…", kind:"music", state, estimatedCostCU, deadlineAt,
      //      idempotentReplay}; terminal result {url, mimeType, durationSec|null,
      //      lyrics|null, seed, expiresIn}. Requires ui.host_api.music +
      //      media_grant.music.
      this.music = buildMusicNamespace(this);
      // v0.21.0: + anna.audio.session(config) → VoiceSession (host-bridge
      //   relayed realtime ASR→LLM→TTS, barge-in, setContext/say),
      //   anna.audio.mic() / anna.audio.player() client helpers.
      this.audio = buildAudioNamespace(this);
      this._voiceSessions = new Map(); // sessionId -> VoiceSession

      // ---- credentials namespace (v0.11.0; multi-account) ----
      // anna.credentials.list_accounts({provider})  — metadata only, no tokens
      // anna.credentials.get_token({provider, account_id?}) — short-lived
      //   access_token for one account; account_id omitted → default account.
      // Requires manifest ui.host_api.credentials (provider ids) AND the
      // user-enabled per-app credentials_grant.
      this.credentials = buildNamespace(this, "credentials");

      // ---- mobile namespace (v0.16.0; anna-mobile native bridge) ----
      // anna.mobile.share({title?, text?, url?, filename?, data_url?})
      //   → {shared}  (user cancel = {shared:false}, not an error)
      // anna.mobile.haptics({type: "impact"|"notification"|"selection",
      //   style?}) → {ok}
      // anna.mobile.camera_capture({camera?, quality?, max_bytes?})
      //   → {data_url, mime, width, height, byte_size}
      // Requires manifest ui.host_api.mobile. Desktop containers reject
      // with code="unsupported_container" (vs "permission_denied" = grant
      // missing) — branch on it for a clean degradation notice.
      this.mobile = buildNamespace(this, "mobile");

      // ---- web namespace (v0.13.0; host-managed search/fetch) ----
      // anna.web.search({query, max_results?, search_depth?, topic?,
      //   time_range?, region?, include_domains?, exclude_domains?})
      //   → {results, provider_tier, quota_consumed, cached?}
      // anna.web.fetch({urls, format?, max_chars?, timeout_ms?})
      //   → {pages, quota_consumed}
      // Phase 2:
      // anna.web.image_search({query, max_results?, min_width?, min_height?,
      //   aspect?}) → {results: [{image_url, thumbnail_url?, source_url,
      //   title?, width?, height?, mime_type?, license_hint?}],
      //   quota_consumed, cached?}  (safe-search force-enabled host-side)
      // anna.web.image_fetch({url, max_bytes?, purpose?})
      //   → {path, get_url, mime_type, bytes_size, sha256, source_url,
      //      final_url, quota_consumed}  (artifact reference — never bytes;
      //      stored in the app's APS files self-scope)
      // camelCase aliases: anna.web.imageSearch / anna.web.imageFetch map to
      // the same wire methods (image_search / image_fetch).
      // Provider keys / routing / SSRF guard / billing all stay host-side.
      // Requires manifest ui.host_api.web AND the user-enabled per-app
      // web_grant (first call returns APP_NOT_GRANTED → consent card;
      // image_search / image_fetch default OFF even when web is enabled).
      // See matrix-nexus docs/design/app-web-search.md §2.
      this.web = buildWebNamespace(this);

      // ---- files namespace (APS object/blob API; v0.5.x) ----
      // anna.files.upload_init({path, content_type, size, ttl_seconds?, metadata?, tags?, if_match?})
      // anna.files.upload_finalize({path, etag, size_bytes, metadata?})
      // anna.files.download_url({path, ttl_seconds?, disposition?})
      // anna.files.list({prefix?, cursor?, limit?})
      // anna.files.delete({path, if_match?})
      this.files = buildNamespace(this, "files");

      // ---- apps namespace (launcher + deck; v0.9.0) ----
      // anna.apps.list({search?}) / search({q}) / get({app_ref}) /
      //   launch({app_ref, view?, payload?})
      // anna.apps.deck.list() / add({app_ref}) / remove({app_ref}) /
      //   reorder({ordered})
      this.apps = buildAppsNamespace(this);

      // Reassembly buffers for `rpc.stream` events. Map<stream_id, AgentRunStream>.
      this._streams = new Map();
      this.on("rpc.stream", (payload) => this._onStreamFrame(payload || {}));
      // Voice relay events from the host bridge: {sessionId, type, ...}
      this.on("audio.session", (payload) => this._onVoiceEvent(payload || {}));

      window.addEventListener("message", (ev) => this._onMessage(ev));
      window.addEventListener("error", (ev) => {
        // best-effort error reporting
        this._post({
          kind: "req",
          id: uuid(),
          ns: "window",
          method: "report_error",
          args: {
            error: { message: String(ev.message), source: ev.filename, line: ev.lineno },
          },
        });
      });
      // Final flush on unload (best-effort)
      window.addEventListener("pagehide", () => {
        this._closed = true;
      });
    }

    _post(envelope) {
      try {
        this.parent.postMessage(
          Object.assign({ wid: this.windowUuid, t: this.token }, envelope),
          this.targetOrigin
        );
      } catch (e) {
        console.error("[anna-sdk] postMessage failed", e);
      }
    }

    _onMessage(ev) {
      const msg = ev.data;
      if (!msg || typeof msg !== "object") return;
      if (msg.wid && msg.wid !== this.windowUuid) return;

      if (msg.kind === "res") {
        const pending = this._pending.get(msg.id);
        if (!pending) return;
        this._pending.delete(msg.id);
        if (msg.error) {
          const err = new Error(msg.error.message || "RPC error");
          err.code = msg.error.code;
          err.details = msg.error.details;
          pending.reject(err);
        } else {
          pending.resolve(msg.result);
        }
        return;
      }

      if (msg.kind === "event") {
        if (msg.event === "auth.refresh" && msg.token) {
          this.token = msg.token;
          return;
        }
        // forum #376: keep the runtime mirrors fresh before dispatching so
        // handlers (and later reads) observe the updated values.
        if (msg.event === "entry_payload") {
          this.entryPayload = msg.payload || {};
        } else if (msg.event === "theme.changed" && msg.payload) {
          // v0.24.0: cache first so late subscribers / plain reads see it.
          if (msg.payload.theme === "light" || msg.payload.theme === "dark") this.theme = msg.payload.theme;
          if (msg.payload.mode) this.themeMode = String(msg.payload.mode);
        } else if (msg.event === "locale.changed" && msg.payload) {
          if (msg.payload.lang) this.locale = String(msg.payload.lang);
        } else if (msg.event === "runtime_state_synced") {
          const patch = msg.payload && msg.payload.patch;
          if (patch) {
            this.runtimeState = Object.assign({}, this.runtimeState, patch);
          }
        }
        const set = this._handlers.get(msg.event);
        if (set) for (const fn of set) try { fn(msg.payload); } catch (_) {}
      }
    }

    on(kind, fn) {
      let set = this._handlers.get(kind);
      if (!set) { set = new Set(); this._handlers.set(kind, set); }
      set.add(fn);
      return () => set.delete(fn);
    }

    /**
     * v0.24.0 — subscribe to host theme changes. Replays the current value
     * immediately so callers never race the handshake. Returns unsubscribe.
     * @param {(t:{theme:'light'|'dark', mode:'light'|'dark'|'system'})=>void} fn
     */
    onThemeChange(fn) {
      const off = this.on("theme.changed", (p) => fn({ theme: this.theme, mode: this.themeMode, ...(p || {}) }));
      try { fn({ theme: this.theme, mode: this.themeMode }); } catch (_) {}
      return off;
    }

    /**
     * v0.24.0 — subscribe to host UI-language changes (`{lang}`), replaying
     * the current value immediately. Returns unsubscribe.
     * @param {(l:{lang:string})=>void} fn
     */
    onLocaleChange(fn) {
      const off = this.on("locale.changed", (p) => fn({ lang: this.locale, ...(p || {}) }));
      try { fn({ lang: this.locale }); } catch (_) {}
      return off;
    }

    call(ns, method, args, opts) {
      if (this._closed) return Promise.reject(new Error("runtime closed"));
      const timeoutMs =
        (opts && Number.isFinite(opts.timeoutMs) ? opts.timeoutMs : null) ??
        DEFAULT_TIMEOUTS_BY_NS[ns] ??
        DEFAULT_TIMEOUT_MS;
      const id = uuid();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this._pending.delete(id);
          reject(
            new Error(
              `RPC ${ns}.${method} timed out after ${timeoutMs}ms` +
                ` (pass { timeoutMs } as the 2nd arg to override)`
            )
          );
        }, timeoutMs);
        this._pending.set(id, {
          resolve: (v) => { clearTimeout(timer); resolve(v); },
          reject: (e) => { clearTimeout(timer); reject(e); },
        });
        this._post({ kind: "req", id, ns, method, args: args || {} });
      });
    }

    // (HTTP shim removed in v0.4.0 — image/upload now use postMessage.)

    _startHeartbeat() {
      this._heartbeatTimer = setInterval(() => {
        if (this._closed) return;
        this.call("window", "ready", {}).catch(() => {});
      }, 10000);
    }

    _onVoiceEvent(payload) {
      const vs =
        (payload.sessionId && this._voiceSessions.get(payload.sessionId)) ||
        this._voiceSessions.get("__single__");
      if (vs) vs._dispatch(payload);
    }

    _onStreamFrame(payload) {
      const sid = payload.stream_id;
      if (!sid) return;
      const stream = this._streams.get(sid);
      if (!stream) {
        // Frame may have arrived before `agent.session.run` resolved with
        // its stream_id. Buffer for a short window — the registration
        // path drains this on `_registerStream`.
        if (!this._earlyFrames) this._earlyFrames = new Map();
        let q = this._earlyFrames.get(sid);
        if (!q) { q = []; this._earlyFrames.set(sid, q); }
        q.push(payload);
        // Cap to avoid unbounded growth on truly orphaned streams.
        if (q.length > 256) q.shift();
        return;
      }
      stream._push(payload);
      if (payload.done) this._streams.delete(sid);
    }

    _registerStream(streamId, stream) {
      this._streams.set(streamId, stream);
      // Drain any frames that arrived before the RPC reply.
      const queued = this._earlyFrames && this._earlyFrames.get(streamId);
      if (queued && queued.length) {
        this._earlyFrames.delete(streamId);
        for (const p of queued) {
          stream._push(p);
          if (p.done) {
            this._streams.delete(streamId);
            break;
          }
        }
      }
    }

    static async connect(options = {}) {
      // Discover credentials from URL
      const params = new URLSearchParams(location.search);
      const wid = options.windowUuid || params.get("wid");
      const token = options.token || params.get("t");
      if (!wid || !token) {
        throw new Error("[anna-sdk] missing wid/t URL parameters");
      }
      const rt = new AnnaAppRuntime({ windowUuid: wid, token, parent: window.parent });
      // v0.24.0: host context from the iframe URL — synchronous, pre-RPC, so
      // the first paint already matches the dashboard. Old hosts omit these;
      // fall back to the browser's own signals.
      const urlTheme = params.get("theme");
      rt.theme = urlTheme === "light" || urlTheme === "dark"
        ? urlTheme
        : (typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
      rt.themeMode = params.get("themeMode") || (urlTheme ? rt.theme : "system");
      rt.locale = params.get("lang") || (typeof navigator !== "undefined" && navigator.language) || "en";
      const hello = await rt.call("window", "hello", {});
      rt.capabilities = hello.capabilities;
      rt.viewMeta = hello.view_meta;
      // forum #376 DX: the app's own identity — `{id, slug, name}`. `id` is
      // the numeric AnnaApp.id used by `open_app_view`; null on hosts older
      // than dispatcher 0.25.0.
      rt.app = hello.app || null;
      rt.entryPayload = hello.entry_payload || {};
      rt.runtimeState = hello.runtime_state || {};
      rt.geometry = hello.geometry || {};
      rt._startHeartbeat();
      // signal ready (host may show iframe at this point)
      rt.call("window", "ready", {}).catch(() => {});
      return rt;
    }
  }

// Convenience static references (mirrors pre-0.3.1 layout where these
// hung off the AnnaAppRuntime global). `AnnaHostError` was removed in
// v0.4.0; apps should now branch on the standard RPC error `.code`.
AnnaAppRuntime.AgentSession = AgentSession;
AnnaAppRuntime.AgentRunStream = AgentRunStream;
AnnaAppRuntime.VoiceSession = VoiceSession;
AnnaAppRuntime.VoiceClientCore = AnnaVoiceClientCore;

export { AnnaAppRuntime, AgentSession, AgentRunStream, VoiceSession, AnnaVoiceClientCore };
export default AnnaAppRuntime;
