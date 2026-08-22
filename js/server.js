'use strict';

// Entrada legada preservada: delega ao servidor unico da raiz para manter
// os mesmos aliases, endpoints, banco local e compartilhamento seguro.
const localServer = require('../server');

if (require.main === module) localServer.startServer();

module.exports = localServer;
