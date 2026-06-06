const fs = require('fs');
let c = fs.readFileSync('server.ts', 'utf8');

c = c.replace(
  '                 // We keep the exact API response without hidden deletion/filtration\n                 items.push({',
  `                 // Diagnóstico - Valor Estimado Fallback
                 let originalValue = item.valor_global || 0;
                 let cnpj = item.orgao_cnpj;
                 let ano = item.ano;
                 let seq = item.numero_sequencial;
                 
                 let valueSource = originalValue ? "Contratação" : "Não informado";
                 let estimatedValue = originalValue;
                 let apiUrl = item.item_url ? \\\`https://pncp.gov.br\${item.item_url}\\\` : '';
                 let apiField = originalValue ? "valor_global" : "Nenhum";

                 if (!originalValue && cnpj && ano && seq) {
                    try {
                       const detailUrl = \\\`https://pncp.gov.br/api/consulta/v1/orgaos/\${cnpj}/compras/\${ano}/\${seq}\\\`;
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
                             const itensUrl = \\\`https://pncp.gov.br/api/pncp/v1/orgaos/\${cnpj}/compras/\${ano}/\${seq}/itens\\\`;
                             apiUrl = itensUrl;
                             const itensRes = await fetch(itensUrl, { headers: { 'Accept': 'application/json' } });
                             if (itensRes.ok) {
                                const itensData = await itensRes.json();
                                let soma = 0;
                                if (Array.isArray(itensData)) {
                                   for(const it of itensData) {
                                      soma += (Number(it.valorTotal) || Number(it.valorUnitarioEstimado * it.quantidade) || 0);
                                   }
                                }
                                if (soma > 0) {
                                   estimatedValue = soma;
                                   valueSource = "Itens";
                                   apiField = "Soma valorTotal";
                                }
                             }
                          }
                       }
                    } catch (e) {
                       // ignore
                    }
                 }

                 items.push({`
);

c = c.replace(
  "                   estimatedValue: item.valor_global || 0,\n                   status: item.situacao_nome || 'Divulgada no PNCP',",
  `                   estimatedValue: estimatedValue || 0,
                   originalApiValue: originalValue,
                   valueSource: valueSource,
                   apiField: apiField,
                   apiUrl: apiUrl,
                   status: item.situacao_nome || 'Divulgada no PNCP',`
);

fs.writeFileSync('server.ts', c);
console.log('Patch complete.');
