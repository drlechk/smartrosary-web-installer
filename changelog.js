// Generated from /Users/lech/Projects/PlatformIO/esp32c3-rosary release commits after 622ef97.
window.SmartRosaryChangelog = [
  {
    version: "v1.25",
    releaseCommit: "4a4209d",
    changes: [
      { hash: "2d9e8f1", text: "Add global auth and crypto build switch" },
      { hash: "484fed7", text: "Reduce firmware size by dropping WiFi wrapper" },
      { hash: "4f206a1", text: "Preserve active manual intention scheduling" },
      { hash: "11c79c4", text: "Apply display rotation live and track intentions" },
      { hash: "5a29a09", text: "Fix physical touch axis orientation" },
      { hash: "93f2c4e", text: "Flag manually selected intentions on decade completion in history tracker" },
      { hash: "fe6ffa2", text: "Fix wallpaper caching to avoid SPIFFS limit and add live wallpaper preview to brightness settings" },
      { hash: "2dd75aa", text: "Fix DPAD navigation over BLE, remove max_screens_h shadowing" },
      { hash: "7201c32", text: "Refine UI interactions: make tileview swiping robust and round roller corners" },
      { hash: "a826f08", text: "Add auto-shutdown settings page with NVS persistence and localization (l021/l022)" }
    ]
  },
  {
    version: "v1.24",
    releaseCommit: "0f662a9",
    changes: [
      { hash: "0f662a9", text: "settings page numbering fixed" }
    ]
  },
  {
    version: "v1.23",
    releaseCommit: "47ce9dd",
    changes: [
      { hash: "19aeda6", text: "Add webtest intentions widget fallback" },
      { hash: "35f26f8", text: "Enable intentions upload in webtest build" },
      { hash: "0685622", text: "Extend generated fonts for French and Portuguese glyphs" },
      { hash: "b03a0bf", text: "WIP: current state before NVS binary builder fix" }
    ]
  },
  {
    version: "v1.22",
    releaseCommit: "1079efc",
    changes: [
      { hash: "f89dc35", text: "update wallpapers" },
      { hash: "f396998", text: "Fix rosary mystery progression re-entry" },
      { hash: "af7ccaf", text: "pmkdus images update" },
      { hash: "25ca90f", text: "Ignore local Python and VS Code artifacts" },
      { hash: "ccf1eb9", text: "Stop tracking VS Code workspace files" }
    ]
  },
  {
    version: "v1.21",
    releaseCommit: "0ef9526",
    changes: [
      { hash: "e05d8ed", text: "Refresh rosary preview from intention selection" },
      { hash: "256d855", text: "Enable RTC sync commands and gate snapshot UART logs" },
      { hash: "5ef30c0", text: "Fix intention preview and NVS churn" },
      { hash: "9e530f9", text: "Commit remaining firmware changes" }
    ]
  },
  {
    version: "v1.20",
    releaseCommit: "97e1025",
    changes: [
      { hash: "92e886b", text: "docs: add current state machine analysis" },
      { hash: "cae8803", text: "Implement explicit tinyfsm app state machine and add state diagrams" },
      { hash: "2577d82", text: "webstest updates" },
      { hash: "a7de8bd", text: "update" },
      { hash: "873df65", text: "feat(fw): stabilize BLE UI test control and OTA/boot diagnostics updates" },
      { hash: "b591a2a", text: "fw(webtest): navigate to widget screens before ui write/action" },
      { hash: "d53c263", text: "update" },
      { hash: "71bbaed", text: "update" },
      { hash: "a6291e4", text: "Fix BLE navigation swipe dispatch" },
      { hash: "b452f8a", text: "update" },
      { hash: "7f2cf84", text: "Show rosary screen for bead key progress" },
      { hash: "9d58bf7", text: "update" },
      { hash: "a4aa452", text: "update" },
      { hash: "1ca45ef", text: "Add rosary bead state widget for webtests" },
      { hash: "3ea37f2", text: "Expose rosary bead state in snapshots" },
      { hash: "f078796", text: "Fix mystery part mapping for custom rosary selection" }
    ]
  },
  {
    version: "v1.18",
    releaseCommit: "e56a077",
    changes: [
      { hash: "487e1e2", text: "Softwire moved to src" },
      { hash: "cbe327c", text: "wire input pullup removed" },
      { hash: "c2a8b83", text: "silent bootloader added (no uart output)" },
      { hash: "31bcd32", text: "Add I2C bus recovery before SoftWire init" }
    ]
  },
  {
    version: "v1.17",
    releaseCommit: "b0ea735",
    changes: [
      { hash: "67fc101", text: "Fix RTC boot sync: avoid epoch-0 (01:00:00) by accepting plausible RTC time even when validity flag is false" }
    ]
  },
  {
    version: "v1.16",
    releaseCommit: "9f96562",
    changes: [
      { hash: "64a28e1", text: "Fix RTC to system time TZ conversion to prevent future history timestamps" },
      { hash: "64a28e1", text: "Skip history logging when system epoch is invalid" },
      { hash: "64a28e1", text: "Only set history intention flag when Intention option is selected" },
      { hash: "64a28e1", text: "Fix mystery roller skip flag swallowing user changes mid-decade" }
    ]
  },
  {
    version: "v1.15",
    releaseCommit: "f4eecbf",
    changes: [
      { hash: "deb54e9", text: "Dash glyph added to fonts" },
      { hash: "8bf5aa0", text: "Make intention description vertically scrollable (no scrollbar)" },
      { hash: "f4eecbf", text: "intentions desc height slightly bigger" }
    ]
  },
  {
    version: "v1.14",
    releaseCommit: "e3c9bcc",
    changes: [
      { hash: "8bef484", text: "qrcode latex added" },
      { hash: "5050788", text: "manuel wip" },
      { hash: "54b36db", text: "Hide Intention roller option when no intentions are installed + stl update + web-sim wip" },
      { hash: "24d772b", text: "Hide intention option unless schedule exists" },
      { hash: "363f275", text: "fix(lvgl): set label long mode to prevent auto wrapping" }
    ]
  },
  {
    version: "v1.12",
    releaseCommit: "9d868ed",
    changes: [
      { hash: "31a8b64", text: "bluefy fix attempt" },
      { hash: "819da0e", text: "bluefy fix attempt - log added" },
      { hash: "0713779", text: "bluefy fix attempt - log added" },
      { hash: "0c66c23", text: "bluefy fix attempt - log added" },
      { hash: "aaf89b0", text: "bluefy fix attempt - log added" },
      { hash: "34a819a", text: "bluefy fix attempt - log added" },
      { hash: "bc476ea", text: "Handle intention selection without clobbering presets and allow manual mystery reset" },
      { hash: "9d868ed", text: "haptic duty lowered to not stress vibration motor" }
    ]
  },
  {
    version: "v1.1",
    releaseCommit: "ce69954",
    changes: [
      { hash: "82eab6a", text: "auth sign with backend added" },
      { hash: "a234bc5", text: "lv font generation oj init added" },
      { hash: "45faacc", text: "reverse bleota cleanup" },
      { hash: "367bf1d", text: "major rosary update for smaller framebuffer" },
      { hash: "0ea9932", text: "encrypted snapshots to server wip" },
      { hash: "ef3d942", text: "settings web->device fix" },
      { hash: "d78608e", text: "fs image browser wip" },
      { hash: "0db0006", text: "ble fs reversed" },
      { hash: "24426f4", text: "blefs wip" },
      { hash: "6124548", text: "blefs list ok" },
      { hash: "767738f", text: "blefs wip + crashing on start" },
      { hash: "c5be477", text: "partions changed + blefs download working" },
      { hash: "5e1c0ea", text: "blefs upload, rename, delete ok" },
      { hash: "f03b82e", text: "webblefs update" },
      { hash: "f119c3d", text: "webblefs updates" },
      { hash: "9fb5034", text: "update" },
      { hash: "ab4b060", text: "update blefsweb" },
      { hash: "63a41d0", text: "blefs fixes" },
      { hash: "6bd6edb", text: "blefs web update" },
      { hash: "f2e054a", text: "blefs web update" },
      { hash: "3d12d08", text: "blefs web one card update" },
      { hash: "d0e1f9b", text: "lvble web log change" },
      { hash: "fd0e92f", text: "blefs minor changes" },
      { hash: "4804be2", text: "disp stripes wip test" },
      { hash: "a5dca3a", text: "update" },
      { hash: "d5460d7", text: "update" },
      { hash: "d72fe23", text: "display reset stuff removed" },
      { hash: "0733526", text: "rtc added" },
      { hash: "c739d7b", text: "webblefs update" },
      { hash: "6aa0746", text: "img psd update" },
      { hash: "43c1024", text: "gitignore update" },
      { hash: "72972a6", text: "psd removed, too big?" },
      { hash: "540bf75", text: "bleota refactor/outsource" },
      { hash: "5c4547b", text: "ble wp upload fixed" },
      { hash: "6353966", text: "ble keys+touch ousource" },
      { hash: "e304203", text: "new partition scheme for spiffs hist, wallpaper max 5" },
      { hash: "c5b6a71", text: "partition adjusted for wallpaper upload sweetspot" },
      { hash: "cc2c365", text: "history added" },
      { hash: "4adb1d4", text: "history and wp working both" },
      { hash: "6b42ef2", text: "hist restore added" },
      { hash: "1db7d6e", text: "update hist webble" },
      { hash: "c7b3e63", text: "update web hist" },
      { hash: "ea86531", text: "ble hist refined" },
      { hash: "90a6886", text: "jezus wp" },
      { hash: "ab079bd", text: "ble hist cosmetics" },
      { hash: "f35cd19", text: "datetime on screen + ble sync" },
      { hash: "2000429", text: "stats log + minor changes" },
      { hash: "54e1794", text: "ble auth/crypt compiler switch added + bleota_intentions wip" },
      { hash: "758a6f5", text: "revert 54e1794907278622148558115f927b475dcbd968" },
      { hash: "4a773bf", text: "ble datetime sync fix" },
      { hash: "69ace11", text: "ble intentions schedule editor + codex opts" },
      { hash: "8c6fdc7", text: "ble intentions schedule editor + codex opts" },
      { hash: "dcf351d", text: "font12 with extra glyphs added" },
      { hash: "6f3a768", text: "intentions stat wip" },
      { hash: "6fb403a", text: "intentions stat wip" },
      { hash: "0d31977", text: "intentions title selected added" },
      { hash: "8ac5e1b", text: "device id bleota class" },
      { hash: "bce5cd1", text: "intentions + mystery roller stuff wip" },
      { hash: "49e1d69", text: "intentions + mystery roller stuff wip" },
      { hash: "20c2e8f", text: "ios fix attempt" },
      { hash: "4564218", text: "web tests archived" },
      { hash: "f231318", text: "web tests archived" },
      { hash: "42e542c", text: "ble intentions fixed" },
      { hash: "0d0faaa", text: "split wallpaper history fs ble uuids" },
      { hash: "ce69954", text: "history delete added" }
    ]
  }
];
