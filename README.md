# ClubPulse

ClubPulse is a personal-use, cache-first football companion for Amazfit Bip 6.
It follows multiple Premier League and La Liga clubs, shows the best current
match plus up to five upcoming fixtures, and exposes the last cached match in a
full-screen watch Widget.

The project is complete and packages as a Zepp OS `.zab`. It contains a Device
App, phone-hosted Side Service, full-screen SecondaryWidget, English/Arabic
localization, bundled and dynamic crests, storage migration, and Node unit
tests.

## Supported target

- Amazfit Bip 6: 390 × 450, screen radius 86
- Zepp OS 5.0
- API_LEVEL 4.2
- Device sources `9765120`, `9765121`, and `10158337`
- Languages: `en-US` and `ar-EG`; the watch system language is used
- JavaScript with current `@zos/*` APIs
- ZML `0.0.29`, the nearest published compatible version to the requested
  `0.0.28` (which is no longer available from npm)

## MVP and implemented features

The MVP is the happy path from league selection to a cached club home:

1. Choose Premier League or La Liga.
2. Choose a bundled club without waiting for a network request.
3. Save the club and open its home page.
4. Ask the Side Service for a normalized ESPN schedule.
5. Persist and render the primary match plus up to five future fixtures.

The completed version also includes:

- Multiple followed teams, instant cached switching, management, and reset.
- Live/halftime 30-second foreground polling and five-minute suspended polling.
- Six-hour fixture and seven-day league-list cache policies.
- Manual refresh deduplication, cooldown, logical timeout, and stale-result
  rejection.
- Local-midnight rollover from a finished result to the next fixture.
- Typed offline and invalid-response errors without deleting valid cache.
- Dynamic opponent-logo download, conversion, transfer, indexing, and a
  protected 50-entry LRU limit.
- RTL Arabic layout, localized status/date/time text, mirrored navigation, and
  localized Widget previews/names.
- Storage-only SecondaryWidget: no timer, network, scrolling, or Bluetooth
  connection.

No backend, API key, cloud database, background service, store submission, or
automatic publishing is included.

## Architecture and data flow

```text
ESPN site API
    │ HTTPS, Side Service only
    ▼
app-side/espn-client.js
    ▼
shared/espn-adapter.js ──► stable Team / Fixture models
    ▼
shared/match-selector.js ──► primary + at most five upcoming
    ▼ minimal ZML payload
Device Page ──► LocalStorage ──► cache-first watch UI
                     │
                     └─────────► SecondaryWidget (read-only)

ESPN logo URL
    ▼
Side download ─► image conversion ─► ZML file transfer
    ▼
device logoIndex + data:// path ─► Device Page / Widget
```

Responsibilities are deliberately separated:

- `page/` owns routes, lifecycle, interactions, timers, and rendering.
- `device/` owns watch storage, localization, navigation, request coordination,
  transferred-file completion, and reusable UI helpers.
- `app-side/` owns HTTP, low-level error mapping, normalization calls, and
  dynamic image processing.
- `shared/` contains pure models, selectors, policies, migrations, validation,
  colors, and generated bundled-team data. Node tests import only this layer.
- `secondary-widget/` reads LocalStorage and renders cached values only.

ZML is initialized through the documented `App(BaseApp(...))` lifecycle so the
watch-to-phone transport is ready before a Device Page sends a request. The
Side Service does no polling; foreground Device Page lifecycle owns every
refresh timer. The SecondaryWidget itself remains storage-only and makes no
network request.

## ESPN boundary and data contracts

ESPN's site API is undocumented and has no guaranteed SLA. It can change or
disappear. All ESPN-specific nested paths are confined to
`shared/espn-adapter.js`; UI code never traverses raw ESPN JSON. Replacing ESPN
should require a new adapter/client, not page rewrites.

Normalized team:

```js
{
  id: '83',
  uid: 's:600~t:83',
  slug: 'barcelona',
  name: 'Barcelona',
  displayName: 'Barcelona',
  shortName: 'Barcelona',
  shortDisplayName: 'Barcelona',
  abbreviation: 'BAR',
  leagueCode: 'esp.1',
  color: 'A50044',
  alternateColor: '004D98',
  logo: 'https://...',
  logoUrl: 'https://...',
  localLogoPath: 'teams/83.png'
}
```

Normalized fixture:

```js
{
  id: 'fixture-id',
  competitionCode: '...',
  competitionName: '...',
  competitionShortName: '...',
  startTimeUtc: '2026-07-17T19:00:00.000Z',
  status: 'scheduled',
  statusLabel: 'Scheduled',
  minute: null,
  homeTeam: {
    id: '...',
    name: '...',
    abbreviation: '...',
    logoUrl: 'https://...',
    localLogoPath: null,
    score: null
  },
  awayTeam: {
    id: '...',
    name: '...',
    abbreviation: '...',
    logoUrl: 'https://...',
    localLogoPath: null,
    score: null
  }
}
```

Supported internal statuses are `scheduled`, `live`, `halftime`, `finished`,
`postponed`, `suspended`, and `cancelled`. Timestamps remain UTC until the watch
formats or selects them using its current timezone.

ZML request methods:

| Method | Input | Minimal result |
| --- | --- | --- |
| `clubs.get` | `leagueCode` | normalized alphabetical teams |
| `club.get` | `teamId`, optional `leagueCode` | one normalized team |
| `schedule.get` | `teamId`, watch time and UTC offset | primary + up to five |
| `logo.ensure` | `teamId`, HTTPS `logoUrl` | transfer queued |

## State management and persistence

The watch is the source of truth. Page state is short-lived and LocalStorage is
persistent. Writes are skipped when serialized values are unchanged.

```text
clubPulse.schemaVersion
clubpulse.selectedLeague
clubpulse.selectedTeam
clubPulse.followedTeams
clubPulse.lastViewedTeamId
clubPulse.leagueCache.eng.1
clubPulse.leagueCache.esp.1
clubPulse.fixtureCache.{teamId}
clubPulse.logoIndex
clubPulse.lastSyncAt
```

Schema version 1 repairs invalid last-viewed IDs and safely recovers corrupted
JSON. Reset removes only ClubPulse-owned keys and dynamic files. It does not
call `LocalStorage.clear()`.

Fixture cache:

```js
{
  teamId: '83',
  fetchedAt: 1784314800000,
  primaryFixture: { /* normalized fixture or null */ },
  upcomingFixtures: [ /* zero to five normalized fixtures */ ]
}
```

The page renders this cache before requesting data. A failed update leaves the
cache intact and adds a compact stale line. A successful empty schedule is
cached as a real “No matches scheduled” state.

## Project structure

```text
.
├── app.js / app.json             app lifecycle and Zepp target configuration
├── app-side/                     Side Service, ESPN HTTP, images, errors
├── assets/bip-6/                 packaged Bip 6 images and previews
│   └── teams/                    optimized 64 × 64 bundled crests
├── assets-src/                   original ClubPulse and fallback SVG sources
├── data/                         generated bundled-team manifest
├── device/                       watch services and reusable UI helpers
├── page/                         seven Device App pages and PO locales
├── scripts/                      reproducible base/club asset generation
├── secondary-widget/             full-screen cached Widget
├── shared/                       Zepp-global-free business logic
└── test/                         Node tests and offline JSON fixtures
```

## Prerequisites and setup

Install:

- Node.js 20 or later (an active LTS release is recommended).
- npm.
- Zepp OS Simulator for simulator testing.
- The latest Zepp phone app and a bound Amazfit Bip 6 for physical testing.

The CLI is pinned locally, so a global Zeus install is optional.

```bash
npm install
npm test
npm run build
```

The packaged artifact is written to `dist/`.

The root `_moduleAliases` entry in `package.json` works around a packaging
omission in Zeus CLI 1.9.2: its bundled private `zeppos-app-utils` module is not
otherwise resolved when Zeus is installed locally.

## Simulator development

1. Install and open Zepp OS Simulator.
2. Download/select the Amazfit Bip 6 device simulator if it is offered by the
   simulator's device manager.
3. Open the Device Simulator window.
4. From this directory run:

```bash
npm run dev
```

Zeus listens for changes, rebuilds, and refreshes the simulator. Inspect both
Device App and Side Service consoles. The tests never call live ESPN endpoints,
but the Side Service does during interactive app use.

If a Bip 6 simulator image is unavailable, use a current API 4.2 simulator for
logic and lifecycle checks, then verify the exact 390 × 450 layout on the
physical Bip 6.

## Physical Bip 6 preview

1. Sign in to the Zepp phone app and bind the Bip 6.
2. Sign in to Zeus if requested: `npx zeus login`.
3. Run `npm run preview` and select `Amazfit Bip 6`.
4. In the Zepp app, enable Developer Mode:
   `Profile → Settings → About → tap the Zepp icon seven times`.
5. Open the Developer Mode scan action, scan the Zeus QR code, and install the
   preview on the watch.
6. Keep the watch connected to the phone and allow the Zepp app internet access
   while testing ESPN refresh and file transfer.

Physical-watch checks still required after installation:

- First launch, persisted relaunch, both leagues, multiple clubs, and deletion.
- English and Arabic system-language layout, long labels, and 12/24-hour time.
- Live/halftime polling transitions and timer teardown on pause.
- Phone-disconnected, phone-offline, and late-response states.
- Dynamic opponent crest transfer and reset cleanup.

## Enable and test the full-screen Widget

On the Bip 6, use:

`Settings → Preferences → Widget → Add → ClubPulse`

Return to the watchface and swipe through full-screen Widgets. Open ClubPulse
once to populate cache; the Widget rereads LocalStorage when it resumes and
opens the displayed club when tapped.

The Widget is intentionally cached. It cannot guarantee live data until the
main app is opened, because it performs no network/Bluetooth request and owns no
timer.

## Tests and quality commands

```bash
npm test                 # 39 pure business-logic tests
npm run test:watch
npm run assets:generate  # original icon, fallback, league marks, previews
npm run assets:sync      # also refreshes current club manifest and crests
npm run build
npm run check            # tests, then package build
```

Tests cover adapter schemas and statuses, string JSON bodies, malformed fields,
timezone/day boundaries, match priority, five-match filtering, cache rules,
midnight rollover, request deduplication/timeouts, storage migration/removal,
reset scoping, colors, validation, and logo eviction. Test fixtures are local;
tests do not contact ESPN.

## Assets

Original project assets:

- `assets-src/clubpulse-logo.png`: approved football/pulse ClubPulse identity,
  extracted from the locked League Selection reference.
- `assets-src/premier-league-reference.png` and
  `assets-src/la-liga-reference.png`: approved transparent league marks
  extracted from the same locked reference.
- `assets-src/la-liga-symbol-reference.png`: symbol-only header mark for the
  locked Team Selection reference.
- `assets-src/neutral-crest.svg`: non-trademark fallback.
- Small navigation/action icons generated by
  `scripts/generate-base-assets.mjs`.

Retrieved sources:

- Premier League mark:
  `https://a.espncdn.com/i/leaguelogos/soccer/500/23.png`
- La Liga mark:
  `https://a.espncdn.com/i/leaguelogos/soccer/500/15.png`
- Club names, metadata, and crest URLs: the two ESPN league-team endpoints
  listed in `shared/constants.js`.

`npm run assets:sync` downloads current league rosters, normalizes them through
the same adapter, resizes crests to RGBA 64 × 64 PNG, updates
`data/bundled-teams.json`, and regenerates `shared/bundled-teams.js`.

Run the sync intentionally and review its diff: promotions/relegations can
change the manifest. If a trademarked asset cannot be retrieved, keep or copy
`neutral-crest.png` to the expected filename; do not invent a replacement
logo. Club and league marks remain the property of their respective owners and
are included for personal-use development only.

## Offline and cache behavior

- Bundled club selection works with no internet.
- Fixture cache TTL: six hours.
- League-list cache TTL: seven days.
- Live/halftime and ±3-hour kickoff windows override fixture TTL.
- Polling exists only on the visible Club Home page.
- Valid cache remains visible after disconnect, timeout, HTTP failure, or
  invalid response.
- No-cache failures show the stored club crest, concise reason, connection
  guidance, Retry, and Back to My Teams.
- Dynamic crests use the neutral fallback until transfer completes.

## Troubleshooting

**Phone disconnected**

Keep Bluetooth enabled, verify the Bip 6 is connected in Zepp, keep the Zepp app
running, and retry. ZML maps a missing Side Service/BLE connection to
`PHONE_DISCONNECTED`.

**No internet or HTTP error**

Confirm the phone can reach `site.api.espn.com`. Existing watch cache is still
usable. ESPN's site endpoints are undocumented and may be unavailable or
changed.

**Request timeout**

Retry after checking the phone connection. The logical request is discarded;
a late response cannot overwrite newer state.

**Invalid ESPN response**

Run `npm test`, capture only the response shape needed to update the local JSON
fixture, and adapt `shared/espn-adapter.js`. Do not add raw ESPN paths to pages.

**Zeus cannot resolve `zeppos-app-utils`**

Use the checked-in `package.json` unchanged and reinstall:

```bash
rm -rf node_modules
npm install
```

Do not remove the `_moduleAliases` compatibility entry.

**Simulator does not connect**

Open its Device Simulator window before `npm run dev`, verify the simulator
virtual network interface, and run `npx zeus status`.

**Dynamic crest stays neutral**

Check Side Service logs for download/convert errors and keep the app page open
until the transfer reaches `transferred`. Reset clears dynamic files and lets
them be requested again.

## Implementation phases and roadmap

Completed phases:

1. Target/config/toolchain and deterministic assets.
2. Pure adapter, selectors, policies, migrations, and tests.
3. Cache-first onboarding, club page, multi-team pages, and localization.
4. Side Service networking and dynamic image pipeline.
5. Storage-only SecondaryWidget.
6. Packaging and generated-route inspection.

Possible post-MVP improvements, intentionally out of scope:

- Physical-watch screenshot regression baselines for both languages.
- More leagues behind the existing league/adapter contracts.
- User-controlled diagnostics export for ESPN schema changes.

Standings, news, lineups, notifications, betting, and player statistics are not
on the current roadmap.

## License

Project code is MIT licensed; see `LICENSE`. Third-party marks and downloaded
sports assets are not covered by that software license.
