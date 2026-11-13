# Online playback feasibility — 2026-11-13

Research only. No playback implementation, downloads, account authentication, or release performed.

## Verified upstream

SimpMusic main references core commit `1830a60416dcac82d402fcedcc92c09fde94d567` through `.gitmodules`.

- Repository: https://github.com/maxrave-dev/SimpMusic
- Core: https://github.com/maxrave-dev/core/tree/1830a60416dcac82d402fcedcc92c09fde94d567
- `data/.../SearchRepositoryImpl.kt` uses YouTube song/video/album/artist filters and continuation results.
- `data/.../StreamRepositoryImpl.kt` resolves a video ID to available formats, chooses audio quality, tracks stream expiration and invalidates failed formats.
- `service/kotlinYtmusicScraper/src/jvmMain/.../extractor/Extractor.jvm.kt` uses multiple extraction implementations, validates stream responses, and includes an external fallback service. It is not just the public YouTube Data API.
- `media/media-jvm/.../mpv/MpvPlayer.kt` wraps libmpv for desktop playback.
- Spotify functionality is supplementary metadata/Canvas/lyrics according to upstream README; this is not free Spotify audio playback.

## Existing SPMusic

- DiscoverMusic already searches YouTube and displays official embeds.
- server/src/youtube.js uses a separate yt-dlp process for the existing import workflow. It downloads and converts files before inserting local tracks; it is not an online playback resolver.
- usePlayer.js selects tracks by local ID and uses audioUrl for two audio elements. Online items need a separate source type and asynchronous preparation before play/seek/preload. They must not enter local file editing, AI processing, deletion or download flows implicitly.

## Proposed experiment

Keep the official embedded player as a reliable fallback where embedding is allowed. Investigate an isolated online source adapter before merging anything into the stable app. Measure actual playback startup, pause/resume, seeking, next-track behavior, expired URLs and network errors on Windows; a successful metadata lookup alone is not a successful playback test.

User experience: search online -> song/artist/album result -> play -> online queue. Display source attribution and retain original source link. Do not present online songs as locally downloaded files. Preserve region/login restrictions and report unsupported sources plainly. Do not collect session cookies through chat.

No claim that all hits are available, that a particular track plays, or that extraction is stable has been validated by this research. Reusing GPL-3.0 upstream code requires a separate license review; no upstream implementation was copied into SPMusic.
