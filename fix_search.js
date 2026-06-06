import fs from 'fs';

function buildPatch() {
  let c = fs.readFileSync('server.ts', 'utf8');

  if (!c.includes("function getUnifiedStatus")) {
    c = c.replace(
      "import { getFirestore, doc, setDoc } from \"firebase/firestore\";",
      "import { getFirestore, doc, setDoc } from \"firebase/firestore\";\n\nfunction getUnifiedStatus(sit, limitDateStr, isResult) {\n  const s = (sit || '').toLowerCase();\n  const now = new Date();\n  let isPast = false;\n  if (limitDateStr) isPast = new Date(limitDateStr) < now;\n  if (s.includes('revogad') || s.includes('anulad') || s.includes('cancelad') || s.includes('encerrad') || s.includes('homologad') || s.includes('adjudicad')) return 'Encerradas';\n  if (s.includes('suspens') || s.includes('julgament') || s.includes('análise')) return 'Em Julgamento / Propostas Encerradas';\n  if (s.includes('divulgada') || s.includes('recebend') || s.includes('abert')) {\n      if (isPast || isResult) return 'Em Julgamento / Propostas Encerradas';\n      else return 'A Receber / Recebendo Proposta';\n  }\n  return 'Em Julgamento / Propostas Encerradas';\n}"
    );
  }

  // Update backend search params inside /api/bids/search
  c = c.replace(
    "const { q, state, modality, startDate, endDate, capag, page = '1' } = req.query;",
    "const { q, state, modality, startDate, endDate, capag, status, page = '1' } = req.query;"
  );

  // Update backend status mapping
  c = c.replace(
    "status: item.situacao_nome || 'Divulgada no PNCP',",
    "status: getUnifiedStatus(item.situacao_nome || 'Divulgada no PNCP', item.data_fim_vigencia || item.data_abertura_proposta || item.data_encerramento_proposta, item.tem_resultado),\n                  originalStatus: item.situacao_nome,"
  );
  
  c = c.replace(
    "status: item.situacaoCompraNome || 'Divulgada',",
    "status: getUnifiedStatus(item.situacaoCompraNome || 'Divulgada', item.dataAberturaProposta || item.dataEncerramentoProposta, item.temResultado),\n                  originalStatus: item.situacaoCompraNome,"
  );

  // When searching locally (if PNCP api is not used, or if we filter after fetch):
  // Let's modify the filtering logic locally.
  const filterCodeToReplace = `      if (capag) {
         filteredItems = filteredItems.filter(item => item.capag === capag);
      }
      if (startDate) {
         filteredItems = filteredItems.filter(item => {
            const dt = item.publicationDate || item.openDate;
            return dt && dt >= startDate;
         });
      }
      if (endDate) {
         filteredItems = filteredItems.filter(item => {
            const dt = item.publicationDate || item.openDate;
            return dt && dt.substring(0, 10) <= endDate;
         });
      }`;

  const newFilterCode = `      if (capag) {
         filteredItems = filteredItems.filter(item => item.capag === capag);
      }
      if (status && status !== 'Todos') {
         filteredItems = filteredItems.filter(item => item.status === status);
      }
      if (startDate) {
         filteredItems = filteredItems.filter(item => {
            const dt = item.publicationDate || item.openDate;
            return dt && dt >= startDate;
         });
      }
      if (endDate) {
         filteredItems = filteredItems.filter(item => {
            const dt = item.publicationDate || item.openDate;
            return dt && dt.substring(0, 10) <= endDate;
         });
      }`;
  
  c = c.replace(filterCodeToReplace, newFilterCode);

  // Also replace search by query in localDB `bids` logic
  c = c.replace(
    "if (q) {",
    "if (q) {\n        // Adiciona lógica real de unaccent e busca aprofundada se usar SQLite local, mas como delegamos à API do PNCP para 'q':"
  );
  
  c = c.replace(
    "let localQuery = 'SELECT * FROM bids WHERE 1=1';",
    `let localQuery = 'SELECT * FROM bids WHERE 1=1';
      if (q) {
         localQuery += \` AND (unaccent(organ) LIKE unaccent('%' || ? || '%') OR unaccent(object) LIKE unaccent('%' || ? || '%') OR unaccent(items) LIKE unaccent('%' || ? || '%'))\`;
         params.push(q, q, q);
      }`
  )

  fs.writeFileSync('server.ts', c);
  console.log('patched');
}

buildPatch();
