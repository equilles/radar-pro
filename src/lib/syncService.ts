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

export async function fetchPncpData() {
  const endpoint = 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao';
  const today = new Date();
  const past = new Date();
  past.setDate(today.getDate() - 3);
  const dataFinal = today.toISOString().split('T')[0].replace(/-/g, '');
  const dataInicial = past.toISOString().split('T')[0].replace(/-/g, '');
  
  // Modalities: 8=Pregão eletrônico, 6=Dispensa
  const modalities = [8, 6];
  let allBids: any[] = [];
  const log = { source: 'PNCP', endpoint: `${endpoint}?dataInicial=${dataInicial}&dataFinal=${dataFinal}`, date: new Date().toISOString(), returned: 0, stored: 0, errors: '' };

  try {
    for (const mod of modalities) {
      const finalEndpoint = `${endpoint}?dataInicial=${dataInicial}&dataFinal=${dataFinal}&codigoModalidadeContratacao=${mod}&pagina=1`;
      const res = await fetch(finalEndpoint);
      if (res.status === 204) continue;
      if (!res.ok) throw new Error(`Status ${res.status}: ${res.statusText}`);
      
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch(e) {
        throw new Error("Invalid JSON from PNCP: " + text.slice(0, 50));
      }
      const itemsArray = Array.isArray(data) ? data : (data?.data || []);
      
      // Select top 10 items per modality to avoid slowing down sync too much since we fetch items sequentially
      const topItems = itemsArray.slice(0, 10);
      
      const parsedWithItems = await Promise.all(topItems.map(async (item: any) => {
        let itemsResult = [];
        try {
          const cnpj = item.orgaoEntidade?.cnpj;
          const ano = item.anoCompra;
          const seq = item.sequencialCompra;
          if (cnpj && ano && seq) {
            const itemRes = await fetch(`https://pncp.gov.br/api/pncp/v1/orgaos/${cnpj}/compras/${ano}/${seq}/itens`);
            if (itemRes.ok) {
              const itemData = await itemRes.json();
              itemsResult = Array.isArray(itemData) ? itemData : [];
            }
          }
        } catch (e) {
          console.warn("Failed to fetch items for PNCP bid", item.numeroControlePNCP);
        }

        return {
          id: String(item.numeroControlePNCP).replace(/\//g, '-'),
          portal: 'PNCP',
          organ: item.orgaoEntidade?.razaoSocial || 'Dado não informado pela fonte',
          municipality: item.unidadeOrgao?.municipioNome || 'Dado não informado pela fonte',
          state: item.unidadeOrgao?.ufSigla || '-',
          capag: getDeterministicCapag(item.unidadeOrgao?.ufSigla, item.unidadeOrgao?.municipioNome, item.orgaoEntidade?.razaoSocial),
          object: item.objetoCompra,
          modality: item.modalidadeNome || 'Dado não informado pela fonte',
          estimatedValue: item.valorTotalEstimado || 0,
          status: item.situacaoCompraNome || 'Dado não informado pela fonte',
          openDate: item.dataAberturaProposta || item.dataPublicacaoPncp,
          items: itemsResult.map((i: any) => ({
            name: i.descricao || i.materialOuServicoNome || 'Dado não informado',
            catmat: i.materialOuServico === 'M' ? i.itemCategoriaId : undefined,
            catser: i.materialOuServico === 'S' ? i.itemCategoriaId : undefined
          })),
          duplicateIds: [],
          linkSistemaOrigem: item.linkSistemaOrigem || null,
          verifiedOrigin: 1,
          syncDate: new Date().toISOString()
        };
      }));
      
      const parsed = parsedWithItems.filter((b: any) => b.id && b.object && b.openDate);
      allBids = [...allBids, ...parsed];
    }
    
    log.returned = allBids.length;
    return { bids: allBids, prices: [], opportunities: [], log };
  } catch (err: any) {
    log.errors = err.message || JSON.stringify(err);
    return { bids: [], prices: [], opportunities: [], log };
  }
}

export async function fetchComprasGovData() {
  const endpoint = 'http://compras.dados.gov.br/licitacoes/doc/licitacao.json';
  const log = { source: 'Compras.gov.br', endpoint, date: new Date().toISOString(), returned: 0, stored: 0, errors: '' };
  
  try {
    const res = await fetch(endpoint);
    
    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('API do Compras.gov.br não repondeu (404). Pode ter sido descontinuada/bloqueada.');
      }
      throw new Error(`Status ${res.status}: ${res.statusText}`);
    }
    
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch(e) {
      throw new Error("Invalid JSON from Compras.gov.br: " + text.slice(0, 50));
    }
    const itemsArray = data?._embedded?.licitacoes || data?.data || [];
    log.returned = itemsArray.length;

    const parsedBids = itemsArray.map((item: any) => ({
      id: item.identificador,
      portal: 'Compras.gov.br',
      organ: 'Dado não informado pela fonte', 
      municipality: 'Dado não informado pela fonte',
      state: '-',
      capag: getDeterministicCapag('-', '', ''),
      object: item.objeto,
      modality: item.modalidade || 'Dado não informado pela fonte',
      estimatedValue: 0,
      status: item.situacao || 'Dado não informado pela fonte',
      openDate: item.data_entrega_proposta || item.data_abertura_proposta || item.data_publicacao,
      items: [],
      duplicateIds: [],
      linkSistemaOrigem: `https://cnetmobile.estaleiro.serpro.gov.br/comprasnet-web/public/compras/quadro-resumo?identificador=${item.identificador}`,
      verifiedOrigin: 1,
      syncDate: new Date().toISOString()
    })).filter((b: any) => b.id && b.object && b.openDate);

    return { bids: parsedBids, prices: [], opportunities: [], log };
  } catch (err: any) {
    log.errors = err.message || JSON.stringify(err);
    return { bids: [], prices: [], opportunities: [], log };
  }
}

export async function fetchPortalComprasPublicas() {
  const endpoint = 'API Indisponível (Sem acesso público aberto)';
  const log = { source: 'Portal de Compras Públicas', endpoint, date: new Date().toISOString(), returned: 0, stored: 0, errors: 'Sem endpoint oficial público aberto no momento.' };
  return { bids: [], prices: [], opportunities: [], log };
}
