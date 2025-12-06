// src/data/mock.ts

export const CLIENTES_MOCK = [
  { id: 1, nome: "João Silva", telefone: "45 99999-0000", carro: "Gol G5 Prata" },
  { id: 2, nome: "Maria Oliveira", telefone: "45 98888-1111", carro: "Honda Civic 2018" },
];

export const OS_MOCK = [
  { 
    id: 101, 
    cliente: "João Silva", 
    veiculo: "Gol G5", 
    status: "Orçamento", 
    total: 250.00, 
    data: "2023-11-29" 
  },
  { 
    id: 102, 
    cliente: "Maria Oliveira", 
    veiculo: "Honda Civic", 
    status: "Aprovado", 
    total: 1200.00, 
    data: "2023-11-28" 
  },
];