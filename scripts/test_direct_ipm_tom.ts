
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testScenarioTom(auth: string, usuario: string) {
  const uniqueId = `req_TOM_${Date.now()}`;
  console.log(`\n--- Testando Envio Direto com Código TOM (7571) ---`);

  // XML usando 7571 (TOM) ao invés de 4108809 (IBGE) nas tags de cidade
  const xmlContent = `
<nfse>
  <identificador>${uniqueId}</identificador>

  <nf>
    <valor_total>1,00</valor_total>
    <valor_desconto>0,00</valor_desconto>
    <valor_ir>0,00</valor_ir>
    <valor_inss>0,00</valor_inss>
    <valor_contribuicao_social>0,00</valor_contribuicao_social>
    <valor_rps>0,00</valor_rps>
    <valor_pis>0,00</valor_pis>
    <valor_cofins>0,00</valor_cofins>
    <observacao>Teste Direto TOM 7571</observacao>
  </nf>

  <prestador>
    <cpfcnpj>${usuario}</cpfcnpj> 
    <cidade>7571</cidade> 
  </prestador>

  <tomador>
    <tipo>F</tipo> <cpfcnpj>58212043134</cpfcnpj> <nome_razao_social>JAIME RODRIGUES JUNIOR</nome_razao_social>
    <logradouro>AV. MATE LARANJEIRA</logradouro>
    <numero_residencia>424</numero_residencia>
    <bairro>CENTRO</bairro>
    <cidade>7571</cidade> <cep>85980000</cep>
  </tomador>

  <itens>
    <lista>
      <tributa_municipio_prestador>S</tributa_municipio_prestador>
      <situacao_tributaria>0</situacao_tributaria>
      <codigo_local_prestacao_servico>7571</codigo_local_prestacao_servico>
      <codigo_item_lista_servico>140101</codigo_item_lista_servico>
      <codigo_atividade>4520007</codigo_atividade>
      <descritivo>Teste Direto com TOM</descritivo>
      <aliquota_item_lista_servico>2,01</aliquota_item_lista_servico>
      <valor_tributavel>1,00</valor_tributavel>
      <valor_deducao>0,00</valor_deducao>
      <valor_issrf>0,00</valor_issrf>
    </lista>
  </itens>
</nfse>
`;

  const form = new FormData();
  form.append('xml', xmlContent, 'nota_envio_tom.xml');

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
    console.log("Resposta IPM (TOM):", JSON.stringify(response.data, null, 2));
  } catch (error: any) {
    console.error("Erro na requisição:", error.message);
    if (error.response) console.error("Dados do Erro:", JSON.stringify(error.response.data, null, 2));
  }
}

async function runTests() {
  const { data: settings } = await supabase.from('company_settings').select('*').single();
  if (!settings) return console.error("Configurações não encontradas");

  const usuario = settings.cnpj ? settings.cnpj.replace(/\D/g, '') : settings.cpf_cnpj?.replace(/\D/g, '');
  const senha = settings.nfse_password;

  if (!usuario || !senha) return console.error("Credenciais não encontradas");

  const auth = Buffer.from(`${usuario}:${senha}`).toString('base64');
  await testScenarioTom(auth, usuario!);
}

runTests();
