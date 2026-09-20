#!/usr/bin/env node
'use strict';
/**
 * Decoy services for the nmap stage of the workshop.
 *
 * These are banners, not implementations: enough of each protocol for
 * `nmap -sV` to identify the service, and nothing behind it. A real MySQL or
 * Redis on a public training host would be an actual vulnerability rather
 * than a taught one.
 *
 *   node decoys/server.js
 *
 * Every connection is logged to stdout. That log is worth showing during the
 * debrief: a port scan looks very distinctive from the defender's side.
 */
const net = require('net');
const { FLAGS } = require('../lib/data');

const FLAG = FLAGS.stage1;
const WEB_PORT = process.env.WEB_PORT || '8088';

/** MySQL initial handshake packet (protocol 10), enough for version detection. */
function mysqlGreeting(version = '5.7.33-0ubuntu0.18.04.1') {
  const salt1 = Buffer.from('a1b2c3d4e5f60718', 'hex');       // 8 bytes
  const salt2 = Buffer.from('90a1b2c3d4e5f60718293a4b', 'hex'); // 12 bytes
  const payload = Buffer.concat([
    Buffer.from([0x0a]),                       // protocol version
    Buffer.from(version, 'ascii'), Buffer.from([0x00]),
    Buffer.from([0x0b, 0x00, 0x00, 0x00]),     // connection id
    salt1, Buffer.from([0x00]),                // auth-plugin-data-part-1 + filler
    Buffer.from([0xff, 0xf7]),                 // capability flags (lower)
    Buffer.from([0x21]),                       // charset: utf8_general_ci
    Buffer.from([0x02, 0x00]),                 // status flags: autocommit
    Buffer.from([0xff, 0x81]),                 // capability flags (upper)
    Buffer.from([0x15]),                       // auth-plugin-data length (21)
    Buffer.alloc(10),                          // reserved
    salt2, Buffer.from([0x00]),                // auth-plugin-data-part-2
    Buffer.from('mysql_native_password', 'ascii'), Buffer.from([0x00]),
  ]);
  const header = Buffer.alloc(4);
  header.writeUIntLE(payload.length, 0, 3);
  header[3] = 0; // sequence id
  return Buffer.concat([header, payload]);
}

const REDIS_INFO = [
  '# Server',
  'redis_version:5.0.7',
  'redis_mode:standalone',
  'os:Linux 5.4.0-88-generic x86_64',
  'tcp_port:6379',
  '# Keyspace',
  'db0:keys=412,expires=0,avg_ttl=0',
].join('\r\n');

/**
 * Extract the command name from a Redis request.
 *
 * Clients — including nmap's service probe, which sends
 * `*1\r\n$4\r\ninfo\r\n` — speak RESP arrays rather than plain lines, so
 * splitting on whitespace would see "*1" and miss the command entirely.
 */
function redisCommand(data) {
  const text = data.toString('utf8');
  if (text.startsWith('*')) {
    const parts = text.split('\r\n').filter((line) => line && !/^[*$]/.test(line));
    return (parts[0] || '').toUpperCase();
  }
  return text.trim().split(/\s+/)[0].toUpperCase();
}

/**
 * Each decoy: a banner sent on connect, and/or a reply function for input.
 * `reply` returns a Buffer/string to send, or null to stay silent.
 */
const SERVICES = {
  2222: {
    name: 'ssh',
    // OpenSSH announces itself before the client says anything.
    banner: 'SSH-2.0-OpenSSH_7.6p1 Ubuntu-4ubuntu0.3\r\n',
    reply: () => null,
    closeAfterMs: 4000,
  },

  3306: {
    name: 'mysql',
    banner: mysqlGreeting(),
    // Any login attempt gets the "host is not allowed" error a locked-down
    // MySQL would send — plausible, and nothing to log into.
    reply: () => {
      const message = "Host is not allowed to connect to this MySQL server";
      const payload = Buffer.concat([
        Buffer.from([0xff, 0x79, 0x04]), // error packet, code 1130
        Buffer.from(message, 'ascii'),
      ]);
      const header = Buffer.alloc(4);
      header.writeUIntLE(payload.length, 0, 3);
      header[3] = 2;
      return Buffer.concat([header, payload]);
    },
    closeAfterMs: 4000,
  },

  6379: {
    name: 'redis',
    // Redis is silent until spoken to; nmap's probes get RESP replies back.
    banner: null,
    reply: (data) => {
      const command = redisCommand(data);
      if (command === 'PING') return '+PONG\r\n';
      if (command === 'INFO') return `$${REDIS_INFO.length}\r\n${REDIS_INFO}\r\n`;
      if (command === 'QUIT') return '+OK\r\n';
      if (!command) return "-ERR unknown command ''\r\n";
      return `-ERR unknown command '${command.replace(/[^\w-]/g, '')}'\r\n`;
    },
    closeAfterMs: 4000,
  },

  9999: {
    name: 'dispo-gateway',
    // A forgotten legacy service: the kind of thing that survives a relaunch
    // because nobody remembers what it does. Carries the stage flag, so the
    // flag rewards a banner grab (-sV / nc), not just a port state.
    banner: [
      'VeloRapid Dispo-Gateway v1.2',
      'Legacy-Schnittstelle - nur fuer interne Systeme.',
      'Status: OK. Letzte Synchronisation: 2019-11-04 08:15:02',
      '',
      `HINWEIS: Die Weboberflaeche laeuft auf Port ${WEB_PORT}.`,
      `FLAG=${FLAG}`,
      '',
    ].join('\r\n'),
    reply: () => null,
    // Greet, then hang up — the way legacy banner daemons behave, and the
    // reason a version scan of this host finishes in seconds. An interactive
    // service that answers every probe without ever matching a fingerprint
    // makes nmap work through its entire probe set: measured at 154s for this
    // one port, against ~1s like this.
    closeAfterBanner: true,
    closeAfterMs: 4000,
  },
};

const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);

function listen(port, service) {
  const server = net.createServer((socket) => {
    const peer = socket.remoteAddress ? socket.remoteAddress.replace('::ffff:', '') : '?';
    console.log(`${stamp()}  ${String(port).padEnd(5)} ${service.name.padEnd(14)} connect from ${peer}`);

    // A scanner that hangs up mid-handshake is normal; never let it crash us.
    socket.on('error', () => {});
    socket.setTimeout(service.closeAfterMs, () => socket.destroy());

    if (service.banner) socket.write(service.banner);
    if (service.closeAfterBanner) return socket.end();

    socket.on('data', (data) => {
      const reply = service.reply(data);
      if (reply) socket.write(reply);
      if (data.toString('utf8').trim().toUpperCase().startsWith('QUIT')) socket.end();
    });
  });

  server.on('error', (err) => {
    console.error(`${stamp()}  port ${port} (${service.name}): ${err.message}`);
    if (err.code === 'EADDRINUSE') process.exitCode = 1;
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`${stamp()}  listening on ${port} (${service.name})`);
  });
}

console.log('VeloRapid decoy services (banners only - no real services behind them)');
for (const [port, service] of Object.entries(SERVICES)) listen(Number(port), service);
