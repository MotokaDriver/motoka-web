import PageLayout from "../components/PageLayout";

export const metadata = {
  title: "Política de Privacidade | Motoka Driver",
  description: "Política de privacidade do aplicativo Motoka Driver."
};

export default function PoliticaDePrivacidade() {
  return (
    <PageLayout title="Política de Privacidade">
      <p className="text-right italic mb-6">Data de atualização: 11 de maio de 2025</p>
      
      <p className="mb-6">
        Esta Política de Privacidade descreve como coletamos, usamos, armazenamos,
        compartilhamos e protegemos as informações pessoais dos usuários do nosso aplicativo
        Motoka Driver. Ao utilizar nossos serviços, você concorda com os termos desta Política.
      </p>
      <p className="mb-6">
        A proteção dos seus dados é uma prioridade. Recomendamos que leia este documento com
        atenção. Caso tenha dúvidas, entre em contato conosco pelos canais disponíveis no
        Aplicativo.
      </p>

      <h2 className="text-2xl font-semibold mb-4 mt-8 text-gray-800">1. Consentimento</h2>
      <p className="mb-4">
        Ao se cadastrar e utilizar o Aplicativo, você declara, de forma livre e expressa, que está
        ciente e concorda com a coleta, tratamento, uso e compartilhamento dos seus dados,
        conforme descrito nesta Política.
      </p>
      <p className="mb-6">
        Informamos que o serviço prestado pelo Motoka Driver não é direcionado a adolescentes e
        crianças menores de 18 anos.
      </p>

      <h2 className="text-2xl font-semibold mb-4 mt-8 text-gray-800">2. Quais dados coletamos?</h2>
      <p className="mb-4">
        <strong>a. Informações fornecidas por você:</strong>
      </p>
      <ul className="list-disc pl-6 mb-6">
        <li className="mb-2">Nome completo</li>
        <li className="mb-2">Data de nascimento</li>
        <li className="mb-2">CPF ou CNPJ</li>
        <li className="mb-2">Endereço de e-mail</li>
        <li className="mb-2">Telefone</li>
        <li className="mb-2">Endereço</li>
        <li className="mb-2">Dados de pagamento</li>
        <li className="mb-2">Imagens ou arquivos enviados</li>
      </ul>

      <p className="mb-4">
        <strong>b. Informações de uso:</strong>
      </p>
      <p className="mb-4">
        Coletamos automaticamente dados sobre como você interage com o Aplicativo, como:
      </p>
      <ul className="list-disc pl-6 mb-6">
        <li className="mb-2">Endereço IP</li>
        <li className="mb-2">Dispositivo e sistema operacional</li>
        <li className="mb-2">Navegador</li>
        <li className="mb-2">Horários de acesso</li>
        <li className="mb-2">Informações de navegação dentro do app</li>
        <li className="mb-2">Dados de localização geográfica, com sua permissão</li>
      </ul>

      <p className="mb-4">
        <strong>c. Cookies e tecnologias semelhantes:</strong>
      </p>
      <p className="mb-4">
        Utilizamos cookies, pixels e identificadores de dispositivo para:
      </p>
      <ul className="list-disc pl-6 mb-6">
        <li className="mb-2">Autenticar usuários</li>
        <li className="mb-2">Salvar preferências</li>
        <li className="mb-2">Analisar padrões de uso</li>
        <li className="mb-2">Exibir conteúdos e anúncios personalizados</li>
      </ul>

      <h2 className="text-2xl font-semibold mb-4 mt-8 text-gray-800">3. Para que usamos essas informações?</h2>
      <p className="mb-4">
        As informações coletadas são utilizadas para:
      </p>
      <ul className="list-disc pl-6 mb-6">
        <li className="mb-2">Criar e gerenciar sua conta no Aplicativo</li>
        <li className="mb-2">Processar pedidos e pagamentos</li>
        <li className="mb-2">Realizar serviços contratados</li>
        <li className="mb-2">Enviar notificações importantes (transações, suporte, segurança)</li>
        <li className="mb-2">Personalizar sua experiência</li>
        <li className="mb-2">Oferecer suporte técnico</li>
        <li className="mb-2">Realizar análises internas e melhorar o produto</li>
        <li className="mb-2">Combater fraudes e garantir a segurança</li>
        <li className="mb-2">Enviar comunicações de marketing e promoções (com opção de descadastro)</li>
      </ul>

      <h2 className="text-2xl font-semibold mb-4 mt-8 text-gray-800">4. Compartilhamento de informações</h2>
      <p className="mb-4">
        Poderemos compartilhar seus dados com:
      </p>
      <ul className="list-disc pl-6 mb-6">
        <li className="mb-2">Fornecedores e parceiros que auxiliam na operação dos serviços</li>
        <li className="mb-2">Prestadores de serviço de pagamento, entrega e atendimento</li>
        <li className="mb-2">Autoridades legais, mediante requisição ou obrigação legal</li>
        <li className="mb-2">Parceiros de marketing, respeitando seu consentimento e a legislação aplicável</li>
      </ul>
      <p className="mb-6">
        Nos comprometemos a garantir que terceiros adotem padrões compatíveis de proteção de
        dados.
      </p>

      <h2 className="text-2xl font-semibold mb-4 mt-8 text-gray-800">5. Armazenamento e segurança dos dados</h2>
      <p className="mb-6">
        Seus dados são armazenados em servidores seguros, podendo estar localizados fora do
        Brasil, em países que oferecem grau de proteção de dados adequado à legislação
        brasileira.
      </p>
      <p className="mb-6">
        Adotamos medidas técnicas e administrativas para proteger seus dados contra acessos não
        autorizados, vazamentos, destruição ou qualquer forma de tratamento inadequado.
      </p>

      <h2 className="text-2xl font-semibold mb-4 mt-8 text-gray-800">6. Retenção de dados</h2>
      <p className="mb-6">
        Seus dados serão mantidos enquanto sua conta estiver ativa ou enquanto forem
        necessários para cumprir com obrigações legais, contratuais ou regulatórias.
      </p>

      <h2 className="text-2xl font-semibold mb-4 mt-8 text-gray-800">7. Seus direitos como titular</h2>
      <p className="mb-4">
        Nos termos da LGPD (Lei Geral de Proteção de Dados), você pode:
      </p>
      <ul className="list-disc pl-6 mb-6">
        <li className="mb-2">Acessar seus dados</li>
        <li className="mb-2">Corrigir dados incompletos ou desatualizados</li>
        <li className="mb-2">Solicitar a anonimização, bloqueio ou exclusão de dados</li>
        <li className="mb-2">Revogar o consentimento</li>
        <li className="mb-2">Solicitar portabilidade dos dados</li>
        <li className="mb-2">Opor-se ao tratamento de dados em casos permitidos por lei</li>
      </ul>
      <p className="mb-6">
        Você pode exercer esses direitos diretamente no Aplicativo ou entrando em contato
        conosco.
      </p>

      <h2 className="text-2xl font-semibold mb-4 mt-8 text-gray-800">8. Atualizações desta Política</h2>
      <p className="mb-6">
        Esta Política poderá ser atualizada para refletir alterações na legislação ou nos serviços
        prestados. Notificaremos você sobre mudanças relevantes por meio do Aplicativo ou por
        e-mail.
      </p>

      <h2 className="text-2xl font-semibold mb-4 mt-8 text-gray-800">9. Contato</h2>
      <p className="mb-6">
        Em caso de dúvidas, solicitações ou reclamações, entre em contato com nosso
        Encarregado de Dados (DPO):
      </p>
      <p className="mb-2">
        E-mail: <a href="mailto:contatomotokadriver@gmail.com" className="text-primary hover:underline">contatomotokadriver@gmail.com</a>
      </p>
      <p className="mb-6">
        Canal direto no app: Configurações → Privacidade → Fale conosco
      </p>
    </PageLayout>
  );
} 