import type { Metadata } from "next";
import PedidoClient from "./PedidoClient";

export const metadata: Metadata = {
  title: "Solicitação de serviço | Motoka Driver",
  description: "Confira os detalhes da oportunidade e responda pelo app Motoka Driver.",
};

export default function PedidoPage() {
  return <PedidoClient />;
}
