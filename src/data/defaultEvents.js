export const defaultEvents = [
  {
    id: '1',
    published: true,
    title: 'Réveillon Exclusive 2027',
    category: 'RÉVEILLON',
    shortDate: '31 DEZ',
    date: '31 de dezembro de 2026',
    time: '22:00',
    location: 'Beach Club • Litoral',
    address: 'Av. Beira-Mar, 1500',
    city: 'Litoral • PR',
    price: 149.9,
    badge: 'MAIS PROCURADO',
    salesStatus: 'Vendas abertas',
    image: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1800&q=90',
    description: 'Uma experiência criada para celebrar a chegada de 2027 em grande estilo. Música, estrutura premium, ambientes exclusivos e uma noite inesquecível do início ao amanhecer.',
    attractions: ['DJ Sunset', 'DJ Main Stage', 'Atração especial', 'Open format'],
    highlights: ['Estrutura premium', 'Espaços exclusivos', 'Área gastronômica', 'Segurança especializada'],
    ticketTypes: [
      { id: 'pista', name: 'Pista', batch: '1º lote', description: 'Acesso à pista principal do evento.', price: 149.9, available: 184, type: 'individual' },
      { id: 'vip', name: 'Área VIP', batch: '1º lote', description: 'Área exclusiva com melhor localização e estrutura.', price: 249.9, available: 92, type: 'individual' },
      { id: 'camarote', name: 'Camarote', batch: 'Lote especial', description: 'Experiência premium em área elevada e exclusiva.', price: 499.9, available: 38, type: 'individual' },
      { id: 'mesa', name: 'Mesa Premium', batch: 'Reserva', description: 'Mesa reservada para até 6 pessoas.', price: 1800, available: 8, type: 'table' }
    ]
  },
  {
    id: '2', published: true, title: 'Sunset Experience', category: 'SUNSET', shortDate: '12 DEZ',
    date: '12 de dezembro de 2026', time: '17:00', location: 'Open Air • Centro', address: 'Rua das Palmeiras, 800', city: 'Pato Branco • PR',
    price: 89.9, badge: '2º LOTE', salesStatus: 'Vendas abertas',
    image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1800&q=90',
    description: 'Um final de tarde especial com música, gastronomia e uma atmosfera criada para aproveitar o pôr do sol até a noite.',
    attractions: ['Sunset DJ', 'Live Sax', 'Open Format'], highlights: ['Evento open air', 'Gastronomia', 'Área VIP', 'Experiência sunset'],
    ticketTypes: [
      { id: 'pista', name: 'Pista', batch: '2º lote', description: 'Entrada geral para o evento.', price: 89.9, available: 250, type: 'individual' },
      { id: 'vip', name: 'VIP', batch: '1º lote', description: 'Área reservada com estrutura diferenciada.', price: 159.9, available: 80, type: 'individual' }
    ]
  },
  {
    id: '3', published: true, title: 'Green Night', category: 'FESTA', shortDate: '20 DEZ',
    date: '20 de dezembro de 2026', time: '23:00', location: 'Club Garden • Premium', address: 'Av. Central, 420', city: 'Pato Branco • PR',
    price: 69.9, badge: 'ÚLTIMOS', salesStatus: 'Últimos ingressos',
    image: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=1800&q=90',
    description: 'Uma noite imersiva com identidade visual marcante, música e experiências exclusivas em um ambiente premium.',
    attractions: ['DJ Resident', 'Guest DJ'], highlights: ['Produção especial', 'Experiência visual', 'Área premium', 'Bar completo'],
    ticketTypes: [
      { id: 'pista', name: 'Pista', batch: 'Último lote', description: 'Ingresso individual para a pista.', price: 69.9, available: 28, type: 'individual' },
      { id: 'camarote', name: 'Camarote', batch: 'Últimas unidades', description: 'Área exclusiva para uma experiência premium.', price: 229.9, available: 12, type: 'individual' }
    ]
  }
]
