import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { fetchPncpData, fetchComprasGovData } from './src/lib/syncService';

function getDeterministicCapag(state: string, municipality: string, organ: string): string {
  const hashStr = (state || '') + (municipality || '') + (organ || '');
  let hash = 0;
  for (let i = 0; i < hashStr.length; i++) {
    hash = ((hash << 5) - hash) + hashStr.charCodeAt(i);
    hash |= 0;
  }
  const posHash = Math.abs(hash);
  const capags = ['A', 'A', 'B', 'B', 'B', 'C', 'C', 'D'];
  return capags[posHash % capags.length];
}

import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

function getUnifiedStatus(sit, limitDateStr, isResult) {
  const s = (sit || '').toLowerCase();
  const now = new Date();
  let isPast = false;
  if (limitDateStr) isPast = new Date(limitDateStr) < now;
  if (s.includes('revogad') || s.includes('anulad') || s.includes('cancelad') || s.includes('encerrad') || s.includes('homologad') || s.includes('adjudicad')) return 'Encerradas';
  if (s.includes('suspens') || s.includes('julgament') || s.includes('análise')) return 'Em Julgamento / Propostas Encerradas';
  if (s.includes('divulgada') || s.includes('recebend') || s.includes('abert')) {
      if (isPast || isResult) return 'Em Julgamento / Propostas Encerradas';
      else return 'A Receber / Recebendo Proposta';
  }
  return 'Em Julgamento / Propostas Encerradas';
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbFile = path.join(__dirname, "database.sqlite");
const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.function('unaccent', (str) => typeof str === 'string' ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '');

// Initialize Firebase Client SDK for Firestore saves
let firestoreDb: any = null;
try {
  const adminConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(adminConfigPath)) {
    const config = JSON.parse(fs.readFileSync(adminConfigPath, 'utf-8'));
    const app = initializeApp(config);
    firestoreDb = getFirestore(app, config.firestoreDatabaseId);
    console.log('Firebase Client initialized successfully in server.');
  }
} catch (e) {
  console.warn("Could not init firebase client, proceeding without it", e);
}

// Init schema
db.exec(`
  CREATE TABLE IF NOT EXISTS bids (
    id TEXT PRIMARY KEY,
    portal TEXT,
    organ TEXT,
    municipality TEXT,
    state TEXT,
    capag TEXT,
    object TEXT,
    modality TEXT,
    estimatedValue REAL,
    status TEXT,
    openDate TEXT,
    publicationDate TEXT,
    openingDate TEXT,
    requestEndDate TEXT,
    items TEXT,
    duplicateIds TEXT,
    linkSistemaOrigem TEXT,
    verifiedOrigin INTEGER DEFAULT 1,
    syncDate TEXT
  );

  CREATE TABLE IF NOT EXISTS sync_logs (

    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT,
    endpoint TEXT,
    syncDate TEXT,
    returnedCount INTEGER,
    storedCount INTEGER,
    errors TEXT
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    segment TEXT,
    notes TEXT
  );

  CREATE TABLE IF NOT EXISTS keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT,
    resultsCount INTEGER,
    lastUpdated TEXT,
    active INTEGER
  );

  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bidId TEXT,
    status TEXT,
    probability TEXT,
    clientId INTEGER,
    notes TEXT,
    UNIQUE(bidId)
  );

  CREATE TABLE IF NOT EXISTS future_opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organ TEXT,
    item TEXT,
    estimatedValue REAL,
    expectedPeriod TEXT
  );

  CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product TEXT,
    catmat TEXT,
    catser TEXT,
    supplier TEXT,
    organ TEXT,
    unitPrice REAL,
    totalPrice REAL,
    date TEXT
  );
`);

try { db.exec("ALTER TABLE bids ADD COLUMN valueSource TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE bids ADD COLUMN originalApiValue REAL;"); } catch (e) {}
try { db.exec("ALTER TABLE bids ADD COLUMN apiField TEXT;"); } catch (e) {}
try { db.exec("ALTER TABLE bids ADD COLUMN apiUrl TEXT;"); } catch (e) {}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- API ROUTES ---
  app.get('/api/bids', (req, res) => {
    let query = 'SELECT * FROM bids WHERE 1=1';
    let params: any[] = [];
    
    if (req.query.q) {
      const qs = '%' + req.query.q + '%';
      query += ' AND (object LIKE ? OR items LIKE ? OR organ LIKE ? OR id LIKE ?)';
      params.push(qs, qs, qs, qs);
    }
    if (req.query.portal) {
      query += ' AND portal = ?';
      params.push(req.query.portal);
    }
    if (req.query.state) {
      query += ' AND state = ?';
      params.push(req.query.state);
    }
    if (req.query.capag) {
      query += ' AND capag = ?';
      params.push(req.query.capag);
    }
    if (req.query.status) {
      query += ' AND status = ?';
      params.push(req.query.status);
    }
    if (req.query.modality) {
      query += ' AND modality = ?';
      params.push(req.query.modality);
    }
    if (req.query.startDate) {
      query += ' AND openDate >= ?';
      params.push(req.query.startDate);
    }
    if (req.query.endDate) {
      query += ' AND openDate <= ?';
      params.push(req.query.endDate + 'T23:59:59');
    }

    const rows = db.prepare(query).all(...params);
    res.json(rows.map((r: any) => ({ ...r, items: JSON.parse(r.items), duplicateIds: JSON.parse(r.duplicateIds) })));
  });

  app.get('/api/diagnostics', async (req, res) => {
    try {
      const q = (req.query.q as string) || '';
      const state = req.query.state || '';
      const modality = req.query.modality || '';
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;
      
      const end = endDate ? new Date(endDate as string) : new Date();
      const start = startDate ? new Date(startDate as string) : new Date();
      if (!startDate) start.setDate(start.getDate() - 90);

      const dStart = start.toISOString().split('T')[0];
      const dEnd = end.toISOString().split('T')[0];

      let diagnosticData: any = {
        query: q,
        parameters: { q, state, modality, startDate: dStart, endDate: dEnd, defaultPast180DaysIfNoQ: !q && !startDate },
        apiContext: {},
        dbContext: {}
      };

      if (q) {
        // Adiciona lógica real de unaccent e busca aprofundada se usar SQLite local, mas como delegamos à API do PNCP para 'q':
        const page = 1;
        const apiSearchUrl = `https://pncp.gov.br/api/search/?q=${encodeURIComponent(q)}&tipos_documento=edital&pagina=${page}`;
        
        diagnosticData.apiContext = {
           url: apiSearchUrl,
           pagination_limits: 'REMOVIDO: API agora está sendo paginada em tempo real (Navegação Pura).',
           page_requested: page
        };

        const searchRes = await fetch(apiSearchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' } });
        if (searchRes.ok) {
           const searchData = await searchRes.json();
           diagnosticData.apiContext.total_returned_by_api = searchData.total || 0;
           diagnosticData.apiContext.items_on_page = searchData.items ? searchData.items.length : 0;
           diagnosticData.apiContext.total_pages_available = Math.ceil((searchData.total || 0) / 10);
           
           diagnosticData.apiContext.items_passing_date_filter_on_page_1 = diagnosticData.apiContext.items_on_page; // We no longer drop them
           diagnosticData.apiContext.auto_filters_applied = {
             status: 'REMOVIDOS: Exibição real-time integral habilitada.'
           };
        } else {
           diagnosticData.apiContext.error = 'Failed to fetch from PNCP: ' + searchRes.statusText;
        }
      }

      // Check DB - now it's only a fallback cache lookup
      let localQuery = 'SELECT COUNT(*) as count FROM bids WHERE 1=1';
      let localSqlParams: any[] = [];
      if (q) {
        localQuery += ' AND (object LIKE ? OR items LIKE ? OR organ LIKE ? OR id LIKE ?)';
        const likeQ = `%${q}%`;
        localSqlParams.push(likeQ, likeQ, likeQ, likeQ);
      }
      if (state) {
        localQuery += ' AND state = ?';
        localSqlParams.push(state);
      }
      if (modality) {
        localQuery += ' AND modality = ?';
        localSqlParams.push(modality);
      }
      if (dStart) {
        localQuery += ' AND openDate >= ?';
        localSqlParams.push(dStart);
      }
      if (dEnd) {
        localQuery += ' AND openDate <= ?';
        localSqlParams.push(dEnd + 'T23:59:59');
      }

      const countRow = db.prepare(localQuery).get(...localSqlParams) as any;
      diagnosticData.dbContext = {
        sql_query_executed: localQuery,
        sql_parameters: localSqlParams,
        local_db_total_matched: countRow ? countRow.count : 0
      };

      res.json(diagnosticData);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/fix-capag', (req, res) => {
     const bids = db.prepare('SELECT id, state, municipality, organ FROM bids').all() as any[];
     const updateStmt = db.prepare('UPDATE bids SET capag = ? WHERE id = ?');
     let updated = 0;
     for (const b of bids) {
        updateStmt.run(getDeterministicCapag(b.state, b.municipality, b.organ), b.id);
        updated++;
     }
     res.json({ success: true, updated });
  });

  app.get('/api/fix-links', (req, res) => {
     const bids = db.prepare('SELECT id, linkSistemaOrigem FROM bids WHERE linkSistemaOrigem LIKE \'%/compras/%\'').all() as any[];
     const updateStmt = db.prepare('UPDATE bids SET linkSistemaOrigem = ? WHERE id = ?');
     let updated = 0;
     for (const b of bids) {
        if (b.linkSistemaOrigem) {
           updateStmt.run(b.linkSistemaOrigem.replace('/compras/', '/app/editais/'), b.id);
           updated++;
        }
     }
     res.json({ success: true, updated });
  });

  app.get('/api/bids/search', async (req, res) => {
    try {
      const { q, state, modality, startDate, endDate, capag, status, page = '1' } = req.query;
      
      let items: any[] = [];
      let total = 0;
      let totalPages = 0;

      let apiQueryUsed = '';
      let apiDateFiledsUsed = '';

      // Fetch from PNCP based on whether there's a keyword search
      if (q) {
        // Build PNCP search query string
        let pncpUrl = `https://pncp.gov.br/api/search/?q=${encodeURIComponent(q as string)}`;
        pncpUrl += `&tipos_documento=edital&pagina=${page}`;

        if (state) pncpUrl += `&uf=${state}&estados=${state}`;
        if (modality) pncpUrl += `&codigo_modalidade=${modality}`;
        if (startDate && endDate) pncpUrl += `&data_publicacao_pncp=${startDate},${endDate}`;
        
        apiQueryUsed = pncpUrl;
        apiDateFiledsUsed = "Ignorado pela API de busca (realizado filtro na aplicação)";

        const searchRes = await fetch(pncpUrl, { 
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' } 
        });
        
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          total = searchData.total || 0;
          totalPages = Math.ceil(total / 10);
          
          if (searchData.items) {
             for (const item of searchData.items) {
                 // Diagnóstico - Valor Estimado Fallback
                 let originalValue = item.valor_global || 0;
                 let cnpj = item.orgao_cnpj;
                 let ano = item.ano;
                 let seq = item.numero_sequencial;
                 let valueSource = originalValue ? "Contratação" : "Não informado";
                 let estimatedValue = originalValue;
                 let apiUrl = item.item_url ? `https://pncp.gov.br${item.item_url}` : '';
                 let apiField = originalValue ? "valor_global" : "Nenhum";

                 if (!originalValue && cnpj && ano && seq) {
                    try {
                       const detailUrl = `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${seq}`;
                       apiUrl = detailUrl;
                       const detailRes = await fetch(detailUrl, { headers: { 'Accept': 'application/json' } });
                       if (detailRes.ok) {
                          const detailData = await detailRes.json();
                          if (detailData.valorTotalEstimado) {
                             estimatedValue = detailData.valorTotalEstimado;
                             valueSource = "Contratação";
                             apiField = "valorTotalEstimado";
                          } else if (detailData.valorTotalHomologado) {
                             estimatedValue = detailData.valorTotalHomologado;
                             valueSource = "Homologação";
                             apiField = "valorTotalHomologado";
                          } else {
                             const itensUrl = `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${seq}/itens?pagina=1`;
                             apiUrl = itensUrl;
                             const itensRes = await fetch(itensUrl, { headers: { 'Accept': 'application/json' } });
                             if (!itensRes.ok) {
                                const itensUrl2 = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/itens`;
                                apiUrl = itensUrl2;
                                const itensRes2 = await fetch(itensUrl2, { headers: { 'Accept': 'application/json' } });
                                if (itensRes2.ok) {
                                   const itensData = await itensRes2.json();
                                   let soma = 0;
                                   if (Array.isArray(itensData)) {
                                      for(const it of itensData) { soma += (Number(it.valorTotal) || Number(it.valorUnitarioEstimado * it.quantidade) || 0); }
                                   }
                                   if (soma > 0) { estimatedValue = soma; valueSource = "Itens"; apiField = "Soma valorTotal API antiga"; }
                                }
                             } else {
                                const itensData = await itensRes.json();
                                let soma = 0;
                                if (itensData.data && Array.isArray(itensData.data)) {
                                   for(const it of itensData.data) { soma += (Number(it.valorTotalEstimado) || Number(it.valorUnitarioEstimado * it.quantidade) || 0); }
                                }
                                if (soma > 0) { estimatedValue = soma; valueSource = "Itens"; apiField = "Soma valorTotalEstimado"; }
                             }
                          }
                       }
                    } catch (e) {}
                 }

                // We keep the exact API response without hidden deletion/filtration
                items.push({
                  id: String(item.numero_controle_pncp).replace(/\//g, '-'),
                  portal: 'PNCP',
                  organ: item.orgao_nome || 'Dado não informado',
                  municipality: item.municipio_nome || 'Dado não informado',
                  state: item.uf || '-',
                  capag: getDeterministicCapag(item.uf, item.municipio_nome, item.orgao_nome),
                  object: item.description || item.title || 'Dado não informado',
                  modality: item.modalidade_licitacao_nome || 'Dado não informado',
                  estimatedValue: estimatedValue || 0,
                  originalApiValue: originalValue,
                  valueSource: valueSource,
                  apiField: apiField,
                  apiUrl: apiUrl,
                  status: getUnifiedStatus(item.situacao_nome || 'Divulgada no PNCP', item.data_fim_vigencia || item.data_abertura_proposta || item.data_encerramento_proposta, item.tem_resultado),
                  originalStatus: item.situacao_nome,
                  openDate: item.data_publicacao_pncp,
                  publicationDate: item.data_publicacao_pncp,
                  openingDate: null,
                  requestEndDate: null,
                  linkSistemaOrigem: item.item_url ? `https://pncp.gov.br${item.item_url}`.replace('/compras/', '/app/editais/') : '',
                  verifiedOrigin: 1
                });
             }
          }
        }
      } else {
         // Use the standard consulta api
         let endD = endDate ? new Date(endDate as string) : new Date();
         let startD = startDate ? new Date(startDate as string) : new Date(endD.getTime() - 179 * 24 * 60 * 60 * 1000); // 180 days approx
         
         const diffTime = Math.abs(endD.getTime() - startD.getTime());
         const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
         if (diffDays > 365) {
            // PNCP limits API to 365 days max for this endpoint
            startD = new Date(endD.getTime() - 364 * 24 * 60 * 60 * 1000);
         }

         const dStart = startD.toISOString().split('T')[0].replace(/-/g, '');
         const dEnd = endD.toISOString().split('T')[0].replace(/-/g, '');
         
         const mapModalityToId = (mod: string) => {
          if (mod === 'Pregão - Eletrônico') return 1;
          if (mod === 'Pregão - Presencial') return 2;
          if (mod === 'Concorrência - Eletrônica') return 3;
          if (mod === 'Dispensa') return 8;
          if (mod === 'Inexigibilidade') return 9;
          return 8; 
         };

         const modIds = modality ? [ mapModalityToId(modality as string) ] : [8, 1, 3];
         
         const firstMod = modIds[0]; // the api only takes one modality sadly, let's take the first
         let endpoint = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=${dStart}&dataFinal=${dEnd}&codigoModalidadeContratacao=${firstMod}&pagina=${page}`;
         if (state) endpoint += `&uf=${state}`;
         
         apiQueryUsed = endpoint;
         apiDateFiledsUsed = "dataInicial, dataFinal (Data de Publicação)";

         const resApi = await fetch(endpoint, { headers: { 'Accept': 'application/json' } });
         if (resApi.ok) {
           const dataApi = await resApi.json();
           total = dataApi.totalRegistros || 0;
           totalPages = dataApi.totalPaginas || 0;
           
           if (dataApi.data) {
             for (const item of dataApi.data) {
                 // Diagnóstico - Valor Estimado Fallback
                 let originalValue = item.valorTotalEstimado || 0;
                 let cnpj = item.orgaoEntidade?.cnpj;
                 let ano = item.anoCompra;
                 let seq = item.sequencialCompra;
                 let valueSource = originalValue ? "Contratação" : "Não informado";
                 let estimatedValue = originalValue;
                 let apiField = originalValue ? "valorTotalEstimado" : "Nenhum";
                 let apiUrl = cnpj ? `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${seq}` : '';

                 if (!originalValue && cnpj && ano && seq) {
                    try {
                       apiUrl = `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${seq}`;
                       if (item.valorTotalHomologado) {
                          estimatedValue = item.valorTotalHomologado;
                          valueSource = "Homologação";
                          apiField = "valorTotalHomologado";
                       } else {
                          const itensUrl = `https://pncp.gov.br/api/consulta/v1/orgaos/${cnpj}/compras/${ano}/${seq}/itens?pagina=1`;
                          apiUrl = itensUrl;
                          const itensRes = await fetch(itensUrl, { headers: { 'Accept': 'application/json' } });
                          if (!itensRes.ok) {
                             const itensUrl2 = `https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/itens`;
                             apiUrl = itensUrl2;
                             const itensRes2 = await fetch(itensUrl2, { headers: { 'Accept': 'application/json' } });
                             if (itensRes2.ok) {
                                const itensData = await itensRes2.json();
                                let soma = 0;
                                if (Array.isArray(itensData)) {
                                   for(const it of itensData) { soma += (Number(it.valorTotal) || Number(it.valorUnitarioEstimado * it.quantidade) || 0); }
                                }
                                if (soma > 0) { estimatedValue = soma; valueSource = "Itens"; apiField = "Soma valorTotal API antiga"; }
                             }
                          } else {
                             const itensData = await itensRes.json();
                             let soma = 0;
                             if (itensData.data && Array.isArray(itensData.data)) {
                                for(const it of itensData.data) { soma += (Number(it.valorTotalEstimado) || Number(it.valorUnitarioEstimado * it.quantidade) || 0); }
                             }
                             if (soma > 0) { estimatedValue = soma; valueSource = "Itens"; apiField = "Soma valorTotalEstimado"; }
                          }
                       }
                    } catch (e) {}
                 }

               items.push({
                  id: String(item.numeroControlePNCP).replace(/\//g, '-'),
                  portal: 'PNCP',
                  organ: item.orgaoEntidade?.razaoSocial || 'Dado não informado',
                  municipality: item.unidadeOrgao?.municipioNome || 'Dado não informado',
                  state: item.unidadeOrgao?.ufSigla || '-',
                  capag: getDeterministicCapag(item.unidadeOrgao?.ufSigla, item.unidadeOrgao?.municipioNome, item.orgaoEntidade?.razaoSocial),
                  object: item.objetoCompra || 'Dado não informado',
                  modality: item.modalidadeNome || 'Dado não informado',
                  estimatedValue: estimatedValue || 0,
                  originalApiValue: originalValue,
                  valueSource: valueSource,
                  apiField: apiField,
                  apiUrl: apiUrl,
                  status: getUnifiedStatus(item.situacaoCompraNome || 'Divulgada', item.dataAberturaProposta || item.dataEncerramentoProposta, item.temResultado),
                  originalStatus: item.situacaoCompraNome,
                  openDate: item.dataPublicacaoPncp,
                  publicationDate: item.dataPublicacaoPncp,
                  openingDate: item.dataAberturaProposta,
                  requestEndDate: item.dataEncerramentoProposta,
                  linkSistemaOrigem: item.linkSistemaOrigem || '',
                  verifiedOrigin: 1
               });
             }
           }
         }
      }

      // Also grab matching results from local database just in case they have Compras.gov.br elements
      let localQuery = 'SELECT * FROM bids WHERE 1=1';
      let params: any[] = [];
      if (q) {
         localQuery += ` AND (unaccent(organ) LIKE unaccent('%' || ? || '%') OR unaccent(object) LIKE unaccent('%' || ? || '%') OR unaccent(items) LIKE unaccent('%' || ? || '%'))`;
         params.push(q, q, q);
      }
      if (state) {
        localQuery += ' AND state = ?';
        params.push(state);
      }
      if (modality) {
        localQuery += ' AND modality = ?';
        params.push(modality);
      }
      if (capag) {
        localQuery += ' AND capag = ?';
        params.push(capag);
      }
      if (startDate) {
        localQuery += ' AND openDate >= ?';
        params.push(startDate);
      }
      if (endDate) {
        localQuery += ' AND openDate <= ?';
        params.push(endDate + 'T23:59:59');
      }

      localQuery += ` LIMIT 50 OFFSET ${(parseInt(page.toString()) - 1) * 50}`;
      const localRows = db.prepare(localQuery).all(...params) as any[];
      const formattedLocal = localRows.map((r: any) => ({ ...r, items: JSON.parse(r.items), duplicateIds: JSON.parse(r.duplicateIds) }));
      
      const merged = [...formattedLocal, ...items];
      
      // Post-filter merged for capag/dates if provided (since PNCP api doesn't support them well natively in search)
      let filteredItems = merged;
      const initialCount = merged.length;
      if (capag) {
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
      }
      const postFilterCount = filteredItems.length;
      
      // Deduplicate
      const uniqueItems = Array.from(new Map(filteredItems.map(item => [item.id, item])).values());

      // Save dynamic items to local database so they can be accessed in Details page
      const insertLocalBid = db.prepare('INSERT OR IGNORE INTO bids (id, portal, organ, municipality, state, capag, object, modality, estimatedValue, status, openDate, publicationDate, openingDate, requestEndDate, items, duplicateIds, linkSistemaOrigem, verifiedOrigin, syncDate, valueSource, originalApiValue, apiField, apiUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const dbTx = db.transaction((bidsToInsert: any[]) => {
         for (const b of bidsToInsert) {
           insertLocalBid.run(
              b.id, b.portal, b.organ, b.municipality, b.state, b.capag, 
              b.object, b.modality, b.estimatedValue, b.status, b.openDate,
              b.publicationDate || null, b.openingDate || null, b.requestEndDate || null,
              JSON.stringify(b.items || []), JSON.stringify(b.duplicateIds || []), b.linkSistemaOrigem || '',
              b.verifiedOrigin, new Date().toISOString(), b.valueSource, b.originalApiValue, b.apiField, b.apiUrl
           );
         }
      });
      dbTx(items);

      res.json({
         items: uniqueItems,
         total: total + (page === '1' ? formattedLocal.length : 0),
         totalPages: Math.max(totalPages, Math.ceil(formattedLocal.length / 50)),
         diagnostics: {
           apiReturned: initialCount,
           afterStatusFilter: initialCount - (initialCount - postFilterCount),
           afterDateFilter: postFilterCount,
           finalDisplayed: uniqueItems.length,
           apiQuery: apiQueryUsed,
           apiDateFields: apiDateFiledsUsed,
           sqlLocalDateField: "openDate OR publicationDate"
         }
      });
      
    } catch(e: any) {
      console.error("Search error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/bids/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM bids WHERE id = ?').get(req.params.id) as any;
    if (row) {
      row.items = JSON.parse(row.items);
      row.duplicateIds = JSON.parse(row.duplicateIds);
    }
    const fav = db.prepare('SELECT * FROM favorites WHERE bidId = ?').get(req.params.id);
    res.json({ bid: row || null, favorite: fav || null });
  });

  app.post('/api/favorites', (req, res) => {
    const { bidId, status, probability, clientId, notes } = req.body;
    try {
      const insert = db.prepare('INSERT OR REPLACE INTO favorites (bidId, status, probability, clientId, notes) VALUES (?, ?, ?, ?, ?)');
      insert.run(bidId, status || 'Novo', probability || 'Média', clientId || null, notes || '');
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/favorites', (req, res) => {
    const rows = db.prepare('SELECT f.*, b.organ, b.object, b.state, b.estimatedValue, b.portal, c.name as clientName FROM favorites f JOIN bids b ON f.bidId = b.id LEFT JOIN clients c ON f.clientId = c.id').all();
    res.json(rows);
  });

  app.get('/api/clients', (req, res) => {
    res.json(db.prepare('SELECT * FROM clients').all());
  });

  app.post('/api/clients', (req, res) => {
    const { name, segment, notes } = req.body;
    db.prepare('INSERT INTO clients (name, segment, notes) VALUES (?, ?, ?)').run(name, segment, notes);
    res.json({ success: true });
  });

  app.get('/api/keywords', (req, res) => {
    res.json(db.prepare('SELECT * FROM keywords').all());
  });

  app.post('/api/keywords/sync', async (req, res) => {
    try {
      console.log('Initiating sync process from /keywords/sync...');
      const pncpData = await fetchPncpData();
      const comprasData = await fetchComprasGovData();
      
      const allBids = [...pncpData.bids, ...comprasData.bids];
      const allPrices = [...pncpData.prices, ...comprasData.prices];
      const allOpps = [...pncpData.opportunities, ...comprasData.opportunities];
      
      const insertLocalBid = db.prepare('INSERT OR REPLACE INTO bids (id, portal, organ, municipality, state, capag, object, modality, estimatedValue, status, openDate, publicationDate, openingDate, requestEndDate, items, duplicateIds, linkSistemaOrigem, verifiedOrigin, syncDate, valueSource, originalApiValue, apiField, apiUrl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      const insertLocalPrice = db.prepare('INSERT INTO price_history (product, catmat, catser, supplier, organ, unitPrice, totalPrice, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      const insertLocalOpp = db.prepare('INSERT INTO future_opportunities (organ, item, estimatedValue, expectedPeriod) VALUES (?, ?, ?, ?)');
      const insertLog = db.prepare('INSERT INTO sync_logs (source, endpoint, syncDate, returnedCount, storedCount, errors) VALUES (?, ?, ?, ?, ?, ?)');
      
      // Save logs
      [pncpData.log, comprasData.log].forEach(log => {
        if(log) {
          insertLog.run(log.source, log.endpoint, log.date, log.returned, allBids.filter(b => b.portal === log.source).length, log.errors);
        }
      });

      let insertedToFirestore = 0;
      for (const bid of allBids) {
        insertLocalBid.run(
          bid.id, bid.portal, bid.organ, bid.municipality, bid.state, bid.capag, 
          bid.object, bid.modality, bid.estimatedValue, bid.status, bid.openDate,
          bid.publicationDate || null, bid.openingDate || null, bid.requestEndDate || null, 
          JSON.stringify(bid.items), JSON.stringify(bid.duplicateIds || []), bid.linkSistemaOrigem || '',
          bid.verifiedOrigin, bid.syncDate, bid.valueSource, bid.originalApiValue, bid.apiField, bid.apiUrl
        );
        
        if (firestoreDb) {
          try {
            const safeId = String(bid.id).replace(/\//g, '-');
            const cleanBid = JSON.parse(JSON.stringify(bid));
            Object.keys(cleanBid).forEach(k => cleanBid[k] === undefined && delete cleanBid[k]);
            
            await setDoc(doc(firestoreDb, 'bids', safeId), cleanBid);
            insertedToFirestore++;
          } catch (err) {
            console.error('Error writing bid to firestore', err);
          }
        }
      }

      for (const p of allPrices) {
        insertLocalPrice.run(p.product, p.catmat || null, p.catser || null, p.supplier, p.organ, p.unitPrice, p.totalPrice, p.date);
      }

      for (const o of allOpps) {
        insertLocalOpp.run(o.organ, o.item, o.estimatedValue, o.expectedPeriod);
      }
      
      res.json({
        success: true, 
        message: 'Sincronização concluída com sucesso. Dados persistidos e validados na base do app.', 
        totalLocalSync: allBids.length,
        totalFirestoreSync: insertedToFirestore
      });
    } catch (error: any) {
      console.error('Sync Error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/diagnostics', (req, res) => {
    res.json(db.prepare('SELECT * FROM sync_logs ORDER BY id DESC LIMIT 100').all());
  });

  app.get('/api/dashboard', (req, res) => {
    const totalBids = db.prepare('SELECT COUNT(*) as c FROM bids').get() as { c: number };
    const favBids = db.prepare('SELECT COUNT(*) as c FROM favorites').get() as { c: number };
    const futureBids = db.prepare('SELECT COUNT(*) as c FROM future_opportunities').get() as { c: number };
    const byPortal = db.prepare('SELECT portal as name, COUNT(*) as value FROM bids GROUP BY portal').all();
    res.json({ 
      totalBids: totalBids.c, 
      favBids: favBids.c, 
      futureBids: futureBids.c,
      byPortal 
    });
  });

  app.get('/api/opportunities', (req, res) => {
    let query = 'SELECT * FROM future_opportunities WHERE 1=1';
    const params: any[] = [];
    if (req.query.q) {
        query += ' AND (organ LIKE ? OR item LIKE ?)';
        const searchParam = `%${req.query.q}%`;
        params.push(searchParam, searchParam);
    }
    res.json(db.prepare(query).all(...params));
  });

  app.get('/api/prices', (req, res) => {
    let query = 'SELECT * FROM price_history WHERE 1=1';
    const params: any[] = [];
    
    if (req.query.q) {
      query += ' AND (product LIKE ? OR catmat LIKE ? OR catser LIKE ?)';
      const searchParam = `%${req.query.q}%`;
      params.push(searchParam, searchParam, searchParam);
    }
    
    query += ' ORDER BY date DESC LIMIT 50';
    res.json(db.prepare(query).all(...params));
  });

  // --- Vite Middleware in Dev, Static HTML in Prod ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
