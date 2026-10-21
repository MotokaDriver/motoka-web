import LegalPage, { type TocItem } from "../components/landing/LegalPage";

const TOC: TocItem[] = [
  { id: "servicos", label: "1. Serviços oferecidos" },
  { id: "cadastro", label: "2. Cadastro" },
  { id: "obrigacoes-usuario", label: "3. Obrigações do usuário" },
  { id: "obrigacoes-plataforma", label: "4. Obrigações da plataforma" },
  { id: "modificacoes", label: "5. Modificações dos termos" },
  { id: "comunicacao", label: "6. Canal de comunicação" },
  { id: "aceitacao", label: "7. Aceitação do termo de uso" },
];

export const metadata = {
  title: "Termos de Uso | Motoka Driver",
  description: "Termos e condições de uso do aplicativo Motoka Driver."
};

export default function TermosDeUso() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Termos e Condições de Uso"
      meta="Última atualização: 17 de abril de 2025"
      toc={TOC}
      proseClassName="[&_h2]:text-lg [&_h2]:tracking-[0.01em]"
    >
      <p>
        Por favor, leia com atenção os termos e condições. Ao se cadastrar e utilizar a nossa plataforma, você está de acordo com os termos descritos neste documento. Caso não aceite os termos, não será possível utilizar os nossos serviços.
      </p>

      <h2 id="servicos">1. SERVIÇOS OFERECIDOS</h2>
      <p>
        1.1 Este TERMO regula o uso do serviço oferecido pela plataforma Motoka Driver aos USUÁRIOS, que consiste em possibilitar a conexão entre ESTABELECIMENTOS (como restaurantes, lanchonetes, empresas em geral) e MOTOBOYS/MOTOFRETISTAS cadastrados, para solicitação e realização de serviços de entrega.
      </p>
      <p>
        1.2 O serviço da Motoka Driver consiste, portanto, em aproximar, por meio de sua plataforma, os USUÁRIOS ESTABELECIMENTOS COMERCIAIS e os USUÁRIOS MOTOFRETISTAS, viabilizando que os ESTABELECIMENTOS publiquem ordens de entrega que poderão ser visualizadas e aceitas pelos MOTOBOYS cadastrados.
      </p>
      <p>
        1.3 Desde já, o USUÁRIO declara estar ciente de que a Motoka Driver atua apenas como intermediadora tecnológica e facilitadora de contato entre as partes, não sendo responsável pela execução do serviço de entrega em si. Todo o transporte, coleta e entrega de itens são de responsabilidade exclusiva do MOTOFRETISTA que aceita o pedido.
      </p>

      <h2 id="cadastro">2. CADASTRO</h2>
      <p>
        2.1 O USUÁRIO, para utilizar os serviços descritos neste TERMO, deverá ter capacidade jurídica para a prática de atos civis e deverá, obrigatoriamente, fornecer todas as informações exigidas no momento do CADASTRO, assumindo total responsabilidade (inclusive civil e criminal) pela veracidade e exatidão dos dados fornecidos, os quais poderão ser verificados a qualquer momento pela Motoka Driver.
      </p>
      <p>
        2.1.1 Em caso de dados incorretos, inverídicos ou não confirmados, bem como na hipótese de negativa em corrigi-los ou de apresentar documentação que comprove a sua correção, a Motoka Driver reserva-se o direito de não concluir o processo de cadastramento ou, ainda, de bloquear o cadastro já existente, impedindo o USUÁRIO de acessar os serviços até que, a exclusivo critério da Motoka Driver, a situação esteja regularizada. A Motoka Driver poderá, também, recusar novos cadastros ou cancelar cadastros já realizados, caso identifique irregularidades consideradas relevantes ou tentativas de burlar as regras estabelecidas neste TERMO, ou ainda, diante do descumprimento de quaisquer obrigações previstas neste documento.
      </p>
      <p>
        2.2 Após a efetivação do CADASTRO, o USUÁRIO terá acesso aos serviços por meio de login e senha, comprometendo-se a não repassar tais informações a terceiros. Toda solicitação de serviço feita com o uso do login e senha do USUÁRIO será de sua exclusiva responsabilidade.
      </p>

      <h2 id="obrigacoes-usuario">3. OBRIGAÇÕES DO USUÁRIO</h2>
      <p>
        3.1 Efetuado com sucesso o CADASTRO, o USUÁRIO se compromete a manter em sigilo seu login e senha, não os divulgando a terceiros, nem permitindo o uso por pessoas não autorizadas. O USUÁRIO reconhece ser o único responsável por qualquer atividade realizada com seu login e senha.
      </p>
      <p>
        3.2 O USUÁRIO se obriga a fornecer exclusivamente informações verídicas, exatas e atualizadas durante o processo de CADASTRO, responsabilizando-se integralmente por qualquer consequência decorrente de informações incorretas.
      </p>
      <p>
        3.3 O USUÁRIO concorda que a Motoka Driver poderá utilizar avaliações e feedbacks sobre o serviço prestado pelos motofretistas ou estabelecimentos, de forma pública ou interna, conforme descrito na Política de Privacidade.
      </p>
      <p>
        3.4 Os USUÁRIOS que se cadastrarem como motoboys (motofretistas) devem obrigatoriamente ter 18 anos completos e possuir autorização legal para conduzir motocicletas, incluindo a Carteira Nacional de Habilitação (CNH) categoria &quot;A&quot; válida. A omissão ou falsidade dessas informações poderá acarretar em bloqueio ou exclusão do cadastro.
      </p>

      <h2 id="obrigacoes-plataforma">4. OBRIGAÇÕES DA PLATAFORMA</h2>
      <p>
        4.1. Disponibilizar espaço virtual para realização de pedidos e pagamentos online.
      </p>
      <p>
        4.2. Proteger os dados dos usuários com medidas de segurança, não se responsabilizando por ações de terceiros que venham a burlar tais medidas.
      </p>

      <h2 id="modificacoes">5. MODIFICAÇÕES DOS TERMOS</h2>
      <p>
        5.1. O presente TERMO DE USO poderá, a qualquer tempo, ter seu conteúdo, ou parte dele, modificados para adequações e inserções, tudo com vistas ao aprimoramento dos serviços disponibilizados.
      </p>
      <p>
        5.2. O usuário poderá se opor às alterações, solicitando o cancelamento do cadastro.
      </p>

      <h2 id="comunicacao">6. CANAL DE COMUNICAÇÃO</h2>
      <p>
        6.1. O contato entre a plataforma e o usuário será feito por meio eletrônico, sendo responsabilidade do usuário manter seu e-mail ou número de telefone atualizado.
      </p>

      <h2 id="aceitacao">7. ACEITAÇÃO DO TERMO DE USO</h2>
      <p>
        7.1. O usuário declara que leu, entendeu e aceita as condições descritas neste termo.
      </p>
    </LegalPage>
  );
} 