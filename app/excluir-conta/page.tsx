import LegalPage from "../components/landing/LegalPage";
import { CONTACT_EMAIL, btnSecondary } from "../components/landing/links";

export const metadata = {
  title: "Excluir Conta | Motoka Driver",
  description: "Informações sobre como excluir sua conta do Motoka Driver."
};

const card = "rounded-2xl border border-lp-line bg-lp-panel p-5 lp-md:p-7";

const STEPS = [
  {
    title: "Confirmaremos o recebimento da sua solicitação",
    text: "Após recebermos seu email, enviaremos uma confirmação para o endereço de email associado à sua conta.",
  },
  {
    title: "Verificaremos sua identidade",
    text: "Para proteger sua privacidade, precisamos verificar que a solicitação foi feita pelo proprietário legítimo da conta.",
  },
  {
    title: "Processaremos a exclusão",
    text: "Após a verificação, iniciaremos o processo de exclusão da sua conta, que será concluído em até 30 dias.",
  },
  {
    title: "Enviaremos confirmação",
    text: "Quando o processo estiver concluído, enviaremos um email confirmando a exclusão permanente da sua conta.",
  },
];

export default function ExcluirConta() {
  return (
    <LegalPage eyebrow="Sua conta" title="Excluir Conta">
      <div
        role="note"
        className="flex gap-3 rounded-2xl border border-lp-warn/35 bg-lp-warn/[0.07] p-4 lp-md:p-5"
      >
        <svg aria-hidden="true" className="mt-1 size-5 shrink-0 text-lp-warn" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <p className="m-0 text-lp-ink">
          <strong className="text-lp-warn">Importante:</strong> A exclusão da conta é permanente e não pode ser desfeita. Todos os seus dados serão removidos do nosso sistema.
        </p>
      </div>

      <h2>Como solicitar a exclusão da sua conta</h2>
      <p>
        Para solicitar a exclusão da sua conta do Motoka Driver, por favor, envie um email para <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> com as seguintes informações:
      </p>

      <div className={card}>
        <h3 className="mt-0 mb-4">Modelo de Email para Exclusão de Conta</h3>
        <div className="space-y-3 rounded-xl border border-lp-line-2 bg-lp-bg p-4 text-[15px] leading-relaxed lp-md:p-5">
          <p><strong>Assunto:</strong> Solicitação de Exclusão de Conta - [Seu Nome]</p>
          <hr className="border-lp-line" />
          <p>Prezada Equipe do Motoka Driver,</p>
          <p>Eu, [seu nome completo], solicito a exclusão permanente da minha conta do aplicativo Motoka Driver. Estou ciente de que esta ação é irreversível e resultará na perda de todos os meus dados e histórico de atividades no aplicativo.</p>
          <p>Informações para verificação:</p>
          <ul>
            <li>Nome completo: [seu nome completo]</li>
            <li>Email cadastrado: [seu email]</li>
            <li>Telefone: [seu telefone]</li>
            <li>CPF/CNPJ: [seu CPF ou CNPJ]</li>
            <li>Tipo de conta: [Motoboy ou Estabelecimento]</li>
          </ul>
          <p>Por favor, confirme o recebimento desta solicitação e me informe quando o processo de exclusão for concluído.</p>
          <p>Atenciosamente,<br />[Seu Nome]</p>
        </div>
      </div>

      <h2>O que acontece após solicitar a exclusão</h2>
      <ol className="!list-none !pl-0">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-4 [&+li]:mt-5">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-lp-line-2 bg-lp-panel text-sm font-semibold text-lp-blue-ink"
            >
              {i + 1}
            </span>
            <span className="pt-0.5">
              <strong>{step.title}</strong> - {step.text}
            </span>
          </li>
        ))}
      </ol>

      <h2>Informações Importantes</h2>
      <ul>
        <li>
          <strong>Pagamentos pendentes:</strong> Se você tiver pagamentos pendentes ou créditos não utilizados, eles serão processados antes da exclusão da conta, de acordo com nossos termos de serviço.
        </li>
        <li>
          <strong>Transações e registros legais:</strong> Algumas informações sobre transações podem ser mantidas para fins legais e contábeis, mesmo após a exclusão da sua conta, conforme exigido pela legislação aplicável.
        </li>
        <li>
          <strong>Tempo para exclusão completa:</strong> Pode levar até 30 dias para que todos os seus dados sejam completamente removidos dos nossos sistemas e backups.
        </li>
      </ul>

      <div className={`${card} !mt-12`}>
        <h3 className="mt-0 mb-2">Ainda tem dúvidas?</h3>
        <p className="m-0 mb-5">
          Se você tiver alguma dúvida sobre o processo de exclusão da conta ou precisar de assistência adicional, entre em contato com nossa equipe de suporte.
        </p>
        {/* O antigo destino (/#contact) não existe na landing nova: o suporte é o e-mail de contato. */}
        <a href={`mailto:${CONTACT_EMAIL}`} className={`${btnSecondary} no-underline`}>
          <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="size-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
            <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
          </svg>
          Contatar Suporte
        </a>
      </div>
    </LegalPage>
  );
}
