import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testScenario(auth: string, usuario: string, desc: string, sitTrib: string, issVal: string, serviceCode: string, rate: string, extraTags: string = "", extraPrestadorTags: string = "", issTax: string = "") {
  const uniqueId = `req_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  console.log(`\n--- Testando: ${desc} ---`);
  console.log(`ID: ${uniqueId} | SitTrib: ${sitTrib} | ISS: ${issVal} | Service: ${serviceCode} | Rate: ${rate} | Extra: ${extraTags}`);

  const xmlContent = `
<nfse>
  <identificador>${uniqueId}</identificador>

  <nf>
    <valor_total>2,00</valor_total>
    <valor_desconto>0,00</valor_desconto>
    <valor_ir>0,00</valor_ir>
    <valor_inss>0,00</valor_inss>
    <valor_contribuicao_social>0,00</valor_contribuicao_social>
    <valor_rps>0,00</valor_rps>
    <valor_pis>0,00</valor_pis>
    <valor_cofins>0,00</valor_cofins>
    <observacao>Emissao Direta via API (Contingencia)</observacao>
  </nf>

  <prestador>
    <cpfcnpj>${usuario}</cpfcnpj> <cidade>4108809</cidade> ${extraPrestadorTags}
  </prestador>

  <tomador>
    <tipo>F</tipo> <cpfcnpj>58212043134</cpfcnpj> <nome_razao_social>JAIME RODRIGUES JUNIOR</nome_razao_social>
    <logradouro>AV. MATE LARANJEIRA</logradouro>
    <numero_residencia>424</numero_residencia>
    <bairro>CENTRO</bairro>
    <cidade>4108809</cidade> <cep>85980000</cep>
  </tomador>

  <itens>
    <lista>
      <tributa_municipio_prestador>S</tributa_municipio_prestador>
      
      <situacao_tributaria>${sitTrib}</situacao_tributaria>

      <codigo_local_prestacao_servico>4108809</codigo_local_prestacao_servico>
      
      <codigo_item_lista_servico>${serviceCode}</codigo_item_lista_servico>
      
      <codigo_atividade>4520007</codigo_atividade>
      
      <descritivo>Manutencao Eletrica Automotiva</descritivo>
      
      <aliquota_item_lista_servico>${rate}</aliquota_item_lista_servico>
      
      <valor_tributavel>2,00</valor_tributavel>
      <valor_deducao>0,00</valor_deducao>
      
      <valor_issrf>${issVal}</valor_issrf>
      ${issTax ? `<valor_iss>${issTax}</valor_iss>` : ''}
      ${extraTags}
    </lista>
  </itens>
</nfse>
`;

  const form = new FormData();
  form.append('xml', xmlContent, 'nota_envio.xml');

  try {
    const response = await axios.post(
      'https://guaira.atende.net/atende.php?pg=rest&service=WNERestServiceNFSe&cidade=padrao',
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Basic ${auth}`
        }
      }
    );
    console.log("Resposta:", JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error("Erro:", error.message);
    if (error.response) console.error(JSON.stringify(error.response.data, null, 2));
  }
}

async function runTests() {
  console.log("Buscando credenciais no banco de dados...");

  const { data: settings, error } = await supabase
    .from('company_settings')
    .select('*')
    .single();

  if (error || !settings) {
    console.error("Erro ao buscar configurações da empresa:", error);
    return;
  }

  const usuario = settings.cnpj ? settings.cnpj.replace(/\D/g, '') : settings.cpf_cnpj?.replace(/\D/g, '');
  const senha = settings.nfse_password;

  if (!usuario || !senha) {
    console.error("Erro: CNPJ ou Senha NFS-e não encontrados nas configurações da empresa.");
    return;
  }

  console.log(`Credenciais encontradas para CNPJ: ${usuario}`);
  const auth = Buffer.from(`${usuario}:${senha}`).toString('base64');

  // Scenario 1: 6 (Integer)
  await testScenario(auth, usuario, "Teste Aliquota 6 (Inteiro)", "0", "0,00", "140102", "6");

  // Scenario 2: 6,0 (One decimal)
  await testScenario(auth, usuario, "Teste Aliquota 6,0 (Um decimal)", "0", "0,00", "140102", "6,0");
}

runTests();
