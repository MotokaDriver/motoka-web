import LegalPage, { type TocItem } from "../components/landing/LegalPage";

const TOC: TocItem[] = [
  { id: "consentimento", label: "1. Consentimento" },
  { id: "dados-coletados", label: "2. Quais dados coletamos?" },
  { id: "uso", label: "3. Para que usamos essas informações?" },
  { id: "compartilhamento", label: "4. Compartilhamento de informações" },
  { id: "armazenamento", label: "5. Armazenamento e segurança dos dados" },
  { id: "retencao", label: "6. Retenção de dados" },
  { id: "direitos", label: "7. Seus direitos como titular" },
  { id: "atualizacoes", label: "8. Atualizações desta Política" },
  { id: "contato", label: "9. Contato" },
];

export const metadata = {
  title: "Política de Privacidade | Motoka Driver",
  description: "Política de privacidade do aplicativo Motoka Driver."
};

export default function PoliticaDePrivacidade() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Política de Privacidade"
      meta="Data de atualização: 11 de maio de 2025"
      toc={TOC}
    >
      <p>
        Esta Política de Privacidade descreve como coletamos, usamos, armazenamos,
        compartilhamos e protegemos as informações pessoais dos usuários do nosso aplicativo
        Motoka Driver. Ao utilizar nossos serviços, você concorda com os termos desta Política.
      </p>
      <p>
        A proteção dos seus dados é uma prioridade. Recomendamos que leia este documento com
        atenção. Caso tenha dúvidas, entre em contato conosco pelos canais disponíveis no
        Aplicativo.
      </p>

      <h2 id="consentimento">1. Consentimento</h2>
      <p>
        Ao se cadastrar e utilizar o Aplicativo, você declara, de forma livre e expressa, que está
        ciente e concorda com a coleta, tratamento, uso e compartilhamento dos seus dados,
        conforme descrito nesta Política.
      </p>
      <p>
        Informamos que o serviço prestado pelo Motoka Driver não é direcionado a adolescentes e
        crianças menores de 18 anos.
      </p>

      <h2 id="dados-coletados">2. Quais dados coletamos?</h2>
      <p>
        <strong>a. Informações fornecidas por você:</strong>
      </p>
      <ul>
        <li>Nome completo</li>
        <li>Data de nascimento</li>
        <li>CPF ou CNPJ</li>
        <li>Endereço de e-mail</li>
        <li>Telefone</li>
        <li>Endereço</li>
        <li>Dados de pagamento</li>
        <li>Imagens ou arquivos enviados</li>
      </ul>

      <p>
        <strong>b. Informações de uso:</strong>
      </p>
      <p>
        Coletamos automaticamente dados sobre como você interage com o Aplicativo, como:
      </p>
      <ul>
        <li>Endereço IP</li>
        <li>Dispositivo e sistema operacional</li>
        <li>Navegador</li>
        <li>Horários de acesso</li>
        <li>Informações de navegação dentro do app</li>
        <li>Dados de localização geográfica, com sua permissão</li>
      </ul>

      <p>
        <strong>c. Cookies e tecnologias semelhantes:</strong>
      </p>
      <p>
        Utilizamos cookies, pixels e identificadores de dispositivo para:
      </p>
      <ul>
        <li>Autenticar usuários</li>
        <li>Salvar preferências</li>
        <li>Analisar padrões de uso</li>
        <li>Exibir conteúdos e anúncios personalizados</li>
      </ul>

      <h2 id="uso">3. Para que usamos essas informações?</h2>
      <p>
        As informações coletadas são utilizadas para:
      </p>
      <ul>
        <li>Criar e gerenciar sua conta no Aplicativo</li>
        <li>Processar pedidos e pagamentos</li>
        <li>Realizar serviços contratados</li>
        <li>Enviar notificações importantes (transações, suporte, segurança)</li>
        <li>Personalizar sua experiência</li>
        <li>Oferecer suporte técnico</li>
        <li>Realizar análises internas e melhorar o produto</li>
        <li>Combater fraudes e garantir a segurança</li>
        <li>Enviar comunicações de marketing e promoções (com opção de descadastro)</li>
      </ul>

      <h2 id="compartilhamento">4. Compartilhamento de informações</h2>
      <p>
        Poderemos compartilhar seus dados com:
      </p>
      <ul>
        <li>Fornecedores e parceiros que auxiliam na operação dos serviços</li>
        <li>Prestadores de serviço de pagamento, entrega e atendimento</li>
        <li>Autoridades legais, mediante requisição ou obrigação legal</li>
        <li>Parceiros de marketing, respeitando seu consentimento e a legislação aplicável</li>
      </ul>
      <p>
        Nos comprometemos a garantir que terceiros adotem padrões compatíveis de proteção de
        dados.
      </p>

      <h2 id="armazenamento">5. Armazenamento e segurança dos dados</h2>
      <p>
        Seus dados são armazenados em servidores seguros, podendo estar localizados fora do
        Brasil, em países que oferecem grau de proteção de dados adequado à legislação
        brasileira.
      </p>
      <p>
        Adotamos medidas técnicas e administrativas para proteger seus dados contra acessos não
        autorizados, vazamentos, destruição ou qualquer forma de tratamento inadequado.
      </p>

      <h2 id="retencao">6. Retenção de dados</h2>
      <p>
        Seus dados serão mantidos enquanto sua conta estiver ativa ou enquanto forem
        necessários para cumprir com obrigações legais, contratuais ou regulatórias.
      </p>

      <h2 id="direitos">7. Seus direitos como titular</h2>
      <p>
        Nos termos da LGPD (Lei Geral de Proteção de Dados), você pode:
      </p>
      <ul>
        <li>Acessar seus dados</li>
        <li>Corrigir dados incompletos ou desatualizados</li>
        <li>Solicitar a anonimização, bloqueio ou exclusão de dados</li>
        <li>Revogar o consentimento</li>
        <li>Solicitar portabilidade dos dados</li>
        <li>Opor-se ao tratamento de dados em casos permitidos por lei</li>
      </ul>
      <p>
        Você pode exercer esses direitos diretamente no Aplicativo ou entrando em contato
        conosco.
      </p>

      <h2 id="atualizacoes">8. Atualizações desta Política</h2>
      <p>
        Esta Política poderá ser atualizada para refletir alterações na legislação ou nos serviços
        prestados. Notificaremos você sobre mudanças relevantes por meio do Aplicativo ou por
        e-mail.
      </p>

      <h2 id="contato">9. Contato</h2>
      <p>
        Em caso de dúvidas, solicitações ou reclamações, entre em contato com nosso
        Encarregado de Dados (DPO):
      </p>
      <p>
        E-mail: <a href="mailto:contatomotokadriver@gmail.com">contatomotokadriver@gmail.com</a>
      </p>
      <p>
        Canal direto no app: Configurações → Privacidade → Fale conosco
      </p>
    </LegalPage>
  );
} 