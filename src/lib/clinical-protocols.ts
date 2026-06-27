export interface ExercicioProtocolo {
  nome: string
  descricao: string
  parametros?: string
}

export interface Protocolo {
  id: string
  condicao: string
  severidade: 'ATENCAO' | 'CUIDADO' | 'RESTRICAO'
  recomendados: ExercicioProtocolo[]
  evitar: string[]
  observacoes: string
}

// Severidade visual
export const SEVERIDADE_CONFIG = {
  ATENCAO:  { label: 'Atenção',   bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-800',  dot: 'bg-amber-500'  },
  CUIDADO:  { label: 'Cuidado',   bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  RESTRICAO:{ label: 'Restrição', bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100 text-red-800',      dot: 'bg-red-500'    },
}

// ─── Protocolos por doença codificada ───────────────────────────────────────

const PROTOCOLO_DOENCAS: Record<string, Protocolo> = {
  HIPERTENSAO: {
    id: 'HIPERTENSAO',
    condicao: 'Hipertensão Arterial',
    severidade: 'CUIDADO',
    recomendados: [
      { nome: 'Caminhada moderada', descricao: 'Ritmo constante, FC 50–70% FCmax', parametros: '30–45 min' },
      { nome: 'Bicicleta ergométrica', descricao: 'Resistência baixa a moderada', parametros: '20–30 min' },
      { nome: 'Leg press', descricao: 'Carga leve a moderada, respiração controlada', parametros: '3×12–15' },
      { nome: 'Remada baixa', descricao: 'Movimento controlado, sem apneia', parametros: '3×12' },
      { nome: 'Alongamento geral', descricao: 'Final de sessão, respiração calma', parametros: '10–15 min' },
    ],
    evitar: [
      'Isométricos prolongados (prancha > 30 s)',
      'Manobra de Valsalva (prender respiração)',
      'Exercícios overhead com cargas pesadas',
      'Alta intensidade sem monitorização',
      'Ambiente muito quente ou frio',
    ],
    observacoes: 'Monitorar PA antes e após a sessão. Parar se PA > 180/110 mmHg. FC alvo conservadora. Ter medicação disponível no local.',
  },

  DIABETES: {
    id: 'DIABETES',
    condicao: 'Diabetes',
    severidade: 'CUIDADO',
    recomendados: [
      { nome: 'Aeróbico moderado', descricao: 'Caminhada, bicicleta, elíptico', parametros: '30–45 min' },
      { nome: 'Treino de resistência', descricao: 'Cargas moderadas, melhora sensibilidade à insulina', parametros: '3×12–15' },
      { nome: 'Circuito funcional', descricao: 'Baixa a moderada intensidade', parametros: '20–30 min' },
    ],
    evitar: [
      'Treino em jejum prolongado (> 4 h sem comer)',
      'Alta intensidade sem medição de glicemia prévia',
      'Sessões > 60 min sem reposição de carboidratos',
    ],
    observacoes: 'Medir glicemia antes (ideal 100–250 mg/dL). Ter fonte de carboidrato disponível. Hidratação constante. Inspecionar pés após exercício.',
  },

  OSTEOPOROSE: {
    id: 'OSTEOPOROSE',
    condicao: 'Osteoporose',
    severidade: 'RESTRICAO',
    recomendados: [
      { nome: 'Leg press parcial', descricao: 'Estimula formação óssea sem impacto', parametros: '3×12' },
      { nome: 'Agachamento com apoio', descricao: 'Amplitude reduzida, apoio no TRX', parametros: '3×10' },
      { nome: 'Caminhada', descricao: 'Carga axial leve, impacto mínimo', parametros: '20–30 min' },
      { nome: 'Equilíbrio unipodal', descricao: 'Prevenir quedas — prioridade máxima', parametros: '3×30 s cada perna' },
      { nome: 'Abdução de glúteos c/ elástico', descricao: 'Fortalece quadril sem carga axial', parametros: '3×15' },
    ],
    evitar: [
      'Alto impacto (jumping, corrida intensa)',
      'Rotações bruscas da coluna',
      'Flexão da coluna com carga (dead lift)',
      'Sit-ups e crunchs tradicionais',
      'Exercícios que aumentem risco de queda',
    ],
    observacoes: 'Equilíbrio e prevenção de quedas são a prioridade absoluta. Carga progressiva leve estimula formação óssea. Verificar DEXA recente.',
  },

  CARDIOPATIA: {
    id: 'CARDIOPATIA',
    condicao: 'Cardiopatia',
    severidade: 'RESTRICAO',
    recomendados: [
      { nome: 'Caminhada leve', descricao: 'FC alvo conservadora 40–60% FCmax', parametros: '20–30 min' },
      { nome: 'Bicicleta ergométrica', descricao: 'Resistência muito baixa, supervisionado', parametros: '15–20 min' },
      { nome: 'Alongamento suave', descricao: 'Sem restrições excessivas de amplitude', parametros: '10 min' },
    ],
    evitar: [
      'Alta intensidade (> 70% FCmax)',
      'Isométricos de grandes grupos musculares',
      'Ambiente muito quente ou frio',
      'Exercício pós-refeição pesada',
      'Competição ou esforço máximo',
    ],
    observacoes: 'Clearance cardiológico OBRIGATÓRIO antes de iniciar. Monitorização de FC constante. Parar imediatamente com dor no peito, falta de ar ou tonturas.',
  },

  ARTROSE: {
    id: 'ARTROSE',
    condicao: 'Artrose',
    severidade: 'ATENCAO',
    recomendados: [
      { nome: 'Bicicleta ergométrica', descricao: 'Sem impacto, melhora nutrição cartilaginosa', parametros: '20–30 min' },
      { nome: 'Leg press parcial', descricao: '0–60° amplitude, sem dor', parametros: '3×12' },
      { nome: 'Fortalecimento periarticular', descricao: 'Quadríceps, isquiotibiais, glúteos', parametros: '3×15' },
      { nome: 'Hidroginástica/aquático', descricao: 'Ideal para artrose — se disponível', parametros: '30 min' },
    ],
    evitar: [
      'Impacto repetitivo (corrida, jumping)',
      'Sobrecarga articular excessiva',
      'Agachamento profundo (> 90°) se há dor',
      'Exercícios em amplitude dolorosa',
    ],
    observacoes: 'Amplitude sem dor é o guia principal. Períodos de dor intensa → reduzir carga. Anti-inflamatório pode mascarar dor — atenção redobrada.',
  },

  ASMA: {
    id: 'ASMA',
    condicao: 'Asma / Doença Respiratória',
    severidade: 'ATENCAO',
    recomendados: [
      { nome: 'Aeróbico progressivo', descricao: 'Warm-up obrigatório de 10 min antes de intensidade', parametros: '30 min' },
      { nome: 'Treino de força', descricao: 'Ambiente indoor controlado', parametros: '3×12' },
      { nome: 'Yoga / respiração', descricao: 'Melhora capacidade pulmonar', parametros: '20 min' },
    ],
    evitar: [
      'Esforço em ambiente frio ou seco',
      'Alta intensidade sem warm-up',
      'Desportos ao ar livre em dias de poluição elevada',
      'Ambiente com alérgenos (poeira, mofo)',
    ],
    observacoes: 'Broncodilatador de resgate disponível na sessão. Warm-up obrigatório. Parar com dispneia fora do normal.',
  },

  DEPRESSAO: {
    id: 'DEPRESSAO',
    condicao: 'Depressão',
    severidade: 'ATENCAO',
    recomendados: [
      { nome: 'Aeróbico regular', descricao: 'Libera endorfinas e serotonina', parametros: '30–45 min, 3–5×/semana' },
      { nome: 'Treino de força', descricao: 'Melhora autoestima e disposição', parametros: '3×10–12' },
      { nome: 'Caminhada ao ar livre', descricao: 'Exposição solar + movimento', parametros: '30 min' },
    ],
    evitar: [
      'Pressão excessiva de performance',
      'Ambiente muito competitivo',
      'Sessões que gerem frustração frequente',
    ],
    observacoes: 'Regularidade > intensidade. Foco no bem-estar, não na performance. Celebrar pequenas evoluções. Comunicação constante sobre estado emocional.',
  },

  ANSIEDADE: {
    id: 'ANSIEDADE',
    condicao: 'Ansiedade',
    severidade: 'ATENCAO',
    recomendados: [
      { nome: 'Aeróbico moderado', descricao: 'Reduz cortisol sistematicamente', parametros: '30 min' },
      { nome: 'Respiração diafragmática', descricao: 'Ativação parassimpática pré-treino', parametros: '5–10 min' },
      { nome: 'Treino de força', descricao: 'Estrutura e rotina reduzem ansiedade', parametros: '3×12' },
    ],
    evitar: [
      'Ambiente caótico ou muito barulhento',
      'Mudanças bruscas de plano de treino',
      'Sobrecarga de informação sobre performance',
    ],
    observacoes: 'Consistência e previsibilidade são terapêuticas. Explicar o treino antes de iniciar. Respeitar o ritmo individual sem pressão.',
  },
}

// ─── Protocolos por palavras-chave em texto livre ────────────────────────────

const PROTOCOLO_KEYWORDS: { keywords: string[]; protocolo: Protocolo }[] = [
  {
    keywords: ['lombar', 'hérnia', 'hernia', 'disco', 'l4', 'l5', 'l3'],
    protocolo: {
      id: 'LOMBAR',
      condicao: 'Disfunção Lombar / Hérnia de Disco',
      severidade: 'RESTRICAO',
      recomendados: [
        { nome: 'Bird-dog', descricao: 'Estabilização de core profundo, coluna neutra', parametros: '3×10 cada lado' },
        { nome: 'Prancha isométrica', descricao: 'Curta duração, coluna neutra', parametros: '3×20–30 s' },
        { nome: 'Ponte glútea', descricao: 'Fortalece glúteos e estabiliza lombar', parametros: '3×15' },
        { nome: 'Dead bug', descricao: 'Core profundo sem carga lombar', parametros: '3×8 cada lado' },
        { nome: 'Extensão lombar suave (McKenzie)', descricao: 'Pode aliviar pressão discal', parametros: '2×10' },
        { nome: 'Caminhada', descricao: 'Mobilidade funcional sem carga axial excessiva', parametros: '20–30 min' },
      ],
      evitar: [
        'Agachamento livre com carga',
        'Peso morto convencional',
        'Sit-ups e crunchs tradicionais',
        'Good morning',
        'Rotações da coluna com carga',
        'Impacto vertical (jumping, corrida)',
      ],
      observacoes: 'Core estabilizador é a prioridade absoluta. Coluna neutra em TODOS os exercícios. Parar imediatamente com irradiação de dor para a perna (sinal de alarme).',
    },
  },
  {
    keywords: ['joelho', 'lca', 'ligamento cruzado', 'menisco', 'ligamento lateral'],
    protocolo: {
      id: 'JOELHO',
      condicao: 'Lesão de Joelho (LCA / Menisco)',
      severidade: 'RESTRICAO',
      recomendados: [
        { nome: 'Leg press parcial (0–60°)', descricao: 'Fortalece quadríceps sem stress no LCA', parametros: '3×12' },
        { nome: 'Isométrico de quadríceps', descricao: 'Ativação muscular sem movimento articular', parametros: '3×30 s' },
        { nome: 'Abdução/adução com elástico', descricao: 'Estabilizadores do joelho', parametros: '3×15' },
        { nome: 'Bicicleta ergométrica', descricao: 'Amplitude controlada, sem impacto', parametros: '20 min' },
        { nome: 'Propriocepção em superfície estável', descricao: 'Base essencial para progressão', parametros: '3×30 s' },
        { nome: 'Ponte glútea', descricao: 'Cadeia posterior sem sobrecarga no joelho', parametros: '3×15' },
      ],
      evitar: [
        'Agachamento livre (sobretudo < 6 meses pós-cirurgia)',
        'Leg extension completo (stress direto no LCA)',
        'Movimentos de pivot e rotação',
        'Corrida (até liberação médica)',
        'Saltos e pliometria',
      ],
      observacoes: '< 6 meses pós-cirurgia: protocolo conservador. 6–12 meses: progressão gradual. > 12 meses: avançado com reavaliação médica. Inchaço = reduzir carga imediatamente.',
    },
  },
  {
    keywords: ['ombro', 'manguito', 'rotador', 'impingement', 'bursit', 'tendinit'],
    protocolo: {
      id: 'OMBRO',
      condicao: 'Lesão de Ombro (Manguito / Impingement)',
      severidade: 'CUIDADO',
      recomendados: [
        { nome: 'Rotação externa c/ elástico', descricao: 'Fortalece manguito rotador', parametros: '3×15' },
        { nome: 'Rotação interna c/ elástico', descricao: 'Equilíbrio muscular do ombro', parametros: '3×15' },
        { nome: 'Face pull c/ elástico', descricao: 'Retratores escapulares + manguito', parametros: '3×15' },
        { nome: 'Remada baixa', descricao: 'Cotovelos junto ao corpo, sem overhead', parametros: '3×12' },
        { nome: 'Exercícios de escápula', descricao: 'Elevação, depressão e retração', parametros: '3×10' },
      ],
      evitar: [
        'Overhead press (qualquer variação)',
        'Supino pega larga (> 90° de abdução)',
        'Pull-over',
        'Puxada atrás da cabeça',
        'Movimentos que reproduzam a dor',
      ],
      observacoes: 'Fortalecer manguito rotador ANTES de qualquer progressão de carga. Amplitude sem dor é o guia. Postura escapular em todos os exercícios.',
    },
  },
  {
    keywords: ['tornozelo', 'entorse'],
    protocolo: {
      id: 'TORNOZELO',
      condicao: 'Lesão de Tornozelo',
      severidade: 'ATENCAO',
      recomendados: [
        { nome: 'Propriocepção em prancha', descricao: 'Reestabelece propriocepção — prioridade', parametros: '3×30 s' },
        { nome: 'Dorsiflexão com elástico', descricao: 'Fortalece tibial anterior', parametros: '3×15' },
        { nome: 'Elevação de calcâneos', descricao: 'Fortalece gêmeos e sóleo', parametros: '3×15' },
        { nome: 'Bicicleta ergométrica', descricao: 'Mobilidade sem impacto', parametros: '20 min' },
      ],
      evitar: [
        'Corrida em superfície irregular',
        'Saltos e pliometria',
        'Agachamento unilateral (fase aguda)',
        'Desportos com mudança de direção',
      ],
      observacoes: 'Défice proprioceptivo residual é a principal causa de re-entorse. Propriocepção deve ser trabalhada até alta completa.',
    },
  },
  {
    keywords: ['coluna', 'cervical', 'torácica', 'escoliose'],
    protocolo: {
      id: 'COLUNA',
      condicao: 'Disfunção da Coluna Vertebral',
      severidade: 'CUIDADO',
      recomendados: [
        { nome: 'Core profundo (transverso)', descricao: 'Estabilização segmentar', parametros: '3×20 s' },
        { nome: 'Prancha isométrica', descricao: 'Coluna neutra, duração curta', parametros: '3×20–30 s' },
        { nome: 'Caminhada', descricao: 'Mobilidade funcional sem carga excessiva', parametros: '30 min' },
        { nome: 'Alongamento de cadeia posterior', descricao: 'Reduz tensão paravertebral', parametros: '3×30 s' },
      ],
      evitar: [
        'Flexão da coluna com carga',
        'Rotações com resistência',
        'Impacto vertical repetitivo',
        'Postura fletida por tempo prolongado no treino',
      ],
      observacoes: 'Avaliação postural antes de iniciar cargas. Core estabilizador é pré-requisito para qualquer progressão.',
    },
  },
]

// ─── Engine principal ────────────────────────────────────────────────────────

export interface ProtocoloResult {
  protocolo: Protocolo
  origem: 'doenca' | 'texto'
  textoOrigem?: string
}

export function gerarProtocolos(params: {
  doencas?: string[]
  doencasOutras?: string
  cirurgias?: string
  limitacoesFisicas?: string
}): ProtocoloResult[] {
  const results: ProtocoloResult[] = []
  const ids = new Set<string>()

  // 1. Por doenças codificadas
  for (const d of params.doencas ?? []) {
    const p = PROTOCOLO_DOENCAS[d]
    if (p && !ids.has(p.id)) {
      ids.add(p.id)
      results.push({ protocolo: p, origem: 'doenca' })
    }
  }

  // 2. Por texto livre (limitações, cirurgias, outras doenças)
  const textos = [
    params.limitacoesFisicas ?? '',
    params.cirurgias ?? '',
    params.doencasOutras ?? '',
  ]
  const textoCompleto = textos.join(' ').toLowerCase()

  for (const { keywords, protocolo } of PROTOCOLO_KEYWORDS) {
    if (ids.has(protocolo.id)) continue
    if (keywords.some(kw => textoCompleto.includes(kw))) {
      ids.add(protocolo.id)
      const textoOrigem = textos.find(t => keywords.some(kw => t.toLowerCase().includes(kw)))
      results.push({ protocolo, origem: 'texto', textoOrigem })
    }
  }

  return results
}
