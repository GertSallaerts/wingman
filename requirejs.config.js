{
  "baseUrl": ".",
  "optimize": "none",
  "paths": {
    "wingman": "src/wingman",
    "common": "src/common",
    "transport": "src/transport/transport",
    "transports": "src/transport",
    "eventemitter2": "node_modules/eventemitter2/lib/eventemitter2"
  },
  "include": [
    "node_modules/almond/almond", 
    "wingman"
  ],
  "exclude": [
  ],
  "out": "dist/wingman.js",
  "wrap": {
    "startFile": "build/wrap.start",
    "endFile": "build/wrap.end"
  }
}