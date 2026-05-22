"use strict";
// Mnemosyne Federation Protocol — Shared Types
// MV-CN Cross-Network Mesh Discovery · SAGA 3 BP045 W1
//
// Four-frame topology: Wife · Founder · Daughter · Son
// LAN peers: mDNS/UDP multicast (_mnemosyne._tcp.local.)
// WAN peers: WebSocket relay at wss://relay.mnemosynec.ai
Object.defineProperty(exports, "__esModule", { value: true });
exports.FOUR_FRAME_COLLECTOR_PATH = exports.RELAY_HTTP_URL = exports.RELAY_URL = exports.LAN_MULTICAST_PORT = exports.LAN_MULTICAST_ADDR = exports.LAN_ANNOUNCE_PORT = exports.MNEMOSYNE_SERVICE_NAME = void 0;
exports.MNEMOSYNE_SERVICE_NAME = '_mnemosyne._tcp.local.';
exports.LAN_ANNOUNCE_PORT = 11481;
exports.LAN_MULTICAST_ADDR = '224.0.0.251';
exports.LAN_MULTICAST_PORT = 5354;
exports.RELAY_URL = 'wss://relay.mnemosynec.ai';
exports.RELAY_HTTP_URL = 'https://relay.mnemosynec.ai';
exports.FOUR_FRAME_COLLECTOR_PATH = '/4frame';
//# sourceMappingURL=federation-protocol.js.map
