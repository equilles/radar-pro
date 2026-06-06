import fs from 'fs';
let c = fs.readFileSync('server.ts', 'utf8');

c = c.replace(
`             for (const item of searchData.items) {
                // We keep the exact API response without hidden deletion/filtration
                items.push({`,
`             for (const item of searchData.items) {
                 // Diagnóstico - Valor Estimado Fallback
                 let originalValue = item.valor_global || 0;
                 let cnpj = item.orgao_cnpj;
                 let ano = item.ano;
                 let seq = item.numero_sequencial;
                 let valueSource = originalValue ? "Contratação" : "Não informado";
                 let estimatedValue = originalValue;
                 let apiUrl = item.item_url ? \`https://pncp.gov.br\${item.item_url}\` : '';
                 let apiField = originalValue ? "valor_global" : "Nenhum";

                 if (!originalValue && cnpj && ano && seq) {
                    try {
                       const detailUrl = \`https://pncp.gov.br/api/consulta/v1/orgaos/\${cnpj}/compras/\${ano}/\${seq}\`;
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
                             const itensUrl = \`https://pncp.gov.br/api/consulta/v1/orgaos/\${cnpj}/compras/\${ano}/\${seq}/itens?pagina=1\`;
                             apiUrl = itensUrl;
                             const itensRes = await fetch(itensUrl, { headers: { 'Accept': 'application/json' } });
                             if (!itensRes.ok) { // v1 itens endpoint sometimes moved or not found, try the old one
                                const itensUrl2 = \`https://pncp.gov.br/api/pncp/v1/orgaos/\${cnpj}/compras/\${ano}/\${seq}/itens\`;
                                apiUrl = itensUrl2;
                                const itensRes2 = await fetch(itensUrl2, { headers: { 'Accept': 'application/json' } });
                                if (itensRes2.ok) {
                                   const itensData = await itensRes2.json();
                                   let soma = 0;
                                   if (Array.isArray(itensData)) {
                                      for(const it of itensData) { soma += (Number(it.valorTotal) || Number(it.valorUnitarioEstimado * it.quantidade) || 0); }
                                   }
                                   if (soma > 0) { estimatedValue = soma; valueSource = "Itens"; apiField = "Soma valorTotal"; }
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
                items.push({`
);

c = c.replace(
`                  estimatedValue: item.valor_global || 0,
                  status: item.situacao_nome || 'Divulgada no PNCP',`,
`                  estimatedValue: estimatedValue || 0,
                  originalApiValue: originalValue,
                  valueSource: valueSource,
                  apiField: apiField,
                  apiUrl: apiUrl,
                  status: item.situacao_nome || 'Divulgada no PNCP',`
);

c = c.replace(
`             for (const item of dataApi.data) {
               items.push({`,
`             for (const item of dataApi.data) {
                 // Diagnóstico - Valor Estimado Fallback
                 let originalValue = item.valorTotalEstimado || 0;
                 let cnpj = item.orgaoEntidade?.cnpj;
                 let ano = item.anoCompra;
                 let seq = item.sequencialCompra;
                 let valueSource = originalValue ? "Contratação" : "Não informado";
                 let estimatedValue = originalValue;
                 let apiField = originalValue ? "valorTotalEstimado" : "Nenhum";
                 let apiUrl = cnpj ? \`https://pncp.gov.br/api/consulta/v1/orgaos/\${cnpj}/compras/\${ano}/\${seq}\` : '';

                 if (!originalValue && cnpj && ano && seq) {
                    try {
                       if (item.valorTotalHomologado) {
                          estimatedValue = item.valorTotalHomologado;
                          valueSource = "Homologação";
                          apiField = "valorTotalHomologado";
                       } else {
                          const itensUrl = \`https://pncp.gov.br/api/consulta/v1/orgaos/\${cnpj}/compras/\${ano}/\${seq}/itens?pagina=1\`;
                          apiUrl = itensUrl;
                          const itensRes = await fetch(itensUrl, { headers: { 'Accept': 'application/json' } });
                          if (!itensRes.ok) {
                             const itensUrl2 = \`https://pncp.gov.br/api/pncp/v1/orgaos/\${cnpj}/compras/\${ano}/\${seq}/itens\`;
                             apiUrl = itensUrl2;
                             const itensRes2 = await fetch(itensUrl2, { headers: { 'Accept': 'application/json' } });
                             if (itensRes2.ok) {
                                const itensData = await itensRes2.json();
                                let soma = 0;
                                if (Array.isArray(itensData)) {
                                   for(const it of itensData) { soma += (Number(it.valorTotal) || Number(it.valorUnitarioEstimado * it.quantidade) || 0); }
                                }
                                if (soma > 0) { estimatedValue = soma; valueSource = "Itens"; apiField = "Soma valorTotal"; }
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

               items.push({`
);

c = c.replace(
`                  estimatedValue: item.valorTotalEstimado || 0,
                  status: item.situacaoCompraNome || 'Divulgada',`,
`                  estimatedValue: estimatedValue || 0,
                  originalApiValue: originalValue,
                  valueSource: valueSource,
                  apiField: apiField,
                  apiUrl: apiUrl,
                  status: item.situacaoCompraNome || 'Divulgada',`
);

// DB INSERT REPLACE 1
c = c.replace(
\`              b.object, b.modality, b.estimatedValue, b.status, b.openDate,
              b.publicationDate || null, b.openingDate || null, b.requestEndDate || null,
              JSON.stringify(b.items || []), JSON.stringify(b.duplicateIds || []), b.linkSistemaOrigem || '',
              b.verifiedOrigin, new Date().toISOString()
           );\`,
\`              b.object, b.modality, b.estimatedValue, b.status, b.openDate,
              b.publicationDate || null, b.openingDate || null, b.requestEndDate || null,
              JSON.stringify(b.items || []), JSON.stringify(b.duplicateIds || []), b.linkSistemaOrigem || '',
              b.verifiedOrigin, new Date().toISOString(), b.valueSource, b.originalApiValue, b.apiField, b.apiUrl
           );\`
);

c = c.replace(
\`          bid.object, bid.modality, bid.estimatedValue, bid.status, bid.openDate,
          bid.publicationDate || null, bid.openingDate || null, bid.requestEndDate || null, 
          JSON.stringify(bid.items), JSON.stringify(bid.duplicateIds || []), bid.linkSistemaOrigem || '',
          bid.verifiedOrigin, bid.syncDate
        );\`,
\`          bid.object, bid.modality, bid.estimatedValue, bid.status, bid.openDate,
          bid.publicationDate || null, bid.openingDate || null, bid.requestEndDate || null, 
          JSON.stringify(bid.items), JSON.stringify(bid.duplicateIds || []), bid.linkSistemaOrigem || '',
          bid.verifiedOrigin, bid.syncDate, bid.valueSource, bid.originalApiValue, bid.apiField, bid.apiUrl
        );\`
);

fs.writeFileSync('server.ts', c);
console.log('Patch complete.');
