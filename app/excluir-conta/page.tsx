import PageLayout from "../components/PageLayout";
import Link from "next/link";

export const metadata = {
  title: "Excluir Conta | Motoka Driver",
  description: "Informações sobre como excluir sua conta do Motoka Driver."
};

export default function ExcluirConta() {
  return (
    <PageLayout title="Excluir Conta">
      <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-8">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-orange-700">
              <strong>Importante:</strong> A exclusão da conta é permanente e não pode ser desfeita. Todos os seus dados serão removidos do nosso sistema.
            </p>
          </div>
        </div>
      </div>

      <h2 className="text-2xl font-semibold mb-4 text-gray-800">Como solicitar a exclusão da sua conta</h2>
      <p className="mb-6">
        Para solicitar a exclusão da sua conta do Motoka Driver, por favor, envie um email para <a href="mailto:contatomotokadriver@gmail.com" className="text-primary hover:underline">contatomotokadriver@gmail.com</a> com as seguintes informações:
      </p>

      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mb-8">
        <h3 className="font-semibold text-lg mb-4">Modelo de Email para Exclusão de Conta</h3>
        <div className="bg-white p-4 rounded border border-gray-300">
          <p className="mb-2"><strong>Assunto:</strong> Solicitação de Exclusão de Conta - [Seu Nome]</p>
          <hr className="my-2" />
          <p className="mb-2">Prezada Equipe do Motoka Driver,</p>
          <p className="mb-2">Eu, [seu nome completo], solicito a exclusão permanente da minha conta do aplicativo Motoka Driver. Estou ciente de que esta ação é irreversível e resultará na perda de todos os meus dados e histórico de atividades no aplicativo.</p>
          <p className="mb-2">Informações para verificação:</p>
          <ul className="list-disc pl-6 mb-2">
            <li>Nome completo: [seu nome completo]</li>
            <li>Email cadastrado: [seu email]</li>
            <li>Telefone: [seu telefone]</li>
            <li>CPF/CNPJ: [seu CPF ou CNPJ]</li>
            <li>Tipo de conta: [Motoboy ou Estabelecimento]</li>
          </ul>
          <p className="mb-2">Por favor, confirme o recebimento desta solicitação e me informe quando o processo de exclusão for concluído.</p>
          <p>Atenciosamente,<br />[Seu Nome]</p>
        </div>
      </div>

      <h2 className="text-2xl font-semibold mb-4 mt-8 text-gray-800">O que acontece após solicitar a exclusão</h2>
      <ol className="list-decimal pl-6 mb-6 space-y-4">
        <li>
          <strong>Confirmaremos o recebimento da sua solicitação</strong> - Após recebermos seu email, enviaremos uma confirmação para o endereço de email associado à sua conta.
        </li>
        <li>
          <strong>Verificaremos sua identidade</strong> - Para proteger sua privacidade, precisamos verificar que a solicitação foi feita pelo proprietário legítimo da conta.
        </li>
        <li>
          <strong>Processaremos a exclusão</strong> - Após a verificação, iniciaremos o processo de exclusão da sua conta, que será concluído em até 30 dias.
        </li>
        <li>
          <strong>Enviaremos confirmação</strong> - Quando o processo estiver concluído, enviaremos um email confirmando a exclusão permanente da sua conta.
        </li>
      </ol>

      <h2 className="text-2xl font-semibold mb-4 mt-8 text-gray-800">Informações Importantes</h2>
      <ul className="list-disc pl-6 mb-8">
        <li className="mb-2">
          <strong>Pagamentos pendentes:</strong> Se você tiver pagamentos pendentes ou créditos não utilizados, eles serão processados antes da exclusão da conta, de acordo com nossos termos de serviço.
        </li>
        <li className="mb-2">
          <strong>Transações e registros legais:</strong> Algumas informações sobre transações podem ser mantidas para fins legais e contábeis, mesmo após a exclusão da sua conta, conforme exigido pela legislação aplicável.
        </li>
        <li className="mb-2">
          <strong>Tempo para exclusão completa:</strong> Pode levar até 30 dias para que todos os seus dados sejam completamente removidos dos nossos sistemas e backups.
        </li>
      </ul>

      <div className="mt-8 bg-gray-50 p-6 rounded-lg border border-gray-200">
        <h3 className="font-semibold text-lg mb-2">Ainda tem dúvidas?</h3>
        <p className="mb-4">
          Se você tiver alguma dúvida sobre o processo de exclusão da conta ou precisar de assistência adicional, entre em contato com nossa equipe de suporte.
        </p>
        <Link 
          href="/#contact" 
          className="inline-flex items-center text-primary hover:underline"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
          </svg>
          Contatar Suporte
        </Link>
      </div>
    </PageLayout>
  );
} 