const fs = require('fs');
let c = fs.readFileSync('server.ts', 'utf8');

if (!c.includes("db.function('unaccent'")) {
    c = c.replace(
        "db.pragma('journal_mode = WAL');",
        "db.pragma('journal_mode = WAL');\ndb.function('unaccent', (str) => typeof str === 'string' ? str.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase() : '');"
    );
}

fs.writeFileSync('server.ts', c);
