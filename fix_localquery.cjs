const fs = require('fs');
let c = fs.readFileSync('server.ts', 'utf8');

c = c.replace(
`      let localQuery = 'SELECT * FROM bids WHERE 1=1';
      if (q) {
         localQuery += \` AND (unaccent(organ) LIKE unaccent('%' || ? || '%') OR unaccent(object) LIKE unaccent('%' || ? || '%') OR unaccent(items) LIKE unaccent('%' || ? || '%'))\`;
         params.push(q, q, q);
      }
      let params: any[] = [];
      if (q) {
        localQuery += ' AND (object LIKE ? OR items LIKE ? OR organ LIKE ? OR id LIKE ?)';
        params.push(\`%\${q}%\`, \`%\${q}%\`, \`%\${q}%\`, \`%\${q}%\`);
      }`,
`      let localQuery = 'SELECT * FROM bids WHERE 1=1';
      let params: any[] = [];
      if (q) {
         localQuery += \` AND (unaccent(organ) LIKE unaccent('%' || ? || '%') OR unaccent(object) LIKE unaccent('%' || ? || '%') OR unaccent(items) LIKE unaccent('%' || ? || '%'))\`;
         params.push(q, q, q);
      }`
);

fs.writeFileSync('server.ts', c);
