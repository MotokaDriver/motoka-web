import PageLayout from "../components/PageLayout";

export const metadata = {
  title: "Termos de Uso | Motoka Driver",
  description: "Termos e condições de uso do aplicativo Motoka Driver."
};

export default function TermosDeUso() {
  return (
    <PageLayout title="Termos de Uso">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">1. Aceitação dos Termos</h2>
      <p className="mb-4">
        Ao acessar e usar o aplicativo Motoka Driver, você confirma que leu, entendeu e concorda com estes Termos de Uso. Se você não concordar com qualquer parte destes termos, solicitamos que não utilize nosso aplicativo.
      </p>

      <h2 className="text-2xl font-semibold mb-4 mt-8 text-gray-800">2. Descrição do Serviço</h2>
      <p className="mb-4">
        O Motoka Driver é uma plataforma que conecta motoboys com estabelecimentos que necessitam de serviços de entrega. Os estabelecimentos podem criar serviços e definir os valores a serem pagos, enquanto os motoboys podem visualizar e aceitar esses serviços.
      </p>

      <h2 className="text-2xl font-semibold mb-4 mt-8 text-gray-800">3. Cadastro e Conta</h2>
      <p className="mb-4">
        3.1. Para utilizar o Motoka Driver, é necessário realizar um cadastro fornecendo informações verdadeiras, precisas e completas.
      </p>
      <p className="mb-4">
        3.2. Você é responsável por manter a confidencialidade de sua senha e conta, e por todas as atividades realizadas com suas credenciais.
      </p>
      <p className="mb-4">
        3.3. Você concorda em notificar imediatamente o Motoka Driver sobre qualquer uso não autorizado de sua conta.
      </p>

      <h2 className="text-2xl font-semibold mb-4 mt-8 text-gray-800">4. Responsabilidades do Usuário</h2>
      <p className="mb-4">
        4.1. <strong>Para Motoboys:</strong>
      </p>
      <ul className="list-disc pl-6 mb-4">
        <li className="mb-2">Manter suas informações de cadastro e documentação atualizadas;</li>
        <li className="mb-2">Cumprir com as leis de trânsito e regulamentações locais;</li>
        <li className="mb-2">Executar os serviços conforme acordado;</li>
        <li className="mb-2">Tratar clientes e estabelecimentos com respeito e profissionalismo;</li>
        <li className="mb-2">Dispor dos equipamentos necessários para a realização dos serviços (moto, celular, etc.).</li>
      </ul>
      
      <p className="mb-4">
        4.2. <strong>Para Estabelecimentos:</strong>
      </p>
      <ul className="list-disc pl-6 mb-4">
        <li className="mb-2">Fornecer informações precisas sobre os serviços solicitados;</li>
        <li className="mb-2">Realizar o pagamento conforme acordado;</li>
        <li className="mb-2">Tratar os motoboys com respeito e profissionalismo;</li>
        <li className="mb-2">Disponibilizar os produtos para entrega em tempo hábil.</li>
      </ul>

      <h2 className="text-2xl font-semibold mb-4 mt-8 text-gray-800">5. Pagamentos</h2>
      <p className="mb-4">
        5.1. O Motoka Driver funciona como intermediário entre estabelecimentos e motoboys, facilitando a negociação de valores e o pagamento dos serviços.
      </p>
      <p className="mb-4">
        5.2. O aplicativo poderá cobrar taxas de serviço, que serão claramente informadas antes da finalização de qualquer transação.
      </p>

      <h2 className="text-2xl font-semibold mb-4 mt-8 text-gray-800">6. Limitação de Responsabilidade</h2>
      <p className="mb-4">
        6.1. O Motoka Driver não se responsabiliza por danos diretos, indiretos, incidentais ou consequentes decorrentes do uso ou incapacidade de uso do serviço.
      </p>
      <p className="mb-4">
        6.2. Não nos responsabilizamos por atrasos ou falhas na entrega causados por fatores fora de nosso controle.
      </p>
      <p className="mb-4">
        6.3. O aplicativo não é responsável por quaisquer problemas ou danos aos produtos entregues.
      </p>

      <h2 className="text-2xl font-semibold mb-4 mt-8 text-gray-800">7. Modificações nos Termos</h2>
      <p className="mb-4">
        7.1. O Motoka Driver se reserva o direito de modificar estes Termos de Uso a qualquer momento, a seu exclusivo critério.
      </p>
      <p className="mb-4">
        7.2. As alterações entrarão em vigor imediatamente após a publicação dos termos atualizados no aplicativo.
      </p>
      <p className="mb-4">
        7.3. O uso contínuo do aplicativo após as alterações constitui aceitação dos novos termos.
      </p>

      <h2 className="text-2xl font-semibold mb-4 mt-8 text-gray-800">8. Legislação Aplicável</h2>
      <p className="mb-4">
        8.1. Estes Termos de Uso são regidos pelas leis brasileiras.
      </p>
      <p className="mb-4">
        8.2. Qualquer disputa decorrente ou relacionada a estes termos será submetida à jurisdição exclusiva dos tribunais brasileiros.
      </p>

      <h2 className="text-2xl font-semibold mb-4 mt-8 text-gray-800">9. Contato</h2>
      <p className="mb-4">
        Se você tiver dúvidas sobre estes Termos de Uso, entre em contato conosco pelo e-mail contato@motoka.com.
      </p>

      <p className="mt-8 text-gray-600 italic">
        Última atualização: {new Date().toLocaleDateString('pt-BR')}
      </p>
    </PageLayout>
  );
} 