// Generated from /Users/lech/Projects/PlatformIO/esp32c3-rosary release commits after 622ef97.
window.SmartRosaryChangelog = [
  {
    version: "v1.37",
    releaseCommit: "ee2b8a3",
    changes: [
      { hash: "fe99850", text: "Fix device statistics charts to align perfectly with the dashboard and smartphone app reference" },
      { hash: "fe99850", text: "Update device pie chart and bar chart text labels to correctly display weighted full rosary counts" },
      { hash: "fe99850", text: "Keep visual proportions accurate on device bar chart by rendering with raw mystery part counts" }
    ]
  },
  {
    version: "v1.36",
    releaseCommit: "36c9776",
    changes: [
      { hash: "36c9776", text: "Add support for v1.1 language partitions and report installed language versions to clients" },
      { hash: "36c9776", text: "Release firmware v1.36 alongside updated language editor and translated assets" }
    ]
  },
  {
    version: "v1.35",
    releaseCommit: "fb67442",
    changes: [
      { hash: "fb67442", text: "Added completely new visual statistic tiles to the device interface" },
      { hash: "fb67442", text: "Expose BLE connection RSSI through device.status.get so dashboards and companion apps can show signal strength reliably while connected" },
      { hash: "fb67442", text: "Allow the web dashboard to list paired app IDs and remove pairing slots through the existing app-pairing characteristic without adding new BLE services" },
      { hash: "fb67442", text: "Keep existing mobile app token-based pairing operations compatible while adding dashboard-friendly list/delete commands" },
      { hash: "fb67442", text: "Release firmware v1.35 with the updated dashboard pairing and status telemetry support" }
    ]
  },
  {
    version: "v1.34",
    releaseCommit: "ce33da2",
    changes: [
      { hash: "ce33da2", text: "Add paired-app slot management so one connected app can list and remove other paired app devices without removing itself" },
      { hash: "ce33da2", text: "Add a silent app-pairing check for automatic reconnects so a deleted app token no longer opens the on-device permission prompt" },
      { hash: "ce33da2", text: "Expose hardware ID and compact paired-app metadata in the existing BLE settings payload while keeping dashboard compatibility" },
      { hash: "ce33da2", text: "Hide only the long intention description during tile swipes so intention titles remain visible and transitions stay smooth" }
    ]
  },
  {
    version: "v1.33",
    releaseCommit: "3d950a9",
    changes: [
      { hash: "3d950a9", text: "Expose the installed language partition ID and version in the existing BLE settings payload" },
      { hash: "3d950a9", text: "Show firmware and language metadata below the device QR code in the format v1.33 • pl v1.0" },
      { hash: "3d950a9", text: "Enable the mobile app to detect legacy unversioned language files and newer published language packages" },
      { hash: "3d950a9", text: "Preserve all existing dashboard settings fields, BLE characteristics, and language installation behavior" }
    ]
  },
  {
    version: "v1.32",
    releaseCommit: "00f1a22",
    changes: [
      { hash: "00f1a22", text: "Allow up to four smartphones to remain paired with one rosary, including migration of existing single-device pairing data and selective unpairing" },
      { hash: "00f1a22", text: "Expose live charging and external-power state through device.status.get and optional statistics fields so the mobile app can show charging even at 100% battery" },
      { hash: "00f1a22", text: "Notify connected apps immediately when charging state changes while safely dispatching BLE notification work from the firmware main loop" },
      { hash: "00f1a22", text: "Keep the existing web-dashboard consent handshake and BLE protocol behavior compatible" }
    ]
  },
  {
    version: "v1.31",
    releaseCommit: "b0978e5",
    changes: [
      { hash: "b0978e5", text: "Expose battery percentage and current device time over BLE for the mobile status bar" },
      { hash: "b0978e5", text: "Add a dedicated device.status.get response with battery state-of-charge and RTC epoch values" },
      { hash: "b0978e5", text: "Keep battery percentage current while charging and preserve the complete legacy dashboard payload on constrained BLE connections" }
    ]
  },
  {
    version: "v1.30",
    releaseCommit: "74e6c58",
    changes: [
      { hash: "74e6c58", text: "Add dedicated mobile-app BLE pairing with a persistent 128-bit token and one-time physical approval" },
      { hash: "74e6c58", text: "Allow trusted app reconnects without repeating the rosary permission prompt, with explicit unpair support" },
      { hash: "74e6c58", text: "Preserve the existing web dashboard consent commands, BLE characteristics, and update flows unchanged" }
    ]
  },
  {
    version: "v1.29",
    releaseCommit: "e637067",
    changes: [
      { hash: "8154ded", text: "Add chunked download support for BLE intention descriptions" }
    ]
  },
  {
    version: "v1.28",
    releaseCommit: "a66392b",
    changes: [
      { hash: "a66392b", text: "Implement English NVS fallback and fix intentions backup/restore" }
    ]
  },
  {
    version: "v1.27",
    releaseCommit: "277e9a0",
    changes: [
      { hash: "277e9a0", text: "Add fully synchronized Shutdown Timer control from dashboard" },
      { hash: "277e9a0", text: "Fix dashboard translation omissions and double commas in UI" },
      { hash: "277e9a0", text: "Add visual indicator on dashboard for outdated firmware (older than v1.25)" },
      { hash: "277e9a0", text: "Improve live synchronization when modifying settings via dashboard or device" }
    ]
  },
  {
    version: "v1.26",
    releaseCommit: "f36d6ac",
    changes: [
      { hash: "f36d6ac", text: "Fixed intentions schedule wiping issue upon initial unified restore" },
      { hash: "f36d6ac", text: "Resolved BLE pacing timeout during dashboard restore" },
      { hash: "f36d6ac", text: "Corrected NVS binary data structure for proper intention titles on device" }
    ]
  },
  {
    version: "v1.25",
    releaseCommit: "4a4209d",
    changes: [
      { hash: "a826f08", text: "Added auto-shutdown settings page with NVS persistence and localization" },
      { hash: "7201c32", text: "Refined UI interactions: robust tileview swiping and rounded roller corners" },
      { hash: "2dd75aa", text: "Fixed DPAD navigation over BLE" },
      { hash: "fe6ffa2", text: "Added live wallpaper preview to brightness settings and fixed SPIFFS limit for wallpaper caching" },
      { hash: "93f2c4e", text: "History tracker now flags manually selected intentions upon decade completion" },
      { hash: "11c79c4", text: "Implemented live display rotation and intention tracking" },
      { hash: "5a29a09", text: "Fixed physical touch axis orientation" },
      { hash: "4f206a1", text: "Preserved active manual intention scheduling" },
      { hash: "484fed7", text: "Reduced firmware size by dropping WiFi wrapper" },
      { hash: "2d9e8f1", text: "Added global authentication and crypto build switch" }
    ]
  },
  {
    version: "v1.24",
    releaseCommit: "0f662a9",
    changes: [
      { hash: "0f662a9", text: "Fixed settings page numbering" }
    ]
  },
  {
    version: "v1.23",
    releaseCommit: "47ce9dd",
    changes: [
      { hash: "19aeda6", text: "Added fallback widget for webtest intentions" },
      { hash: "0685622", text: "Extended fonts with support for French and Portuguese glyphs" },
      { hash: "b03a0bf", text: "Fixed NVS binary builder and enabled intentions upload in webtest build" }
    ]
  },
  {
    version: "v1.22",
    releaseCommit: "1079efc",
    changes: [
      { hash: "f89dc35", text: "Updated system wallpapers with pmkdus collection" },
      { hash: "f396998", text: "Fixed issue with rosary mystery progression re-entry" },
      { hash: "25ca90f", text: "Cleaned up tracking of local Python and VS Code artifacts" }
    ]
  },
  {
    version: "v1.21",
    releaseCommit: "0ef9526",
    changes: [
      { hash: "e05d8ed", text: "Added live refresh of rosary preview from intention selection" },
      { hash: "256d855", text: "Enabled Real-Time Clock (RTC) sync commands over BLE" },
      { hash: "5ef30c0", text: "Fixed visual bugs in intention previews and reduced NVS flash wear" },
      { hash: "9e530f9", text: "Gated snapshot UART logs to improve performance" }
    ]
  },
  {
    version: "v1.20",
    releaseCommit: "97e1025",
    changes: [
      { hash: "cae8803", text: "Architectural refactor: Implemented explicit TinyFSM application state machine for robust app flow" },
      { hash: "873df65", text: "Stabilized BLE UI test control and OTA/boot diagnostics" },
      { hash: "a6291e4", text: "Fixed BLE navigation swipe dispatch logic" },
      { hash: "7f2cf84", text: "Added visual rosary screen for bead key progress tracking" },
      { hash: "f078796", text: "Fixed mystery part mapping for custom rosary selections" },
      { hash: "1ca45ef", text: "Added rosary bead state widget for webtests and exposed in snapshots" },
      { hash: "92e886b", text: "Added comprehensive state machine analysis and state diagrams to documentation" }
    ]
  },
  {
    version: "v1.18",
    releaseCommit: "e56a077",
    changes: [
      { hash: "c2a8b83", text: "Implemented silent bootloader (disabled UART output during boot) for faster startup" },
      { hash: "31bcd32", text: "Added I2C bus recovery before SoftWire initialization to improve hardware reliability" },
      { hash: "487e1e2", text: "Relocated SoftWire library to src and removed wire input pullups" }
    ]
  },
  {
    version: "v1.17",
    releaseCommit: "b0ea735",
    changes: [
      { hash: "67fc101", text: "Fixed RTC boot synchronization to accept plausible times even when validity flag is false, avoiding Epoch-0 (01:00:00) issues" }
    ]
  },
  {
    version: "v1.16",
    releaseCommit: "9f96562",
    changes: [
      { hash: "64a28e1", text: "Fixed RTC to system time timezone conversion to prevent recording future history timestamps" },
      { hash: "64a28e1", text: "Improved history logging: skipped when system epoch is invalid and limited intention flag to active intentions" },
      { hash: "64a28e1", text: "Fixed mystery roller skip flag to prevent swallowing user changes mid-decade" }
    ]
  },
  {
    version: "v1.15",
    releaseCommit: "f4eecbf",
    changes: [
      { hash: "deb54e9", text: "Added dash glyph support to system fonts" },
      { hash: "8bf5aa0", text: "Made long intention descriptions vertically scrollable for better readability" },
      { hash: "f4eecbf", text: "Slightly increased the height of the intentions description area" }
    ]
  },
  {
    version: "v1.14",
    releaseCommit: "e3c9bcc",
    changes: [
      { hash: "54b36db", text: "Hidden the Intention roller option when no custom intentions are installed" },
      { hash: "363f275", text: "Fixed LVGL label long mode to prevent unwanted auto-wrapping" },
      { hash: "8bef484", text: "Added LaTeX support for QR codes" }
    ]
  },
  {
    version: "v1.12",
    releaseCommit: "9d868ed",
    changes: [
      { hash: "bc476ea", text: "Improved intention selection to avoid clobbering presets and allowed manual mystery resets" },
      { hash: "9d868ed", text: "Lowered haptic vibration duty cycle to extend motor lifespan" },
      { hash: "31a8b64", text: "Implemented fixes and added detailed logging to improve compatibility with the Bluefy browser" }
    ]
  },
  {
    version: "v1.1",
    releaseCommit: "ce69954",
    changes: [
      { hash: "367bf1d", text: "Major firmware update for smaller framebuffer to significantly reduce memory usage" },
      { hash: "c5be477", text: "Added full File System management over Bluetooth (BLE FS) enabling wallpaper and intention uploads" },
      { hash: "cc2c365", text: "Implemented persistent History tracking, recording completed rosaries and saving them to flash" },
      { hash: "0733526", text: "Added Real-Time Clock (RTC) feature, including automatic time syncing via Bluetooth and on-screen display" },
      { hash: "e304203", text: "Adjusted partition scheme to support uploading up to 5 custom wallpapers and history data" },
      { hash: "82eab6a", text: "Added cryptographic authentication and backend signing support" },
      { hash: "69ace11", text: "Added customizable Intention scheduling and Mystery selection over BLE" },
      { hash: "20c2e8f", text: "Added specific fixes to improve iOS Bluetooth connectivity" }
    ]
  },
  {
    version: "v1.0",
    releaseCommit: "92e5896",
    changes: [
      { hash: "92e5896", text: "Initial release" }
    ]
  }
];
