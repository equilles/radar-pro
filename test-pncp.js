import fetch from 'node-fetch';

async function test() {
  const d = new Date().toISOString().split('T')[0].replace(/-/g, '');
  try {
    const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial=${d}&dataFinal=${d}&codigoModalidadeContratacao=8&pagina=1`;
    console.log("Fetching", url);
    const res = await fetch(url);
    console.log("Status:", res.status);
    const text = await res.text();
console.log("Response:", text);
  } catch (e) {
    console.error(e);
  }
}
test();
