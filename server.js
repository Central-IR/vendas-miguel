require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 10000;

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Token'],
  credentials: false
}));

// Headers adicionais de CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token');
  
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.static('public'));

// Função para sincronizar dados das tabelas fonte
async function syncVendasMiguel() {
  try {
    console.log('🔄 Sincronizando dados do Miguel...');

    // 1. Buscar TODOS os registros do Controle de Frete (Miguel)
    const { data: freteData, error: freteError } = await supabase
      .from('controle_frete')
      .select('*')
      .eq('vendedor', 'MIGUEL')
      .order('data_emissao', { ascending: true });

    if (freteError) {
      console.error('Erro ao buscar controle_frete:', freteError);
      throw freteError;
    }

    // 2. Buscar APENAS registros PAGOS do Contas a Receber (Miguel)
    const { data: contasData, error: contasError } = await supabase
      .from('contas_receber')
      .select('*')
      .eq('vendedor', 'MIGUEL')
      .eq('status', 'PAGO')
      .order('data_emissao', { ascending: true });

    if (contasError) {
      console.error('Erro ao buscar contas_receber:', contasError);
      throw contasError;
    }

    // 3. Criar mapa de NFs pagas (PRIORIDADE MÁXIMA)
    const nfsPagas = new Map();
    if (contasData && contasData.length > 0) {
      contasData.forEach(conta => {
        if (conta.data_pagamento && conta.numero_nf) {
          nfsPagas.set(conta.numero_nf, conta);
        }
      });
    }

    // 4. Processar registros com PRIORIZAÇÃO
    const registrosParaInserir = [];
    const nfsProcessadas = new Set();

    // PRIORIDADE 1: Contas PAGAS (substituem fretes entregues)
    nfsPagas.forEach((conta, numero_nf) => {
      registrosParaInserir.push({
        numero_nf: numero_nf,
        origem: 'CONTAS_RECEBER',
        data_emissao: conta.data_emissao,
        valor_nf: parseFloat(conta.valor) || 0,
        tipo_nf: conta.tipo_nf || null,
        nome_orgao: conta.orgao || null,
        vendedor: 'MIGUEL',
        banco: conta.banco || null,
        data_vencimento: conta.data_vencimento || null,
        data_pagamento: conta.data_pagamento,
        status_pagamento: conta.status || 'PAGO',
        observacoes: conta.observacoes || null,
        id_contas_receber: conta.id,
        prioridade: 1,
        is_pago: true  // Flag para destacar em verde
      });
      nfsProcessadas.add(numero_nf);
    });

    // PRIORIDADE 2: TODOS os Fretes (apenas se NÃO estiver pago)
    if (freteData && freteData.length > 0) {
      freteData.forEach(frete => {
        if (frete.numero_nf && !nfsProcessadas.has(frete.numero_nf)) {
          registrosParaInserir.push({
            numero_nf: frete.numero_nf,
            origem: 'CONTROLE_FRETE',
            data_emissao: frete.data_emissao,
            valor_nf: parseFloat(frete.valor_nf) || 0,
            tipo_nf: frete.tipo_nf || null,
            nome_orgao: frete.nome_orgao || null,
            vendedor: 'MIGUEL',
            documento: frete.documento || null,
            contato_orgao: frete.contato_orgao || null,
            transportadora: frete.transportadora || null,
            valor_frete: frete.valor_frete ? parseFloat(frete.valor_frete) : null,
            data_coleta: frete.data_coleta || null,
            cidade_destino: frete.cidade_destino || null,
            previsao_entrega: frete.previsao_entrega || null,
            status_frete: frete.status || null,
            id_controle_frete: frete.id,
            prioridade: 2,
            is_pago: false  // Não está pago
          });
          nfsProcessadas.add(frete.numero_nf);
        }
      });
    }

    // 5. Limpar tabela vendas_miguel e inserir novos dados
    const { error: deleteError } = await supabase
      .from('vendas_miguel')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (deleteError) {
      console.error('⚠️ Aviso ao limpar tabela:', deleteError.message);
    }

    // Ordenar por data_emissao CRESCENTE
    registrosParaInserir.sort((a, b) => {
      const dateA = new Date(a.data_emissao);
      const dateB = new Date(b.data_emissao);
      return dateA - dateB;
    });

    if (registrosParaInserir.length > 0) {
      // Inserir em lotes de 100 para evitar timeout
      const batchSize = 100;
      for (let i = 0; i < registrosParaInserir.length; i += batchSize) {
        const batch = registrosParaInserir.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('vendas_miguel')
          .insert(batch);

        if (insertError) {
          console.error(`Erro ao inserir lote ${i / batchSize + 1}:`, insertError);
          throw insertError;
        }
      }
    }

    console.log(`✅ Sincronização concluída: ${registrosParaInserir.length} registros`);
    console.log(`   - ${nfsPagas.size} pagas (CONTAS_RECEBER)`);
    console.log(`   - ${registrosParaInserir.length - nfsPagas.size} não pagas (CONTROLE_FRETE)`);
    
    return { 
      success: true, 
      count: registrosParaInserir.length,
      pagos: nfsPagas.size,
      nao_pagos: registrosParaInserir.length - nfsPagas.size
    };

  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
    throw error;
  }
}

// GET /api/sync - Sincronizar dados manualmente
app.get('/api/sync', async (req, res) => {
  try {
    const result = await syncVendasMiguel();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/vendas - Listar todas as vendas do Miguel
app.get('/api/vendas', async (req, res) => {
  try {
    // Sincronizar antes de buscar
    await syncVendasMiguel();

    const { data, error } = await supabase
      .from('vendas_miguel')
      .select('*')
      .order('data_emissao', { ascending: true });

    if (error) throw error;

    res.json(data || []);
  } catch (error) {
    console.error('Erro ao buscar vendas:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/dashboard - Dashboard com estatísticas
app.get('/api/dashboard', async (req, res) => {
  try {
    await syncVendasMiguel();

    const { data, error } = await supabase
      .from('vendas_miguel')
      .select('*');

    if (error) throw error;

    const stats = {
      pago: 0,
      aReceber: 0,
      entregue: 0,
      faturado: 0,
      quantidadePagas: 0,
      quantidadeEntregues: 0
    };

    if (data) {
      data.forEach(venda => {
        const valor = parseFloat(venda.valor_nf) || 0;
        
        // Faturado = tudo
        stats.faturado += valor;

        if (venda.is_pago === true || (venda.origem === 'CONTAS_RECEBER' && venda.data_pagamento)) {
          // Pago
          stats.pago += valor;
          stats.quantidadePagas++;
        } else if (venda.origem === 'CONTROLE_FRETE' && venda.status_frete === 'ENTREGUE') {
          // A receber (entregue mas não pago)
          stats.aReceber += valor;
          stats.entregue++;
          stats.quantidadeEntregues++;
        }
      });
    }

    res.json(stats);
  } catch (error) {
    console.error('Erro ao buscar dashboard:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Sincronização automática a cada 5 minutos
const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutos
setInterval(async () => {
  try {
    console.log('⏰ Executando sincronização automática...');
    await syncVendasMiguel();
  } catch (error) {
    console.error('❌ Erro na sincronização automática:', error);
  }
}, SYNC_INTERVAL);

// Sincronização inicial
console.log('🔄 Executando sincronização inicial...');
syncVendasMiguel()
  .then(() => console.log('✅ Sincronização inicial concluída'))
  .catch(err => console.error('❌ Erro na sincronização inicial:', err));

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📊 Vendas Miguel - Sistema de Monitoramento`);
  console.log(`🔄 Sincronização automática: a cada ${SYNC_INTERVAL / 1000 / 60} minutos`);
});
